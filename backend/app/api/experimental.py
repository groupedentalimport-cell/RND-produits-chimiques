"""
Experimental Data API — Access real experimental data from ChEMBL, PubChem, NIST.
Provides endpoints for data enrichment, benchmark queries, and QSPR training data.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.models.user import User
from app.services.gxp_audit import log_event

router = APIRouter(prefix="/experimental", tags=["Experimental Data"])


# ── Schemas ────────────────────────────────────────────────────────────

class EnrichRequest(BaseModel):
    name: str
    cas: Optional[str] = None
    smiles: Optional[str] = None
    chembl_id: Optional[str] = None
    pubchem_cid: Optional[int] = None


class NISTLookupRequest(BaseModel):
    name: Optional[str] = None
    cas: Optional[str] = None


# ── Routes ─────────────────────────────────────────────────────────────

@router.post("/enrich")
def enrich_compound(
    request: EnrichRequest,
    current_user: User = Depends(require_permission("read:molecules")),
):
    """
    Enrich a compound with experimental data from all available sources.
    Queries ChEMBL, PubChem, and NIST WebBook for experimental measurements.
    Returns aggregated properties with full provenance chain.
    """
    from app.services.experimental.data_registry import ExperimentalDataRegistry

    registry = ExperimentalDataRegistry()
    enriched = registry.enrich_compound(
        name=request.name,
        cas=request.cas,
        smiles=request.smiles,
        chembl_id=request.chembl_id,
        pubchem_cid=request.pubchem_cid,
    )

    return {
        "name": enriched.name,
        "cas": enriched.cas,
        "smiles": enriched.smiles,
        "chembl_id": enriched.chembl_id,
        "pubchem_cid": enriched.pubchem_cid,
        "properties": enriched.properties,
        "provenance": [
            {
                "property": p.property_name,
                "value": p.value,
                "unit": p.unit,
                "source": p.source,
                "source_id": p.source_id,
                "confidence": p.confidence,
                "reference": p.reference,
                "fetched_at": p.fetched_at,
            }
            for p in enriched.provenance
        ],
        "data_quality_score": enriched.data_quality_score,
        "experimental_property_count": enriched.experimental_property_count,
        "source_count": enriched.source_count,
    }


@router.get("/nist/{compound_name}")
def get_nist_data(
    compound_name: str,
    current_user: User = Depends(require_permission("read:molecules")),
):
    """
    Get NIST WebBook thermodynamic data for a compound.
    Returns standard thermodynamic properties (ΔHf°, ΔGf°, S°, Cp),
    phase transitions, and physical properties.
    """
    from app.services.experimental.nist_webbook import NISTWebBookLoader

    nist = NISTWebBookLoader()
    summary = nist.get_thermodynamic_summary(compound_name)

    if not summary:
        raise HTTPException(
            status_code=404,
            detail=f"Compound '{compound_name}' not found in NIST reference database. "
                   f"Available: {', '.join(nist.get_all_reference_compounds()[:10])}...",
        )

    return summary


@router.get("/nist")
def list_nist_compounds(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """List all compounds in the NIST reference database."""
    from app.services.experimental.nist_webbook import NISTWebBookLoader

    nist = NISTWebBookLoader()
    compounds = nist.get_all_reference_compounds()

    return {
        "count": len(compounds),
        "compounds": compounds,
        "source": "NIST Chemistry WebBook (webbook.nist.gov)",
    }


@router.get("/benchmarks/summary")
def benchmark_summary(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """
    Get summary of all available benchmark datasets.
    Includes ESOL (solubility), FreeSolv (hydration ΔG), and Lipophilicity (LogD).
    """
    from app.services.experimental.benchmark_loaders import BenchmarkAggregator

    aggregator = BenchmarkAggregator()
    summary = aggregator.summary()

    return {
        "datasets": summary,
        "total_compounds": sum(d["count"] for d in summary.values()),
        "description": {
            "esol": "ESOL (Delaney 2004) — Experimental aqueous solubility for 1,128 compounds",
            "freesolv": "FreeSolv (Mobley & Guthrie 2014) — Experimental hydration free energy for 642 compounds",
            "lipophilicity": "Lipophilicity (Wu et al. 2018) — Experimental LogD at pH 7.4 for 4,200 compounds",
        },
        "references": {
            "esol": "Delaney, J. S. (2004). J. Chem. Inf. Comput. Sci., 44(3), 1000-1005.",
            "freesolv": "Mobley, D. L., & Guthrie, J. P. (2014). J. Comput.-Aided Mol. Des., 28(7), 711-720.",
            "lipophilicity": "Wu, Z., et al. (2018). J. Chem. Inf. Model., 58(3), 556-567.",
        },
    }


@router.get("/benchmarks/{dataset_name}")
def load_benchmark_dataset(
    dataset_name: str,
    limit: int = Query(50, le=500),
    offset: int = 0,
    current_user: User = Depends(require_permission("read:molecules")),
):
    """
    Load compounds from a specific benchmark dataset.
    dataset_name: 'esol', 'freesolv', or 'lipophilicity'
    """
    from app.services.experimental.benchmark_loaders import BenchmarkAggregator

    aggregator = BenchmarkAggregator()
    all_data = aggregator.load_all()

    if dataset_name not in all_data:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_name}' not found. Available: {list(all_data.keys())}",
        )

    compounds = all_data[dataset_name]
    page = compounds[offset:offset + limit]

    return {
        "dataset": dataset_name,
        "total": len(compounds),
        "offset": offset,
        "limit": limit,
        "compounds": [
            {
                "smiles": c.smiles,
                "experimental_value": c.experimental_value,
                "property": c.property_name,
                "unit": c.unit,
                "name": c.name,
            }
            for c in page
        ],
    }


@router.get("/qspr/training-summary")
def qspr_training_summary(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """
    Get summary of QSPR model training data sources.
    Shows which models are trained on real experimental data vs simulated.
    """
    from app.ml.qspr_engine import qspr_pipeline

    summary = qspr_pipeline.get_training_summary()

    return {
        "models": summary,
        "data_sources": {
            "real_experimental": [
                "ESOL (1,128 compounds) — aqueous solubility",
                "FreeSolv (642 compounds) — hydration free energy",
                "Lipophilicity (4,200 compounds) — LogD at pH 7.4",
                "ChEMBL (2.3M compounds) — experimental assay data",
                "PubChem (115M compounds) — physicochemical properties",
                "NIST WebBook — thermodynamic reference data",
            ],
            "note": "Models trained on real experimental data have higher confidence "
                    "and better applicability domain than rule-based or simulated data.",
        },
    }


@router.post("/chembl/search")
def search_chembl(
    query: str,
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_permission("read:molecules")),
):
    """Search ChEMBL for compounds with experimental data."""
    from app.services.experimental.chembl_experimental import ChEMBLExperimentalLoader

    loader = ChEMBLExperimentalLoader()
    results = loader.search_compounds(query, limit=limit)

    return {
        "query": query,
        "count": len(results),
        "compounds": results,
        "source": "ChEMBL (ebi.ac.uk/chembl)",
    }


@router.get("/chembl/{chembl_id}")
def get_chembl_experimental(
    chembl_id: str,
    current_user: User = Depends(require_permission("read:molecules")),
):
    """Get experimental data for a specific ChEMBL compound."""
    from app.services.experimental.chembl_experimental import ChEMBLExperimentalLoader

    loader = ChEMBLExperimentalLoader()
    data = loader.fetch_stability_data(chembl_id)

    if not data:
        raise HTTPException(status_code=404, detail=f"ChEMBL compound '{chembl_id}' not found")

    return data


@router.get("/pubchem/{cid}")
def get_pubchem_experimental(
    cid: int,
    current_user: User = Depends(require_permission("read:molecules")),
):
    """Get experimental data for a specific PubChem compound (by CID)."""
    from app.services.experimental.pubchem_experimental import PubChemExperimentalLoader

    loader = PubChemExperimentalLoader()
    data = loader.fetch_by_cid(cid)

    if not data:
        raise HTTPException(status_code=404, detail=f"PubChem CID {cid} not found")

    return {
        "cid": cid,
        "properties": data.get("properties", {}),
        "experimental": data.get("experimental", {}),
        "safety": data.get("safety", {}),
        "provenance": data.get("provenance", []),
        "measurements": loader.to_experimental_measurements(data),
    }
