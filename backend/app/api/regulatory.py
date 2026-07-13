"""
Regulatory Compliance API — ICH Standards, 21 CFR Part 11, CTD Reports.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel

from app.core.security import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/regulatory", tags=["Regulatory Compliance"])


# ── Schemas ────────────────────────────────────────────────────────────

class M7AssessmentRequest(BaseModel):
    smiles: str
    compound_name: str = ""
    ames_test_result: Optional[str] = None  # "positive", "negative"
    daily_dose_mg: float = 100.0


class RiskAssessmentRequest(BaseModel):
    product_name: str
    process_name: str
    hazards: List[dict]  # [{hazard, harm, severity, probability, detectability, controls, responsible}]
    conducted_by: str
    reviewed_by: str
    approved_by: str


class SignatureRequest(BaseModel):
    record_type: str
    record_id: int
    record_content: str
    meaning: str = "Reviewed and Approved"


class DoERequest(BaseModel):
    factors: List[dict]  # [{name, unit, low_level, high_level, center_point}]
    responses: Optional[List[dict]] = None
    design_type: str = "central_composite"


class CTDReportRequest(BaseModel):
    product_name: str
    product_type: str = "drug_product"
    dosage_form: str = "solution"
    strength: str = ""
    container_closure: str = ""
    manufacturer: str = ""
    batch_number: str = ""
    batch_size: str = ""
    manufacturing_date: str = ""
    storage_conditions: List[dict] = []
    time_points: List[dict] = []
    test_methods: List[str] = []
    shelf_life_months: Optional[int] = None
    conclusion: str = ""
    m7_assessment: Optional[dict] = None


# ── ICH M7: Mutagenic Impurities ──────────────────────────────────────

@router.post("/ich-m7/assess")
def assess_mutagenic_impurity(
    request: M7AssessmentRequest,
    current_user: User = Depends(require_permission("execute:analysis")),
):
    """
    ICH M7(R1) mutagenic impurity assessment.
    Detects structural alerts and classifies impurity (Class 1-5).
    Returns TTC threshold and control strategy.
    """
    from app.regulatory.ich_standards import ich_m7

    result = ich_m7.assess_compound(
        smiles=request.smiles,
        compound_name=request.compound_name,
        ames_result=request.ames_test_result,
        daily_dose_mg=request.daily_dose_mg,
    )

    return {
        "compound": result.compound_name,
        "smiles": result.smiles,
        "impurity_class": result.impurity_class.value,
        "structural_alerts": [
            {"name": a.alert_name, "description": a.description, "severity": a.severity}
            for a in result.structural_alerts
        ],
        "ames_test": result.ames_test_result,
        "ttc_threshold_ng_day": result.ttc_threshold_ng_day,
        "acceptable_intake_ug_day": result.acceptable_intake_ug_day,
        "control_strategy": result.control_strategy,
        "justification": result.justification,
        "ich_reference": result.ich_reference,
    }


@router.get("/ich-m7/alerts")
def list_m7_alerts(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """List all ICH M7 structural alerts for mutagenicity."""
    from app.regulatory.ich_standards import M7_STRUCTURAL_ALERTS

    return {
        "alerts": [
            {
                "name": a.alert_name,
                "smarts": a.smarts_pattern,
                "description": a.description,
                "severity": a.severity,
                "ttc_ng_day": a.ttc_threshold_ng_day,
            }
            for a in M7_STRUCTURAL_ALERTS
        ],
        "count": len(M7_STRUCTURAL_ALERTS),
        "ich_reference": "ICH M7(R1) Appendix 3",
    }


# ── ICH Q9: Quality Risk Management ──────────────────────────────────

@router.post("/ich-q9/assess")
def perform_risk_assessment(
    request: RiskAssessmentRequest,
    current_user: User = Depends(require_permission("execute:analysis")),
):
    """
    ICH Q9 Quality Risk Management — FMEA-style risk assessment.
    Returns Risk Priority Numbers (RPN) and control strategies.
    """
    from app.regulatory.ich_standards import ich_q9

    risk_items = []
    for i, h in enumerate(request.hazards):
        item = ich_q9.assess_risk(
            risk_id=f"R-{i+1:03d}",
            hazard=h.get("hazard", ""),
            harm=h.get("harm", ""),
            severity=h.get("severity", 3),
            probability=h.get("probability", 3),
            detectability=h.get("detectability", 3),
            control_measures=h.get("controls", []),
            responsible=h.get("responsible", ""),
        )
        risk_items.append(item)

    assessment = ich_q9.create_assessment(
        product_name=request.product_name,
        process_name=request.process_name,
        risk_items=risk_items,
        conducted_by=request.conducted_by,
        reviewed_by=request.reviewed_by,
        approved_by=request.approved_by,
    )

    return {
        "assessment_id": assessment.assessment_id,
        "overall_risk_level": assessment.overall_risk_level,
        "risk_items": [
            {
                "id": r.risk_id,
                "hazard": r.hazard,
                "severity": r.severity,
                "probability": r.probability,
                "detectability": r.detectability,
                "rpn": r.rpn,
                "risk_level": r.risk_level,
                "controls": r.control_measures,
                "residual_risk": r.residual_risk,
                "justification": r.justification,
            }
            for r in assessment.risk_items
        ],
        "conclusion": assessment.conclusion,
        "ich_reference": "ICH Q9",
    }


# ── ICH Q8: Design of Experiments ────────────────────────────────────

@router.post("/ich-q8/doe")
def generate_doe_design(
    request: DoERequest,
    current_user: User = Depends(require_permission("execute:analysis")),
):
    """
    ICH Q8 Design of Experiments.
    Generate factorial, CCD, or Box-Behnken design matrices.
    """
    from app.regulatory.ich_standards import ich_q8, DoEFactor

    factors = [
        DoEFactor(
            name=f["name"],
            unit=f.get("unit", ""),
            low_level=f["low_level"],
            high_level=f["high_level"],
            center_point=f.get("center_point", (f["low_level"] + f["high_level"]) / 2),
        )
        for f in request.factors
    ]

    if request.design_type == "full_factorial":
        design = ich_q8.generate_full_factorial(factors)
    elif request.design_type == "central_composite":
        design = ich_q8.generate_center_composite(factors)
    elif request.design_type == "box_behnken":
        design = ich_q8.generate_box_behnken(factors)
    else:
        design = ich_q8.generate_full_factorial(factors)

    return {
        "design_type": request.design_type,
        "n_factors": len(factors),
        "n_experiments": len(design),
        "factors": [{"name": f.name, "range": [f.low_level, f.high_level]} for f in factors],
        "design_matrix": design,
        "ich_reference": "ICH Q8(R2)",
    }


# ── 21 CFR Part 11: Electronic Signatures ────────────────────────────

@router.post("/cfr-part11/sign")
def apply_electronic_signature(
    request: SignatureRequest,
    current_user: User = Depends(require_permission("approve:reports")),
):
    """
    Apply a 21 CFR Part 11 compliant electronic signature.
    §11.50: Signature includes printed name, date/time, meaning.
    §11.70: Signature is cryptographically linked to the record.
    """
    from app.regulatory.cfr_part11 import cfr_part11

    signature = cfr_part11.create_signature(
        record_type=request.record_type,
        record_id=request.record_id,
        record_content=request.record_content,
        signed_by=current_user.id,
        signed_by_name=current_user.full_name or current_user.username,
        meaning=request.meaning,
        ip_address="",
        user_agent="",
    )

    return {
        "signature_id": signature.signature_id,
        "record_type": signature.record_type,
        "record_id": signature.record_id,
        "signed_by": signature.signed_by_name,
        "signed_at": signature.signed_at,
        "meaning": signature.meaning,
        "signature_hash": signature.signature_hash,
        "record_hash": signature.record_hash,
        "is_qualified": signature.is_qualified,
        "ich_reference": "21 CFR Part 11 §11.50",
    }


@router.post("/cfr-part11/verify")
def verify_signature(
    record_type: str,
    record_id: int,
    record_content: str,
    current_user: User = Depends(require_permission("read:reports")),
):
    """Verify an electronic signature against the current record."""
    from app.regulatory.cfr_part11 import cfr_part11

    is_valid, signature = cfr_part11.verify_signature(record_type, record_id, record_content)

    return {
        "is_valid": is_valid,
        "signature": {
            "signed_by": signature.signed_by_name if signature else None,
            "signed_at": signature.signed_at if signature else None,
            "meaning": signature.meaning if signature else None,
        },
    }


@router.get("/cfr-part11/audit-trail")
def get_audit_trail(
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    limit: int = 100,
    current_user: User = Depends(require_permission("read:audit_log")),
):
    """Get the immutable audit trail with cryptographic chain verification."""
    from app.regulatory.cfr_part11 import cfr_part11

    entries = cfr_part11.get_audit_trail(resource_type=resource_type, resource_id=resource_id, limit=limit)
    chain_valid, errors = cfr_part11.verify_audit_trail()

    return {
        "entries": [
            {
                "id": e.entry_id,
                "timestamp": e.timestamp,
                "user": e.user_name,
                "action": e.action,
                "resource": f"{e.resource_type}:{e.resource_id}",
                "description": e.description,
                "hash": e.entry_hash[:16] + "...",
            }
            for e in entries
        ],
        "chain_integrity": "VALID" if chain_valid else "INVALID",
        "errors": errors,
    }


@router.get("/cfr-part11/compliance-report")
def compliance_report(
    current_user: User = Depends(require_permission("read:audit_log")),
):
    """Generate 21 CFR Part 11 compliance status report."""
    from app.regulatory.cfr_part11 import cfr_part11

    return cfr_part11.generate_compliance_report()


# ── IQ/OQ/PQ Validation ──────────────────────────────────────────────

@router.get("/validation/iq-protocol")
def get_iq_protocol(
    current_user: User = Depends(require_permission("*")),
):
    """Generate Installation Qualification (IQ) protocol."""
    from app.regulatory.cfr_part11 import cfr_part11

    return cfr_part11.generate_iq_protocol("ChemStab Industrial", "5.2.0")


@router.get("/validation/oq-protocol")
def get_oq_protocol(
    current_user: User = Depends(require_permission("*")),
):
    """Generate Operational Qualification (OQ) protocol."""
    from app.regulatory.cfr_part11 import cfr_part11

    return cfr_part11.generate_oq_protocol("ChemStab Industrial", "5.2.0")


@router.get("/validation/pq-protocol")
def get_pq_protocol(
    current_user: User = Depends(require_permission("*")),
):
    """Generate Performance Qualification (PQ) protocol."""
    from app.regulatory.cfr_part11 import cfr_part11

    return cfr_part11.generate_pq_protocol("ChemStab Industrial", "5.2.0")


# ── CTD Report Generation ────────────────────────────────────────────

@router.post("/ctd/generate")
def generate_ctd_report(
    request: CTDReportRequest,
    current_user: User = Depends(require_permission("write:reports")),
):
    """
    Generate CTD Module 3.2.P.8 stability report.
    ICH-compliant format for FDA/EMA/NMPA/PMDA submissions.
    """
    from app.regulatory.ctd_reports import ctd_generator, StabilityReportData

    data = StabilityReportData(
        product_name=request.product_name,
        product_type=request.product_type,
        dosage_form=request.dosage_form,
        strength=request.strength,
        container_closure=request.container_closure,
        manufacturer=request.manufacturer,
        batch_number=request.batch_number,
        batch_size=request.batch_size,
        manufacturing_date=request.manufacturing_date,
        storage_conditions=request.storage_conditions,
        time_points=request.time_points,
        test_methods=request.test_methods,
        shelf_life_months=request.shelf_life_months,
        conclusion=request.conclusion,
        m7_assessment=request.m7_assessment,
    )

    report = ctd_generator.generate_json_report(data)

    return report


# ── ICH Storage Conditions Reference ─────────────────────────────────

@router.get("/ich-q1a/storage-conditions")
def list_ich_storage_conditions(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """List all ICH Q1A(R2) storage conditions by climate zone."""
    from app.regulatory.ich_standards import ICH_STORAGE_CONDITIONS

    return {
        "conditions": {
            k: {
                "name": v.name,
                "zone": v.zone.value if v.zone else None,
                "temperature_c": v.temperature_c,
                "humidity_percent": v.humidity_percent,
                "duration_months": v.duration_months,
                "study_type": v.study_type,
                "description": v.description,
                "ich_reference": v.ich_reference,
            }
            for k, v in ICH_STORAGE_CONDITIONS.items()
        },
        "ich_reference": "ICH Q1A(R2)",
    }


# ── Pharmacopoeia Reference ──────────────────────────────────────────

@router.get("/pharmacopoeia")
def list_pharmacopoeia(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """List available pharmacopoeia references."""
    from app.regulatory.ctd_reports import PHARMACOPOEIA_DATA

    return {
        "pharmacopoeias": PHARMACOPOEIA_DATA,
        "note": "Monograph access requires separate subscription. USP ~$2,500/yr, EP ~$800/yr.",
    }


# ── Level 4 Capabilities ─────────────────────────────────────────────

@router.get("/capabilities")
def regulatory_capabilities(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """List all regulatory compliance capabilities."""
    return {
        "ich_standards": {
            "Q1A_R2": "Stability testing by climate zone (I-IVb)",
            "Q1B": "Photostability testing",
            "Q1E": "Evaluation of stability data",
            "Q8_R2": "Design of Experiments (DoE)",
            "Q9": "Quality Risk Management (FMEA, RPN)",
            "M7_R1": "Mutagenic impurity assessment (Class 1-5, TTC)",
        },
        "cfr_part_11": {
            "electronic_signatures": "§11.50, §11.70, §11.100",
            "audit_trail": "§11.10(e) — immutable, cryptographically chained",
            "validation": "IQ/OQ/PQ protocols per GAMP 5",
            "data_integrity": "ALCOA+ principles",
        },
        "reports": {
            "ctd_module_3_2_P_8": "ICH stability report for regulatory submission",
            "pharmacopoeia": ["USP", "EP", "JP"],
        },
        "mutagenicity": {
            "smart_alerts": "14 ICH M7 structural alerts",
            "vega_qsar": "Open-source alternative to Derek Nexus",
            "ttc_calculation": "Automatic TTC threshold calculation",
        },
    }
