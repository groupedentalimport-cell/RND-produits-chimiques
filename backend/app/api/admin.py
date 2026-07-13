"""
Admin API — Train QSPR models, manage database, system health.
Now supports training on real experimental benchmark data.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import require_permission
from app.models.user import User
from app.models.molecule import Molecule
from app.models.organization import Organization
from app.services.gxp_audit import log_event

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/train-qspr")
def train_qspr_models(
    background_tasks: BackgroundTasks,
    use_benchmarks: bool = Query(True, description="Use real experimental benchmark data (ESOL, FreeSolv, Lipophilicity)"),
    properties: Optional[str] = Query(None, description="Comma-separated property names to train (default: all available)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("*")),
):
    """
    Train QSPR models. Two modes:
    1. Benchmark mode (default): Train on real experimental data from MoleculeNet
       - solubility: ESOL dataset (1,128 compounds)
       - logd: Lipophilicity dataset (4,200 compounds)
       - hydration_free_energy: FreeSolv dataset (642 compounds)
    2. Database mode: Train on molecules with descriptors in the local database

    Benchmark mode produces models trained on peer-reviewed experimental data
    with much higher confidence than simulated or computed data.
    """
    from app.ml.qspr_engine import qspr_pipeline

    results = {}

    if use_benchmarks:
        # Train on real experimental benchmark data
        target_props = ["solubility", "logd", "hydration_free_energy"]
        if properties:
            target_props = [p.strip() for p in properties.split(",")]

        for prop in target_props:
            try:
                metrics = qspr_pipeline.train_from_benchmarks(prop)
                if metrics:
                    results[prop] = {
                        "status": "trained",
                        "r2": round(metrics.r2, 4),
                        "rmse": round(metrics.rmse, 4),
                        "mae": round(metrics.mae, 4),
                        "n_samples": metrics.n_samples,
                        "n_features": metrics.n_features,
                        "data_source": metrics.training_source,
                        "cv_scores": [round(s, 4) for s in metrics.cv_scores],
                    }
                else:
                    results[prop] = {"status": "failed", "reason": "Insufficient training data"}
            except Exception as e:
                results[prop] = {"status": "error", "reason": str(e)}
    else:
        # Train on local database molecules
        import numpy as np
        from app.engines.descriptors import DESCRIPTOR_NAMES

        molecules = db.query(Molecule).filter(Molecule.descriptors.isnot(None)).all()

        if len(molecules) < 10:
            raise HTTPException(
                status_code=400,
                detail=f"Need at least 10 molecules with descriptors. Found: {len(molecules)}"
            )

        mol_dicts = []
        for mol in molecules:
            mol_dicts.append({
                "descriptors": mol.descriptors,
                "oxidation_sensitivity": mol.oxidation_sensitivity or 0,
                "hydrolysis_sensitivity": mol.hydrolysis_sensitivity or 0,
                "light_sensitivity": mol.light_sensitivity or 0,
                "solubility_water": mol.solubility_water or 1.0,
                "melting_point": mol.melting_point or 100.0,
                "logp": mol.logp or 0.0,
            })

        X, y_dict = qspr_pipeline.generate_training_data_from_chembl(mol_dicts, DESCRIPTOR_NAMES)

        if X.shape[0] == 0:
            raise HTTPException(status_code=400, detail="No valid feature vectors generated")

        for prop_name, y in y_dict.items():
            if len(y) < 10:
                continue
            try:
                metrics = qspr_pipeline.train(X, y, prop_name, DESCRIPTOR_NAMES, data_source="local_database")
                results[prop_name] = {
                    "status": "trained",
                    "r2": round(metrics.r2, 4),
                    "rmse": round(metrics.rmse, 4),
                    "n_samples": metrics.n_samples,
                    "data_source": "local_database",
                }
            except Exception as e:
                results[prop_name] = {"status": "error", "reason": str(e)}

    # Audit
    log_event(
        db=db, user_id=current_user.id, org_id=current_user.org_id,
        event_type="CREATE", resource_type="MLModel",
        action=f"Trained QSPR models (benchmarks={use_benchmarks})",
        details={"results": results},
    )
    db.commit()

    return {
        "status": "completed",
        "mode": "benchmark" if use_benchmarks else "database",
        "results": results,
        "note": "Benchmark-trained models use real experimental data from peer-reviewed publications." if use_benchmarks else "Models trained on local database molecules.",
    }


@router.get("/system/health")
def system_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("*")),
):
    """Comprehensive system health check."""
    from sqlalchemy import text
    import redis

    health = {"status": "healthy", "checks": {}}

    # Database
    try:
        db.execute(text("SELECT 1"))
        health["checks"]["database"] = "ok"
    except Exception as e:
        health["checks"]["database"] = f"error: {e}"
        health["status"] = "degraded"

    # Redis
    try:
        from app.core.config import settings
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        health["checks"]["redis"] = "ok"
    except Exception as e:
        health["checks"]["redis"] = f"error: {e}"
        health["status"] = "degraded"

    # QSPR models
    from app.ml.qspr_engine import qspr_pipeline
    health["checks"]["qspr_models"] = {
        "loaded": len(qspr_pipeline.models),
        "available": list(qspr_pipeline.models.keys()),
    }

    # Database stats
    health["stats"] = {
        "molecules": db.query(Molecule).count(),
        "organizations": db.query(Organization).count(),
        "users": db.query(User).count(),
    }

    return health


@router.post("/molecules/batch-import")
def batch_import_molecules(
    query: Optional[str] = None,
    limit: int = Query(500, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("*")),
):
    """Batch import molecules from ChEMBL with descriptor computation."""
    from app.services.chembl_loader import batch_load_from_chembl

    stats = batch_load_from_chembl(db=db, query=query, limit=limit, compute_desc=True)

    log_event(
        db=db, user_id=current_user.id, org_id=current_user.org_id,
        event_type="CREATE", resource_type="Molecule",
        action=f"Batch imported molecules from ChEMBL: {stats}",
        details=stats,
    )

    return stats
