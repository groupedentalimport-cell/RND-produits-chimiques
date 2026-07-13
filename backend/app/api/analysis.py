"""
Analysis API — Run stability assessments with QSPR/ML predictions.
Combines rule-based engine, QSPR models, and kinetics.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, require_permission, compute_electronic_signature
from app.models.user import User
from app.models.project import Project, Analysis, Substance
from app.models.molecule import Molecule
from app.engines.risk_engine import assess_all_risks
from app.engines.kinetics import predict_shelf_life, simulate_environmental_variation
from app.engines.descriptors import compute_descriptors
from app.ml.qspr_engine import qspr_pipeline
from app.services.gxp_audit import log_event, sign_event

router = APIRouter(prefix="/analysis", tags=["Analysis"])


# ── Schemas ────────────────────────────────────────────────────────────

class SubstanceInput(BaseModel):
    name: str
    cas_number: Optional[str] = None
    concentration: float = 10.0
    concentration_unit: str = "g/L"
    purity: float = 100.0
    grade: Optional[str] = None
    molar_mass: Optional[float] = None
    molecule_id: Optional[int] = None


class AnalysisRequest(BaseModel):
    project_id: int
    name: Optional[str] = None
    substances: List[SubstanceInput]
    ph: float = 7.0
    temperature: float = 25.0
    humidity: float = 60.0
    dissolved_oxygen: float = 8.0
    light_exposure: float = 0.0
    uv_exposure: float = 0.0
    inert_atmosphere: str = "none"
    container_type: Optional[str] = None
    analysis_type: str = "stability"


class KineticsRequest(BaseModel):
    substance_name: str
    activation_energy: float = 50000.0  # J/mol
    temperature: float = 25.0
    order: int = 1
    initial_concentration: float = 100.0
    threshold_percent: float = 90.0


class SignatureRequest(BaseModel):
    analysis_id: int
    meaning: str = "Reviewed and Approved"


# ── Routes ─────────────────────────────────────────────────────────────

@router.post("/run")
def run_analysis(
    request: AnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("execute:analysis")),
):
    """
    Run a comprehensive stability analysis combining:
    1. Rule-based risk engine (9 risk types)
    2. QSPR molecular property predictions
    3. Kinetic shelf life estimation
    4. Container compatibility assessment
    """
    # Verify project access
    project = db.query(Project).filter(
        Project.id == request.project_id,
        Project.org_id == current_user.org_id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Enrich substances with molecule data
    enriched_substances = []
    for s in request.substances:
        sub_dict = s.model_dump()

        # If molecule_id provided, load from DB
        if s.molecule_id:
            mol = db.query(Molecule).filter(Molecule.id == s.molecule_id).first()
            if mol:
                sub_dict.update({
                    "molar_mass": mol.molar_mass or s.molar_mass,
                    "logp": mol.logp,
                    "pka": mol.pka_acid,
                    "oxidation_sensitivity": mol.oxidation_sensitivity or 0,
                    "hydrolysis_sensitivity": mol.hydrolysis_sensitivity or 0,
                    "light_sensitivity": mol.light_sensitivity or 0,
                    "is_reducing_sugar": mol.is_reducing_sugar,
                    "is_amino_acid": mol.is_amino_acid,
                    "is_chelator": mol.is_chelator,
                    "is_strong_oxidizer": mol.is_strong_oxidizer,
                    "is_reductant": mol.is_reductant,
                    "category": _infer_category(mol),
                })

        enriched_substances.append(sub_dict)

    # ── 1. Rule-based risk assessment ─────────────────────────────────
    conditions = {
        "ph": request.ph,
        "temperature": request.temperature,
        "humidity": request.humidity,
        "dissolved_oxygen": request.dissolved_oxygen,
        "light_exposure": request.light_exposure,
        "uv_exposure": request.uv_exposure,
        "inert_atmosphere": request.inert_atmosphere,
    }
    risk_results = assess_all_risks(enriched_substances, conditions, request.container_type)

    # ── 2. QSPR predictions ──────────────────────────────────────────
    qspr_results = {}
    for s in enriched_substances:
        if s.get("molecule_id"):
            mol = db.query(Molecule).filter(Molecule.id == s["molecule_id"]).first()
            if mol and mol.descriptors:
                desc_vector = list(mol.descriptors.values())[:50]
                for prop_name in ["stability_score", "degradation_rate"]:
                    pred = qspr_pipeline.predict(
                        __import__("numpy").array(desc_vector),
                        prop_name,
                        list(mol.descriptors.keys())[:50],
                    )
                    qspr_results[f"{mol.name}_{prop_name}"] = {
                        "value": pred.predicted_value,
                        "confidence": pred.confidence,
                        "applicability": pred.applicability,
                    }

    # ── 3. Kinetics ──────────────────────────────────────────────────
    kinetics = predict_shelf_life(
        C0=100.0,
        Ea=50000.0,
        T=request.temperature,
        order=1,
        threshold_pct=90.0,
    )

    # ── 4. Save analysis ─────────────────────────────────────────────
    analysis = Analysis(
        project_id=request.project_id,
        user_id=current_user.id,
        name=request.name or f"Analysis {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
        analysis_type=request.analysis_type,
        status="completed",
        ph=request.ph,
        overall_score=risk_results["overall_score"],
        risk_level=risk_results["overall_severity"],
        results=risk_results,
        qspr_predictions=qspr_results,
        ml_model_version="qspr_v1",
        ml_confidence=sum(v["confidence"] for v in qspr_results.values()) / max(len(qspr_results), 1),
        kinetics_results=kinetics,
        predicted_shelf_life_days=kinetics.get("shelf_life_days"),
        predicted_shelf_life_months=kinetics.get("shelf_life_months"),
        container_type=request.container_type,
        completed_at=datetime.utcnow(),
    )
    db.add(analysis)
    db.flush()

    # Audit
    log_event(
        db=db, user_id=current_user.id, org_id=current_user.org_id,
        event_type="CREATE", resource_type="Analysis", resource_id=analysis.id,
        action=f"Completed stability analysis: {analysis.name}",
        details={
            "overall_score": risk_results["overall_score"],
            "risk_level": risk_results["overall_severity"],
            "substance_count": len(enriched_substances),
        },
    )
    db.commit()

    return {
        "analysis_id": analysis.id,
        "status": "completed",
        "overall_score": risk_results["overall_score"],
        "risk_level": risk_results["overall_severity"],
        "risks": risk_results["risks"],
        "recommendations": risk_results["recommendations"],
        "kinetics": kinetics,
        "qspr_predictions": qspr_results,
    }


@router.post("/kinetics/simulate")
def simulate_kinetics(
    request: KineticsRequest,
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """Run kinetic degradation simulation."""
    from app.engines.kinetics import estimate_rate_constant, simulate_degradation

    k = estimate_rate_constant(Ea=request.activation_energy, T=request.temperature)
    result = simulate_degradation(
        C0=request.initial_concentration,
        k=k,
        order=request.order,
        threshold=request.threshold_percent,
    )

    return {
        "substance": request.substance_name,
        "conditions": {
            "temperature": request.temperature,
            "activation_energy": request.activation_energy,
            "order": request.order,
        },
        "rate_constant": round(k, 6),
        "shelf_life_days": result.shelf_life_days,
        "time_series": {
            "days": result.time_points,
            "concentration": result.concentrations,
            "degradation_pct": result.degradation_percent,
        },
    }


@router.post("/sign")
def sign_analysis(
    request: SignatureRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("approve:reports")),
):
    """Apply electronic signature to an analysis (21 CFR Part 11)."""
    analysis = db.query(Analysis).filter(
        Analysis.id == request.analysis_id,
    ).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.is_signed:
        raise HTTPException(status_code=400, detail="Analysis already signed")

    # Verify project org access
    project = db.query(Project).filter(Project.id == analysis.project_id).first()
    if project.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Compute signature
    sig = compute_electronic_signature(
        data=f"analysis:{analysis.id}:{analysis.overall_score}",
        user_id=current_user.id,
        meaning=request.meaning,
    )

    analysis.is_signed = True
    analysis.signed_by = current_user.id
    analysis.signed_at = datetime.utcnow()
    analysis.signature_hash = sig["signature_hash"]
    analysis.signature_meaning = request.meaning

    # Audit
    log_event(
        db=db, user_id=current_user.id, org_id=current_user.org_id,
        event_type="SIGN", resource_type="Analysis", resource_id=analysis.id,
        action=f"Signed analysis: {request.meaning}",
        details=sig,
    )

    db.commit()
    return {"status": "signed", "signature": sig}


@router.get("/project/{project_id}")
def list_project_analyses(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("read:own_projects")),
):
    """List all analyses for a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == current_user.org_id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    analyses = db.query(Analysis).filter(
        Analysis.project_id == project_id,
    ).order_by(Analysis.created_at.desc()).all()

    return {
        "project": project.name,
        "analyses": [
            {
                "id": a.id,
                "name": a.name,
                "status": a.status,
                "overall_score": a.overall_score,
                "risk_level": a.risk_level,
                "is_signed": a.is_signed,
                "created_at": a.created_at,
            }
            for a in analyses
        ],
    }


def _infer_category(mol: Molecule) -> str:
    """Infer substance category from molecule flags."""
    if mol.is_acid: return "acid"
    if mol.is_base: return "base"
    if mol.is_strong_oxidizer: return "oxidizer"
    if mol.is_solvent: return "solvent"
    if mol.is_salt: return "salt"
    if mol.is_surfactant: return "surfactant"
    if mol.is_preservative: return "preservative"
    if mol.is_antioxidant: return "antioxidant"
    if mol.is_excipient: return "excipient"
    if mol.is_active_ingredient: return "active_ingredient"
    return "unknown"
