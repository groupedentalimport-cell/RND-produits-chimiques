"""
Stability Study API — ICH Q1A-Q1F compliant stability study management.

Endpoints:
  POST   /stability/simulate              — Run single-condition simulation
  POST   /stability/protocol              — Run full ICH protocol (multi-condition)
  POST   /stability/extrapolate           — Arrhenius extrapolation from accelerated data
  POST   /stability/monte-carlo           — Monte Carlo uncertainty analysis
  POST   /stability/molecular-risk        — Structure-based degradation risk
  GET    /stability/conditions            — List ICH storage conditions
  GET    /stability/conditions/{zone}     — Get conditions for a climate zone
  POST   /stability/studies               — Create and persist a study
  GET    /stability/studies               — List studies
  GET    /stability/studies/{id}          — Get study detail
  PUT    /stability/studies/{id}/status   — Update study status (review/approve/reject)
  POST   /stability/studies/{id}/sign     — Electronic signature (21 CFR Part 11)
  POST   /stability/studies/{id}/timepoint — Add measurement time point
  GET    /stability/studies/{id}/report   — Generate stability report
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, require_permission, compute_electronic_signature
from app.models.user import User
from app.models.stability_study import (
    StabilityStudy, StabilityTimePoint, DegradationResult, SimulationRun,
    StudyType, StudyStatus, DegradationOrder, ClimateZone, ContainerType,
)
from app.engines.stability_simulator import (
    simulate_stability,
    simulate_ich_protocol,
    extrapolate_from_accelerated,
    monte_carlo_shelf_life,
    assess_molecular_stability_risk,
    ICH_CONDITIONS,
    arrhenius_k,
    arrhenius_extrapolate,
    q10_factor,
    ea_from_two_temps,
)

router = APIRouter(prefix="/stability", tags=["Stability Study"])


# ═══════════════════════════════════════════════════════════════════════
# Request / Response Schemas
# ═══════════════════════════════════════════════════════════════════════

class SimulationRequest(BaseModel):
    """Single-condition stability simulation."""
    substance_name: str = Field(..., description="Name of the substance")
    initial_concentration: float = Field(..., gt=0, description="Initial concentration")
    concentration_unit: str = Field("mg/mL", description="Concentration unit")
    temperature_c: float = Field(25.0, description="Storage temperature (°C)")
    humidity_percent: Optional[float] = Field(60.0, description="Storage humidity (%RH)")
    activation_energy: float = Field(50000.0, gt=0, description="Arrhenius Ea (J/mol)")
    pre_exponential_factor: float = Field(1e8, gt=0, description="Arrhenius A factor")
    kinetic_order: int = Field(1, ge=0, le=2, description="Degradation order (0, 1, 2)")
    duration_months: int = Field(36, gt=0, description="Study duration in months")
    time_points_months: Optional[List[int]] = Field(None, description="Custom time points (months)")
    spec_lower: float = Field(90.0, description="Lower spec limit (% of initial)")
    humidity_effect_factor: float = Field(0.0, description="Extra degradation rate per %RH above 60%")
    condition_code: str = Field("CUSTOM", description="Condition identifier")
    condition_description: str = Field("Custom condition", description="Human-readable description")


class ProtocolRequest(BaseModel):
    """Full ICH protocol simulation."""
    substance_name: str
    initial_concentration: float = Field(..., gt=0)
    concentration_unit: str = "mg/mL"
    activation_energy: float = Field(50000.0, gt=0)
    pre_exponential_factor: float = Field(1e8, gt=0)
    kinetic_order: int = Field(1, ge=0, le=2)
    climate_zone: str = Field("II", description="ICH climate zone (I, II, III, IVa, IVb)")
    spec_lower: float = Field(90.0)
    include_stress: bool = Field(True, description="Include stress testing conditions")
    include_photostability: bool = Field(False, description="Include ICH Q1B photostability")


class ExtrapolationRequest(BaseModel):
    """Arrhenius extrapolation from accelerated to storage conditions."""
    accelerated_rate_constant: float = Field(..., gt=0, description="k at accelerated T (day⁻¹)")
    accelerated_temperature_c: float = Field(40.0, description="Accelerated temperature (°C)")
    storage_temperature_c: float = Field(25.0, description="Target storage temperature (°C)")
    activation_energy: float = Field(50000.0, gt=0, description="Ea (J/mol)")
    kinetic_order: int = Field(1, ge=0, le=2)
    confidence_factor: float = Field(0.8, ge=0, le=1)


class MonteCarloRequest(BaseModel):
    """Monte Carlo uncertainty analysis."""
    mean_activation_energy: float = Field(50000.0, gt=0, description="Mean Ea (J/mol)")
    std_activation_energy: float = Field(5000.0, gt=0, description="Std dev of Ea (J/mol)")
    mean_pre_exponential: float = Field(1e8, gt=0, description="Mean A factor")
    std_pre_exponential: float = Field(1e7, gt=0, description="Std dev of A factor")
    temperature_c: float = Field(25.0)
    kinetic_order: int = Field(1, ge=0, le=2)
    n_simulations: int = Field(1000, ge=100, le=100000)
    confidence_level: float = Field(0.95, ge=0.9, le=0.999)


class MolecularRiskRequest(BaseModel):
    """Structure-based degradation risk assessment."""
    smiles: Optional[str] = Field(None, description="SMILES string")
    descriptors: Optional[Dict[str, float]] = Field(None, description="Precomputed descriptors")


class StudyCreateRequest(BaseModel):
    """Create and persist a stability study."""
    project_id: int
    molecule_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    substance_name: str
    cas_number: Optional[str] = None
    batch_number: Optional[str] = None
    initial_concentration: float = Field(..., gt=0)
    concentration_unit: str = "mg/mL"
    initial_purity: float = Field(100.0, ge=0, le=100)
    study_type: str = Field(..., description="long_term|accelerated|intermediate|stress|photostability")
    climate_zone: Optional[str] = Field(None, description="I|II|III|IVa|IVb")
    temperature_c: float
    humidity_percent: Optional[float] = None
    light_condition: Optional[str] = None
    container_type: Optional[str] = None
    headspace_gas: str = "air"
    planned_duration_months: int = Field(..., gt=0)
    study_start_date: Optional[datetime] = None
    degradation_order: str = "first"
    activation_energy: Optional[float] = None
    pre_exponential_factor: Optional[float] = None
    spec_lower: float = 90.0
    spec_upper: float = 110.0

    # Auto-simulate on creation
    run_simulation: bool = Field(True, description="Run simulation automatically on creation")


class TimePointRequest(BaseModel):
    """Add a measurement time point to a study."""
    time_days: float = Field(..., ge=0)
    assay_percent: Optional[float] = None
    impurity_total: Optional[float] = None
    impurity_largest: Optional[float] = None
    dissolution_percent: Optional[float] = None
    moisture_content: Optional[float] = None
    ph_value: Optional[float] = None
    color_clarity: Optional[str] = None
    appearance: Optional[str] = None
    weight_change: Optional[float] = None
    melting_point_measured: Optional[float] = None
    custom_params: Optional[Dict[str, Any]] = None
    analyst: Optional[str] = None
    method_reference: Optional[str] = None
    notes: Optional[str] = None


class StatusUpdateRequest(BaseModel):
    """Update study status."""
    status: str = Field(..., description="draft|in_progress|completed|under_review|approved|rejected")
    rejection_reason: Optional[str] = None


class SignatureRequest(BaseModel):
    """Electronic signature per 21 CFR Part 11."""
    meaning: str = Field("Reviewed and Approved", description="Signature meaning")


class TwoTempEaRequest(BaseModel):
    """Derive Ea from two temperature experiments."""
    k1: float = Field(..., gt=0, description="Rate constant at T1 (day⁻¹)")
    temperature1_c: float = Field(..., description="Temperature 1 (°C)")
    k2: float = Field(..., gt=0, description="Rate constant at T2 (day⁻¹)")
    temperature2_c: float = Field(..., description="Temperature 2 (°C)")


# ═══════════════════════════════════════════════════════════════════════
# Simulation Endpoints
# ═══════════════════════════════════════════════════════════════════════

@router.post("/simulate")
def run_simulation(
    request: SimulationRequest,
    current_user: User = Depends(require_permission("execute:analysis")),
):
    """
    Run a single-condition stability simulation.
    
    Simulates time-dependent molecular degradation using Arrhenius kinetics.
    Computes shelf life (t90/t95/t99), regression analysis (ICH Q1E),
    and confidence intervals.
    """
    result = simulate_stability(
        substance_name=request.substance_name,
        initial_concentration=request.initial_concentration,
        concentration_unit=request.concentration_unit,
        temperature_c=request.temperature_c,
        humidity_percent=request.humidity_percent,
        activation_energy=request.activation_energy,
        pre_exponential_factor=request.pre_exponential_factor,
        kinetic_order=request.kinetic_order,
        duration_months=request.duration_months,
        time_points_months=request.time_points_months,
        spec_lower=request.spec_lower,
        humidity_effect_factor=request.humidity_effect_factor,
        condition_code=request.condition_code,
        condition_description=request.condition_description,
    )

    return {
        "status": "success",
        "simulation": _result_to_dict(result),
    }


@router.post("/protocol")
def run_ich_protocol(
    request: ProtocolRequest,
    current_user: User = Depends(require_permission("execute:analysis")),
):
    """
    Run a complete ICH stability protocol for a given climate zone.
    
    Generates parallel simulations for:
    - Long-term storage (zone-specific)
    - Accelerated (40°C/75% RH)
    - Intermediate (30°C/65% RH)
    - Stress tests (thermal, humidity, oxidative)
    - Photostability (optional, ICH Q1B)
    """
    try:
        zone = ClimateZone(request.climate_zone)
    except ValueError:
        raise HTTPException(400, f"Invalid climate zone: {request.climate_zone}. Use I, II, III, IVa, or IVb")

    results = simulate_ich_protocol(
        substance_name=request.substance_name,
        initial_concentration=request.initial_concentration,
        concentration_unit=request.concentration_unit,
        activation_energy=request.activation_energy,
        pre_exponential_factor=request.pre_exponential_factor,
        kinetic_order=request.kinetic_order,
        climate_zone=zone,
        spec_lower=request.spec_lower,
        include_stress=request.include_stress,
        include_photostability=request.include_photostability,
    )

    return {
        "status": "success",
        "climate_zone": request.climate_zone,
        "conditions_simulated": list(results.keys()),
        "simulations": {k: _result_to_dict(v) for k, v in results.items()},
        "summary": _protocol_summary(results),
    }


@router.post("/extrapolate")
def run_extrapolation(
    request: ExtrapolationRequest,
    current_user: User = Depends(require_permission("execute:analysis")),
):
    """
    Extrapolate shelf life from accelerated conditions to storage conditions.
    
    Uses Arrhenius equation to predict long-term stability from short-term
    accelerated data. This is the core of ICH Q1E evaluation.
    """
    result = extrapolate_from_accelerated(
        accelerated_k=request.accelerated_rate_constant,
        accelerated_temp_c=request.accelerated_temperature_c,
        storage_temp_c=request.storage_temperature_c,
        Ea=request.activation_energy,
        kinetic_order=request.kinetic_order,
        confidence_factor=request.confidence_factor,
    )

    return {
        "status": "success",
        "extrapolation": {
            "accelerated_shelf_life_days": result.accelerated_shelf_life_days,
            "extrapolated_shelf_life_days": result.extrapolated_shelf_life_days,
            "extrapolated_shelf_life_months": result.extrapolated_shelf_life_months,
            "activation_energy": result.activation_energy,
            "q10_value": result.q10_value,
            "temperature_gap": result.temperature_gap,
            "confidence_factor": result.confidence_factor,
            "method": result.method,
        },
    }


@router.post("/monte-carlo")
def run_monte_carlo(
    request: MonteCarloRequest,
    current_user: User = Depends(require_permission("execute:analysis")),
):
    """
    Monte Carlo uncertainty propagation for shelf-life prediction.
    
    Samples Ea and A from normal distributions, computes shelf life for
    each sample, and returns confidence intervals.
    """
    result = monte_carlo_shelf_life(
        mean_Ea=request.mean_activation_energy,
        std_Ea=request.std_activation_energy,
        mean_A=request.mean_pre_exponential,
        std_A=request.std_pre_exponential,
        temperature_c=request.temperature_c,
        kinetic_order=request.kinetic_order,
        n_simulations=request.n_simulations,
        confidence_level=request.confidence_level,
    )

    return {"status": "success", "monte_carlo": result}


@router.post("/molecular-risk")
def assess_molecular_risk(
    request: MolecularRiskRequest,
    current_user: User = Depends(require_permission("execute:analysis")),
):
    """
    Assess degradation risk from molecular structure.
    
    Uses SMARTS pattern matching to identify degradation-prone functional groups
    and scores each degradation pathway (hydrolysis, oxidation, photolysis, etc.).
    """
    result = assess_molecular_stability_risk(
        smiles=request.smiles,
        descriptors=request.descriptors,
    )
    return {"status": "success", "risk_assessment": result}


@router.post("/derive-ea")
def derive_activation_energy(
    request: TwoTempEaRequest,
    current_user: User = Depends(require_permission("execute:analysis")),
):
    """
    Derive activation energy (Ea) from rate constants at two temperatures.
    
    Useful when you have experimental data at two temperatures and need
    to compute Ea for Arrhenius extrapolation.
    """
    try:
        ea = ea_from_two_temps(request.k1, request.temperature1_c, request.k2, request.temperature2_c)
    except ValueError as e:
        raise HTTPException(400, str(e))

    q10 = q10_factor(request.temperature1_c, ea)

    return {
        "status": "success",
        "activation_energy_jmol": round(ea, 1),
        "activation_energy_kjmol": round(ea / 1000, 2),
        "q10_at_t1": round(q10, 3),
        "temperature_range": f"{request.temperature1_c}°C — {request.temperature2_c}°C",
    }


# ═══════════════════════════════════════════════════════════════════════
# ICH Conditions Reference
# ═══════════════════════════════════════════════════════════════════════

@router.get("/conditions")
def list_ich_conditions(
    study_type: Optional[str] = Query(None, description="Filter by study type"),
    zone: Optional[str] = Query(None, description="Filter by climate zone"),
):
    """
    List all available ICH storage conditions.
    Optionally filter by study type or climate zone.
    """
    conditions = []
    for code, cond in ICH_CONDITIONS.items():
        if study_type and cond.study_type.value != study_type:
            continue
        if zone and (cond.zone is None or cond.zone.value != zone):
            continue
        conditions.append({
            "code": code,
            "name": cond.name,
            "temperature_c": cond.temperature_c,
            "humidity_percent": cond.humidity_percent,
            "duration_months": cond.duration_months,
            "time_points_months": cond.time_points_months,
            "study_type": cond.study_type.value,
            "zone": cond.zone.value if cond.zone else None,
            "ich_reference": cond.ich_reference,
            "description": cond.description,
        })

    return {"conditions": conditions, "count": len(conditions)}


@router.get("/conditions/{zone}")
def get_zone_conditions(zone: str):
    """
    Get all ICH conditions for a specific climate zone.
    Returns long-term, accelerated, and intermediate conditions.
    """
    try:
        cz = ClimateZone(zone)
    except ValueError:
        raise HTTPException(400, f"Invalid zone: {zone}. Use I, II, III, IVa, or IVb")

    zone_conditions = {}
    for code, cond in ICH_CONDITIONS.items():
        if cond.zone == cz or cond.zone is None:
            zone_conditions[code] = {
                "name": cond.name,
                "temperature_c": cond.temperature_c,
                "humidity_percent": cond.humidity_percent,
                "duration_months": cond.duration_months,
                "time_points_months": cond.time_points_months,
                "study_type": cond.study_type.value,
                "ich_reference": cond.ich_reference,
                "description": cond.description,
            }

    return {"climate_zone": zone, "conditions": zone_conditions}


# ═══════════════════════════════════════════════════════════════════════
# Study CRUD (Persist to DB)
# ═══════════════════════════════════════════════════════════════════════

@router.post("/studies")
def create_study(
    request: StudyCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("write:own_projects")),
):
    """
    Create a stability study and optionally run the simulation.
    
    Persists the study to the database with full audit trail.
    If run_simulation=True, automatically generates simulation data
    and computes predicted shelf life.
    """
    # Generate unique study code
    year = datetime.now().year
    count = db.query(StabilityStudy).filter(
        StabilityStudy.study_code.like(f"STB-{year}-%")
    ).count()
    study_code = f"STB-{year}-{count + 1:04d}"

    # Parse enums
    try:
        st = StudyType(request.study_type)
    except ValueError:
        raise HTTPException(400, f"Invalid study_type: {request.study_type}")

    cz = None
    if request.climate_zone:
        try:
            cz = ClimateZone(request.climate_zone)
        except ValueError:
            raise HTTPException(400, f"Invalid climate_zone: {request.climate_zone}")

    co = None
    if request.container_type:
        try:
            co = ContainerType(request.container_type)
        except ValueError:
            raise HTTPException(400, f"Invalid container_type: {request.container_type}")

    do = DegradationOrder.FIRST
    if request.degradation_order:
        try:
            do = DegradationOrder(request.degradation_order)
        except ValueError:
            raise HTTPException(400, f"Invalid degradation_order: {request.degradation_order}")

    # Build ICH reference
    ich_ref = _build_ich_reference(st, cz)

    study = StabilityStudy(
        project_id=request.project_id,
        molecule_id=request.molecule_id,
        created_by=current_user.id,
        study_code=study_code,
        title=request.title,
        description=request.description,
        substance_name=request.substance_name,
        cas_number=request.cas_number,
        batch_number=request.batch_number,
        initial_concentration=request.initial_concentration,
        concentration_unit=request.concentration_unit,
        initial_purity=request.initial_purity,
        study_type=st,
        climate_zone=cz,
        temperature_c=request.temperature_c,
        humidity_percent=request.humidity_percent,
        light_condition=request.light_condition,
        container_type=co,
        headspace_gas=request.headspace_gas,
        planned_duration_months=request.planned_duration_months,
        study_start_date=request.study_start_date,
        degradation_order=do,
        activation_energy=request.activation_energy,
        pre_exponential_factor=request.pre_exponential_factor,
        spec_lower=request.spec_lower,
        spec_upper=request.spec_upper,
        ich_reference=ich_ref,
        status=StudyStatus.DRAFT,
    )

    db.add(study)
    db.flush()  # get study.id

    # ── Auto-simulate ──────────────────────────────────────────────────
    simulation_output = None
    if request.run_simulation and request.activation_energy and request.pre_exponential_factor:
        from app.engines.stability_simulator import simulate_stability as sim

        result = sim(
            substance_name=request.substance_name,
            initial_concentration=request.initial_concentration,
            concentration_unit=request.concentration_unit,
            temperature_c=request.temperature_c,
            humidity_percent=request.humidity_percent,
            activation_energy=request.activation_energy,
            pre_exponential_factor=request.pre_exponential_factor,
            kinetic_order=request.degradation_order,
            duration_months=request.planned_duration_months,
            spec_lower=request.spec_lower,
            condition_code=st.value,
            condition_description=f"{request.temperature_c}°C / {request.humidity_percent}% RH" if request.humidity_percent else f"{request.temperature_c}°C",
            ich_reference=ich_ref,
        )

        # Update study with simulation results
        study.predicted_shelf_life_days = result.shelf_life_days
        study.predicted_shelf_life_months = result.shelf_life_months
        study.predicted_t90_days = result.t90_days
        study.predicted_t95_days = result.t95_days
        study.rate_constant_at_storage = result.rate_constant
        study.regression_slope = result.regression_slope
        study.regression_intercept = result.regression_intercept
        study.regression_r_squared = result.regression_r_squared
        study.confidence_interval_lower = result.confidence_interval_lower
        study.confidence_interval_upper = result.confidence_interval_upper
        study.simulation_confidence = result.regression_r_squared

        # Store full simulation data
        simulation_output = _result_to_dict(result)
        study.simulation_data = simulation_output

        # Persist simulation run
        sim_run = SimulationRun(
            study_id=study.id,
            scenario_name="Auto-simulation on creation",
            simulation_type="arrhenius_kinetic",
            input_params={
                "temperature_c": request.temperature_c,
                "humidity_percent": request.humidity_percent,
                "activation_energy": request.activation_energy,
                "pre_exponential_factor": request.pre_exponential_factor,
                "kinetic_order": request.degradation_order,
            },
            time_series={
                "days": [tp["time_days"] for tp in simulation_output["time_points"]],
                "concentration": [tp["concentration"] for tp in simulation_output["time_points"]],
                "degradation_pct": [tp["degradation_percent"] for tp in simulation_output["time_points"]],
            },
            shelf_life_days=result.shelf_life_days,
            shelf_life_months=result.shelf_life_months,
            t90_days=result.t90_days,
            t95_days=result.t95_days,
            ci_lower_days=result.confidence_interval_lower,
            ci_upper_days=result.confidence_interval_upper,
        )
        db.add(sim_run)

    db.commit()
    db.refresh(study)

    return {
        "status": "success",
        "study": {
            "id": study.id,
            "study_code": study.study_code,
            "title": study.title,
            "substance_name": study.substance_name,
            "study_type": study.study_type.value,
            "climate_zone": study.climate_zone.value if study.climate_zone else None,
            "temperature_c": study.temperature_c,
            "humidity_percent": study.humidity_percent,
            "predicted_shelf_life_days": study.predicted_shelf_life_days,
            "predicted_shelf_life_months": study.predicted_shelf_life_months,
            "status": study.status.value,
        },
        "simulation": simulation_output,
    }


@router.get("/studies")
def list_studies(
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    study_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List stability studies with optional filters."""
    query = db.query(StabilityStudy)

    if project_id:
        query = query.filter(StabilityStudy.project_id == project_id)
    if status:
        query = query.filter(StabilityStudy.status == status)
    if study_type:
        query = query.filter(StabilityStudy.study_type == study_type)

    total = query.count()
    studies = query.order_by(StabilityStudy.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "studies": [
            {
                "id": s.id,
                "study_code": s.study_code,
                "title": s.title,
                "substance_name": s.substance_name,
                "study_type": s.study_type.value,
                "climate_zone": s.climate_zone.value if s.climate_zone else None,
                "temperature_c": s.temperature_c,
                "humidity_percent": s.humidity_percent,
                "planned_duration_months": s.planned_duration_months,
                "predicted_shelf_life_days": s.predicted_shelf_life_days,
                "predicted_shelf_life_months": s.predicted_shelf_life_months,
                "status": s.status.value,
                "time_point_count": len(s.time_points),
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in studies
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/studies/{study_id}")
def get_study(
    study_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full study detail including time points, simulation, and degradation results."""
    study = db.query(StabilityStudy).filter(StabilityStudy.id == study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")

    return {
        "study": _study_to_dict(study),
        "time_points": [
            {
                "id": tp.id,
                "time_days": tp.time_days,
                "time_months": tp.time_months,
                "assay_percent": tp.assay_percent,
                "impurity_total": tp.impurity_total,
                "impurity_largest": tp.impurity_largest,
                "dissolution_percent": tp.dissolution_percent,
                "moisture_content": tp.moisture_content,
                "ph_value": tp.ph_value,
                "appearance": tp.appearance,
                "is_oos": tp.is_oos,
                "is_oot": tp.is_oot,
                "analyst": tp.analyst,
                "notes": tp.notes,
                "actual_date": tp.actual_date.isoformat() if tp.actual_date else None,
            }
            for tp in study.time_points
        ],
        "degradation_products": [
            {
                "id": d.id,
                "product_name": d.product_name,
                "degradation_pathway": d.degradation_pathway,
                "formation_rate": d.formation_rate,
                "max_observed": d.max_observed,
                "is_above_threshold": d.is_above_threshold,
            }
            for d in study.degradation_results
        ],
        "simulation_runs": [
            {
                "id": sr.id,
                "scenario_name": sr.scenario_name,
                "simulation_type": sr.simulation_type,
                "shelf_life_days": sr.shelf_life_days,
                "shelf_life_months": sr.shelf_life_months,
                "t90_days": sr.t90_days,
                "ci_lower_days": sr.ci_lower_days,
                "ci_upper_days": sr.ci_upper_days,
                "created_at": sr.created_at.isoformat() if sr.created_at else None,
            }
            for sr in study.simulation_runs
        ],
    }


@router.put("/studies/{study_id}/status")
def update_study_status(
    study_id: int,
    request: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("approve:reports")),
):
    """Update study status (review, approve, reject). Implements GxP workflow."""
    study = db.query(StabilityStudy).filter(StabilityStudy.id == study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")

    try:
        new_status = StudyStatus(request.status)
    except ValueError:
        raise HTTPException(400, f"Invalid status: {request.status}")

    # Status transition validation
    valid_transitions = {
        StudyStatus.DRAFT: [StudyStatus.IN_PROGRESS],
        StudyStatus.IN_PROGRESS: [StudyStatus.COMPLETED],
        StudyStatus.COMPLETED: [StudyStatus.UNDER_REVIEW],
        StudyStatus.UNDER_REVIEW: [StudyStatus.APPROVED, StudyStatus.REJECTED],
        StudyStatus.REJECTED: [StudyStatus.DRAFT],
        StudyStatus.APPROVED: [],  # Terminal state
    }

    allowed = valid_transitions.get(study.status, [])
    if new_status not in allowed:
        raise HTTPException(
            400,
            f"Cannot transition from {study.status.value} to {new_status.value}. "
            f"Allowed: {[s.value for s in allowed]}"
        )

    # Apply transition
    study.status = new_status
    if new_status == StudyStatus.UNDER_REVIEW:
        study.reviewed_by = current_user.id
        study.reviewed_at = datetime.now(timezone.utc)
    elif new_status == StudyStatus.APPROVED:
        study.approved_by = current_user.id
        study.approved_at = datetime.now(timezone.utc)
    elif new_status == StudyStatus.REJECTED:
        study.rejection_reason = request.rejection_reason

    db.commit()

    return {
        "status": "success",
        "study_id": study.id,
        "new_status": study.status.value,
        "message": f"Study status updated to {study.status.value}",
    }


@router.post("/studies/{study_id}/sign")
def sign_study(
    study_id: int,
    request: SignatureRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("approve:reports")),
):
    """
    Apply electronic signature to a study (21 CFR Part 11).
    Only studies in 'approved' status can be signed.
    """
    study = db.query(StabilityStudy).filter(StabilityStudy.id == study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")

    if study.status != StudyStatus.APPROVED:
        raise HTTPException(400, "Only approved studies can be signed")

    # Compute signature
    sig_data = f"{study.study_code}|{study.substance_name}|{study.temperature_c}"
    sig = compute_electronic_signature(sig_data, current_user.id, request.meaning)

    study.signature_hash = sig["signature_hash"]
    study.signature_meaning = request.meaning
    study.signature_timestamp = datetime.now(timezone.utc)

    db.commit()

    return {
        "status": "success",
        "study_id": study.id,
        "signature": {
            "hash": sig["signature_hash"],
            "signed_by": current_user.id,
            "meaning": request.meaning,
            "timestamp": sig["timestamp"],
            "algorithm": "SHA-256",
        },
    }


@router.post("/studies/{study_id}/timepoints")
def add_time_point(
    study_id: int,
    request: TimePointRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("write:own_projects")),
):
    """Add a measurement time point to a study."""
    study = db.query(StabilityStudy).filter(StabilityStudy.id == study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")

    if study.status in (StudyStatus.APPROVED, StudyStatus.REJECTED):
        raise HTTPException(400, "Cannot add time points to finalized studies")

    tp = StabilityTimePoint(
        study_id=study_id,
        time_days=request.time_days,
        time_months=round(request.time_days / 30.44, 2),
        assay_percent=request.assay_percent,
        impurity_total=request.impurity_total,
        impurity_largest=request.impurity_largest,
        dissolution_percent=request.dissolution_percent,
        moisture_content=request.moisture_content,
        ph_value=request.ph_value,
        color_clarity=request.color_clarity,
        appearance=request.appearance,
        weight_change=request.weight_change,
        melting_point_measured=request.melting_point_measured,
        custom_params=request.custom_params,
        analyst=request.analyst,
        method_reference=request.method_reference,
        notes=request.notes,
    )

    # Check OOS
    if request.assay_percent is not None and request.assay_percent < study.spec_lower:
        tp.is_oos = True

    db.add(tp)
    db.commit()

    return {
        "status": "success",
        "time_point_id": tp.id,
        "time_days": tp.time_days,
        "is_oos": tp.is_oos,
    }


@router.get("/studies/{study_id}/report")
def generate_report(
    study_id: int,
    format: str = Query("json", description="json|summary"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a stability study report.
    Includes simulation data, measured time points, regression analysis,
    and regulatory conclusions.
    """
    study = db.query(StabilityStudy).filter(StabilityStudy.id == study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")

    # Build report
    report = {
        "header": {
            "study_code": study.study_code,
            "title": study.title,
            "substance": study.substance_name,
            "cas_number": study.cas_number,
            "batch": study.batch_number,
            "initial_concentration": f"{study.initial_concentration} {study.concentration_unit}",
            "initial_purity": f"{study.initial_purity}%",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generated_by": current_user.id,
        },
        "storage_conditions": {
            "study_type": study.study_type.value,
            "climate_zone": study.climate_zone.value if study.climate_zone else "N/A",
            "temperature": study.temperature_c,
            "temperature_tolerance": study.temperature_tolerance,
            "humidity": study.humidity_percent,
            "humidity_tolerance": study.humidity_tolerance,
            "container": study.container_type.value if study.container_type else "N/A",
            "headspace_gas": study.headspace_gas,
            "ich_reference": study.ich_reference,
        },
        "results": {
            "predicted_shelf_life_days": study.predicted_shelf_life_days,
            "predicted_shelf_life_months": study.predicted_shelf_life_months,
            "t90_days": study.predicted_t90_days,
            "t95_days": study.predicted_t95_days,
        },
        "statistical_analysis": {
            "regression_slope": study.regression_slope,
            "regression_intercept": study.regression_intercept,
            "r_squared": study.regression_r_squared,
            "ci_lower_days": study.confidence_interval_lower,
            "ci_upper_days": study.confidence_interval_upper,
        },
        "measured_data": [
            {
                "time_days": tp.time_days,
                "assay_percent": tp.assay_percent,
                "impurity_total": tp.impurity_total,
                "is_oos": tp.is_oos,
                "is_oot": tp.is_oot,
            }
            for tp in study.time_points
        ],
        "simulation": study.simulation_data,
        "status": study.status.value,
        "signature": {
            "hash": study.signature_hash,
            "meaning": study.signature_meaning,
            "timestamp": study.signature_timestamp.isoformat() if study.signature_timestamp else None,
        },
    }

    if format == "summary":
        return _report_summary(report)

    return report


# ═══════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════

def _result_to_dict(result) -> Dict[str, Any]:
    """Convert SimulationResult to JSON-serializable dict."""
    return {
        "condition_code": result.condition_code,
        "condition_description": result.condition_description,
        "substance_name": result.substance_name,
        "initial_concentration": result.initial_concentration,
        "concentration_unit": result.concentration_unit,
        "temperature_c": result.temperature_c,
        "humidity_percent": result.humidity_percent,
        "kinetic_order": result.kinetic_order,
        "activation_energy": result.activation_energy,
        "rate_constant": result.rate_constant,
        "time_points": [
            {
                "time_days": tp.time_days,
                "time_months": tp.time_months,
                "concentration": tp.concentration,
                "percent_remaining": tp.percent_remaining,
                "degradation_percent": tp.degradation_percent,
                "is_oos": tp.is_oos,
                "is_oot": tp.is_oot,
            }
            for tp in result.time_points
        ],
        "shelf_life_days": result.shelf_life_days,
        "shelf_life_months": result.shelf_life_months,
        "t90_days": result.t90_days,
        "t95_days": result.t95_days,
        "t99_days": result.t99_days,
        "regression": {
            "slope": result.regression_slope,
            "intercept": result.regression_intercept,
            "r_squared": result.regression_r_squared,
            "ci_lower_days": result.confidence_interval_lower,
            "ci_upper_days": result.confidence_interval_upper,
        },
        "simulation_type": result.simulation_type,
        "ich_reference": result.ich_reference,
        "computed_at": result.computed_at,
    }


def _study_to_dict(study) -> Dict[str, Any]:
    """Convert StabilityStudy to dict."""
    return {
        "id": study.id,
        "study_code": study.study_code,
        "title": study.title,
        "description": study.description,
        "substance_name": study.substance_name,
        "cas_number": study.cas_number,
        "batch_number": study.batch_number,
        "initial_concentration": study.initial_concentration,
        "concentration_unit": study.concentration_unit,
        "initial_purity": study.initial_purity,
        "study_type": study.study_type.value,
        "climate_zone": study.climate_zone.value if study.climate_zone else None,
        "temperature_c": study.temperature_c,
        "humidity_percent": study.humidity_percent,
        "container_type": study.container_type.value if study.container_type else None,
        "headspace_gas": study.headspace_gas,
        "planned_duration_months": study.planned_duration_months,
        "degradation_order": study.degradation_order.value,
        "activation_energy": study.activation_energy,
        "pre_exponential_factor": study.pre_exponential_factor,
        "rate_constant_at_storage": study.rate_constant_at_storage,
        "spec_lower": study.spec_lower,
        "spec_upper": study.spec_upper,
        "predicted_shelf_life_days": study.predicted_shelf_life_days,
        "predicted_shelf_life_months": study.predicted_shelf_life_months,
        "predicted_t90_days": study.predicted_t90_days,
        "predicted_t95_days": study.predicted_t95_days,
        "simulation_confidence": study.simulation_confidence,
        "regression_slope": study.regression_slope,
        "regression_r_squared": study.regression_r_squared,
        "confidence_interval_lower": study.confidence_interval_lower,
        "confidence_interval_upper": study.confidence_interval_upper,
        "ich_reference": study.ich_reference,
        "status": study.status.value,
        "created_at": study.created_at.isoformat() if study.created_at else None,
    }


def _protocol_summary(results: Dict) -> Dict[str, Any]:
    """Generate summary of multi-condition protocol results."""
    summary = {
        "conditions": len(results),
        "shelf_lives": {},
        "critical_findings": [],
    }

    for code, result in results.items():
        summary["shelf_lives"][code] = {
            "shelf_life_days": result.shelf_life_days,
            "shelf_life_months": result.shelf_life_months,
        }

        # Flag conditions where shelf life < planned duration
        if result.shelf_life_days and result.shelf_life_days < 365:
            summary["critical_findings"].append(
                f"⚠️ {code}: shelf life only {result.shelf_life_days:.0f} days "
                f"({result.shelf_life_months:.1f} months)"
            )

        # Flag OOS time points
        oos_count = sum(1 for tp in result.time_points if tp.is_oos)
        if oos_count > 0:
            summary["critical_findings"].append(
                f"🔴 {code}: {oos_count} out-of-specification time points"
            )

    return summary


def _report_summary(report: Dict) -> Dict[str, Any]:
    """Generate a condensed report summary."""
    return {
        "study": report["header"]["study_code"],
        "substance": report["header"]["substance"],
        "condition": report["storage_conditions"]["ich_reference"],
        "shelf_life": report["results"]["predicted_shelf_life_months"],
        "r_squared": report["statistical_analysis"]["r_squared"],
        "status": report["status"],
        "conclusion": _conclusion_text(report),
    }


def _conclusion_text(report: Dict) -> str:
    """Generate regulatory conclusion text."""
    sl = report["results"].get("predicted_shelf_life_months")
    r2 = report["statistical_analysis"].get("r_squared")

    if sl is None:
        return "Insufficient data for shelf-life determination"
    if r2 and r2 > 0.95:
        return f"High-confidence shelf life: {sl:.1f} months (R²={r2:.3f})"
    elif r2 and r2 > 0.8:
        return f"Estimated shelf life: {sl:.1f} months (R²={r2:.3f}) — additional data recommended"
    else:
        return f"Preliminary estimate: {sl:.1f} months (R²={r2:.3f}) — low confidence, further studies required"


def _build_ich_reference(study_type: StudyType, zone: Optional[ClimateZone]) -> str:
    """Build ICH reference string."""
    if study_type == StudyType.LONG_TERM and zone:
        zone_refs = {
            ClimateZone.ZONE_I: "ICH Q1A(R2) §2.1.1",
            ClimateZone.ZONE_II: "ICH Q1A(R2) §2.1.2",
            ClimateZone.ZONE_III: "ICH Q1A(R2) §2.1.3",
            ClimateZone.ZONE_IVA: "ICH Q1A(R2) §2.1.4",
            ClimateZone.ZONE_IVB: "ICH Q1A(R2) §2.1.5",
        }
        return zone_refs.get(zone, "ICH Q1A(R2)")
    elif study_type == StudyType.ACCELERATED:
        return "ICH Q1A(R2) §2.2"
    elif study_type == StudyType.INTERMEDIATE:
        return "ICH Q1A(R2) §2.2"
    elif study_type == StudyType.STRESS:
        return "ICH Q1A(R2) §2.5"
    elif study_type == StudyType.PHOTOSTABILITY:
        return "ICH Q1B"
    return "ICH Q1A(R2)"
