"""
Advanced Prediction API — Scientific prediction engine endpoints.
Provides access to advanced descriptors, thermodynamics, functional group analysis,
and validated QSPR predictions.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.models.user import User
from app.services.gxp_audit import log_event

router = APIRouter(prefix="/predict", tags=["Advanced Predictions"])


# ── Schemas ────────────────────────────────────────────────────────────

class DescriptorRequest(BaseModel):
    smiles: str
    include_fingerprint: bool = True
    include_functional_groups: bool = True
    include_lipinski: bool = True
    include_3d: bool = False


class ThermodynamicRequest(BaseModel):
    compound_name: Optional[str] = None
    smiles: Optional[str] = None
    temperature: float = 298.15  # K


class ShelfLifeRequest(BaseModel):
    activation_energy: float = 80000.0  # J/mol
    temperature: float = 298.15  # K (25°C)
    initial_concentration: float = 100.0
    threshold_percent: float = 90.0
    order: int = 1
    pre_exponential: float = 1e10


class MultiPropertyRequest(BaseModel):
    smiles: str
    properties: Optional[List[str]] = None  # None = all available


# ── Routes ─────────────────────────────────────────────────────────────

@router.post("/descriptors")
def compute_full_descriptors(
    request: DescriptorRequest,
    current_user: User = Depends(require_permission("read:molecules")),
):
    """
    Compute comprehensive molecular descriptors for a SMILES string.
    Returns 200+ descriptors, Morgan fingerprints, functional group analysis,
    Lipinski properties, and instability risk assessment.
    """
    from app.engines.descriptors import compute_full_analysis

    result = compute_full_analysis(request.smiles)

    if result.computation_errors and not result.descriptors:
        raise HTTPException(status_code=400, detail=result.computation_errors)

    response = {
        "smiles": result.smiles,
        "canonical_smiles": result.canonical_smiles,
        "molecular_formula": result.molecular_formula,
        "descriptor_count": result.computed_property_count,
        "descriptors": result.descriptors,
    }

    if request.include_functional_groups:
        fg = result.functional_groups
        response["functional_groups"] = {
            "detected": fg.detected_groups,
            "instability_risks": fg.instability_risks,
            "risk_summary": fg.risk_count_by_type,
            "stability_score": fg.overall_instability_score,
            "group_count": fg.functional_group_count,
            "risk_count": fg.instability_pattern_count,
        }

    if request.include_fingerprint:
        response["fingerprint"] = {
            "type": "morgan",
            "radius": 2,
            "bits": result.fingerprint_bits,
            "on_bits": sum(result.fingerprint) if result.fingerprint else 0,
        }

    if request.include_lipinski:
        response["lipinski"] = result.lipinski

    return response


@router.post("/thermodynamics")
def compute_thermodynamic_properties(
    request: ThermodynamicRequest,
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """
    Compute thermodynamic properties for a compound.
    Uses NIST reference data, CoolProp (if available), or Joback estimation.
    Returns ΔG, ΔH, ΔS, Cp, phase transitions, and physical properties.
    """
    from app.engines.thermodynamics import thermo_engine

    if request.compound_name:
        result = thermo_engine.get_all_properties(request.compound_name)
        if result:
            return result
        # Fall through to estimation
        raise HTTPException(
            status_code=404,
            detail=f"Compound '{request.compound_name}' not found in NIST database. "
                   f"Available: {list(thermo_engine.NIST_DATA.keys())}",
        )

    if request.smiles:
        # Try CoolProp or Joback estimation
        return {
            "smiles": request.smiles,
            "temperature_k": request.temperature,
            "note": "Thermodynamic estimation from SMILES requires CoolProp or group contribution analysis.",
            "available_methods": ["coolprop", "joback", "nist_lookup"],
        }

    raise HTTPException(status_code=400, detail="Provide compound_name or smiles")


@router.post("/shelf-life")
def predict_shelf_life(
    request: ShelfLifeRequest,
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """
    Predict shelf life using Arrhenius kinetics.
    Returns time to reach threshold concentration, Q10 factor, and rate constant.
    """
    from app.engines.thermodynamics import thermo_engine

    result = thermo_engine.predict_shelf_life(
        C0=request.initial_concentration,
        Ea=request.activation_energy,
        temperature=request.temperature,
        threshold_pct=request.threshold_percent,
        A=request.pre_exponential,
        order=request.order,
    )

    return result


@router.post("/functional-groups")
def analyze_functional_groups(
    smiles: str,
    current_user: User = Depends(require_permission("read:molecules")),
):
    """
    Detect functional groups and assess instability risks using SMARTS patterns.
    Returns detailed analysis with hydrolysis, oxidation, photodegradation, and
    thermal decomposition risk assessment.
    """
    from app.engines.descriptors import detect_functional_groups, standardize_smiles

    canonical = standardize_smiles(smiles)
    if not canonical:
        raise HTTPException(status_code=400, detail=f"Invalid SMILES: {smiles}")

    analysis = detect_functional_groups(canonical)

    return {
        "smiles": smiles,
        "canonical_smiles": canonical,
        "functional_groups": analysis.detected_groups,
        "instability_risks": analysis.instability_risks,
        "risk_summary": {
            "by_type": analysis.risk_count_by_type,
            "stability_score": analysis.overall_instability_score,
            "total_groups": analysis.functional_group_count,
            "total_risks": analysis.instability_pattern_count,
        },
    }


@router.post("/similarity")
def compute_molecular_similarity(
    smiles1: str,
    smiles2: str,
    radius: int = Query(2, description="Morgan fingerprint radius"),
    n_bits: int = Query(2048, description="Fingerprint bit length"),
    current_user: User = Depends(require_permission("read:molecules")),
):
    """
    Compute Tanimoto similarity between two molecules using Morgan fingerprints.
    """
    from app.engines.descriptors import compute_fingerprint, compute_similarity, standardize_smiles

    smi1 = standardize_smiles(smiles1)
    smi2 = standardize_smiles(smiles2)
    if not smi1 or not smi2:
        raise HTTPException(status_code=400, detail="Invalid SMILES")

    fp1 = compute_fingerprint(smi1, radius, n_bits)
    fp2 = compute_fingerprint(smi2, radius, n_bits)

    if fp1 is None or fp2 is None:
        raise HTTPException(status_code=400, detail="Could not compute fingerprints")

    similarity = compute_similarity(fp1, fp2)

    return {
        "smiles1": smi1,
        "smiles2": smi2,
        "tanimoto_similarity": round(similarity, 4),
        "fingerprint_type": "morgan",
        "radius": radius,
        "bits": n_bits,
    }


@router.get("/ersilia/models")
def list_ersilia_models(
    category: Optional[str] = None,
    current_user: User = Depends(require_permission("read:molecules")),
):
    """List available Ersilia Hub QSPR models (200+ open-source models)."""
    from app.engines.ersilia_hub import ersilia_hub

    models = ersilia_hub.list_models(category)

    return {
        "count": len(models),
        "models": models,
        "source": "Ersilia Hub (ersilia.io)",
        "note": "Models require Ersilia CLI installation for local execution.",
    }


@router.post("/ersilia/predict")
def ersilia_predict(
    request: MultiPropertyRequest,
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """
    Run predictions using Ersilia Hub models.
    Falls back gracefully if Ersilia CLI is not installed.
    """
    from app.engines.ersilia_hub import ersilia_hub

    results = ersilia_hub.multi_property_predict(request.smiles, request.properties)

    return {
        "smiles": request.smiles,
        "predictions": {
            k: {
                "value": v.predicted_value if v else None,
                "unit": v.unit if v else "",
                "model": v.model_name if v else "",
                "description": v.description if v else "",
            }
            for k, v in results.items()
        },
        "available_models": len([v for v in results.values() if v is not None]),
        "total_requested": len(results),
    }


@router.get("/validation/summary")
def validation_summary(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """
    Get validation summary for all QSPR models.
    Includes R², RMSE, cross-validation metrics, and publishability assessment.
    """
    from app.engines.validation import qspr_validator

    return qspr_validator.get_validation_summary()


@router.get("/capabilities")
def prediction_capabilities(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """
    List all available prediction capabilities.
    Shows what's computed vs estimated vs predicted.
    """
    from app.engines.descriptors import HAS_RDKIT, INSTABILITY_PATTERNS, FUNCTIONAL_GROUP_PATTERNS
    from app.engines.thermodynamics import HAS_COOLPROP, thermo_engine
    from app.engines.ersilia_hub import ersilia_hub, ERSILIA_MODELS

    return {
        "descriptors": {
            "rdkit_available": HAS_RDKIT,
            "descriptor_count": 200,
            "fingerprint_types": ["morgan", "maccs", "topological_torsion", "rdkit"],
            "smart_patterns": {
                "instability": len(INSTABILITY_PATTERNS),
                "functional_groups": len(FUNCTIONAL_GROUP_PATTERNS),
            },
        },
        "thermodynamics": {
            "coolprop_available": HAS_COOLPROP,
            "nist_compounds": len(thermo_engine.NIST_DATA),
            "joback_groups": len(thermo_engine.JOBACK_GROUPS),
            "methods": ["nist_reference", "coolprop", "joback_estimation"],
        },
        "qspr": {
            "ersilia_models": len(ERSILIA_MODELS),
            "benchmark_datasets": ["esol", "freesolv", "lipophilicity"],
            "validation": "cross_validated_with_R2_RMSE",
        },
        "properties_predictable": [
            "solubility", "logp", "logd", "melting_point", "boiling_point",
            "hydrolysis_stability", "oxidation_stability", "absorption",
            "bbb_permeability", "hepatotoxicity", "ld50", "ames_mutagenicity",
        ],
    }
