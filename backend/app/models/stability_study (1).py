"""
Stability Study ORM Models — ICH Q1A-Q1F compliant.
Persists stability studies, time points, degradation measurements,
and statistical evaluations for regulatory submissions.
"""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey,
    JSON, Text, Enum as SAEnum, Index, Numeric
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


# ── Enums ──────────────────────────────────────────────────────────────

class StudyType(str, enum.Enum):
    LONG_TERM = "long_term"
    ACCELERATED = "accelerated"
    INTERMEDIATE = "intermediate"
    STRESS = "stress"
    PHOTOSTABILITY = "photostability"
    ZONE_CUSTOM = "zone_custom"


class StudyStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class DegradationOrder(str, enum.Enum):
    ZERO = "zero"
    FIRST = "first"
    SECOND = "second"


class ClimateZone(str, enum.Enum):
    ZONE_I = "I"
    ZONE_II = "II"
    ZONE_III = "III"
    ZONE_IVA = "IVa"
    ZONE_IVB = "IVb"


class ContainerType(str, enum.Enum):
    GLASS_CLEAR = "glass_clear"
    GLASS_AMBER = "glass_amber"
    HDPE = "hdpe"
    PET = "pet"
    ALUMINIUM = "aluminium"
    BLISTER_PVC_PVDC = "blister_pvc_pvdc"
    BOTTLE_POLYMER = "bottle_polymer"


# ── Main Study ─────────────────────────────────────────────────────────

class StabilityStudy(Base):
    """
    Master record for a stability study.
    One study = one substance (or formulation) under one storage condition.
    Groups multiple time-point measurements.
    """
    __tablename__ = "stability_studies"

    id = Column(Integer, primary_key=True, index=True)

    # ── Ownership ──────────────────────────────────────────────────────
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    molecule_id = Column(Integer, ForeignKey("molecules.id"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # ── Study identification ───────────────────────────────────────────
    study_code = Column(String(50), unique=True, nullable=False, index=True)  # e.g., STB-2025-001
    title = Column(String(500), nullable=False)
    description = Column(Text)

    # ── Substance ──────────────────────────────────────────────────────
    substance_name = Column(String(300), nullable=False)
    cas_number = Column(String(20))
    batch_number = Column(String(100))
    initial_concentration = Column(Float, nullable=False)  # mg/mL or %
    concentration_unit = Column(String(30), default="mg/mL")
    initial_purity = Column(Float, default=100.0)  # %

    # ── Storage conditions ─────────────────────────────────────────────
    study_type = Column(SAEnum(StudyType), nullable=False)
    climate_zone = Column(SAEnum(ClimateZone), nullable=True)
    temperature_c = Column(Float, nullable=False)  # °C
    temperature_tolerance = Column(Float, default=2.0)  # ± °C
    humidity_percent = Column(Float, nullable=True)  # % RH
    humidity_tolerance = Column(Float, default=5.0)  # ± % RH
    light_condition = Column(String(100), nullable=True)  # "D65", "ICH_Q1B", "dark_control"
    container_type = Column(SAEnum(ContainerType), nullable=True)
    headspace_gas = Column(String(50), default="air")  # "air", "N2", "Ar"

    # ── Study duration ─────────────────────────────────────────────────
    planned_duration_months = Column(Integer, nullable=False)  # e.g., 36
    study_start_date = Column(DateTime(timezone=True))
    study_end_date = Column(DateTime(timezone=True))

    # ── Kinetic model ──────────────────────────────────────────────────
    degradation_order = Column(SAEnum(DegradationOrder), default=DegradationOrder.FIRST)
    activation_energy = Column(Float, nullable=True)  # J/mol (Arrhenius Ea)
    pre_exponential_factor = Column(Float, nullable=True)  # A (Arrhenius)
    rate_constant_at_storage = Column(Float, nullable=True)  # k at storage T

    # ── Thresholds ─────────────────────────────────────────────────────
    spec_lower = Column(Float, default=90.0)  # % of initial — lower spec limit
    spec_upper = Column(Float, default=110.0)  # % of initial — upper spec limit
    degradation_threshold = Column(Float, default=5.0)  # max acceptable % degradation

    # ── Simulation results (cached) ───────────────────────────────────
    predicted_shelf_life_days = Column(Float)
    predicted_shelf_life_months = Column(Float)
    predicted_t90_days = Column(Float)  # time to 90% of initial
    predicted_t95_days = Column(Float)  # time to 95% of initial
    simulation_confidence = Column(Float)  # 0-1
    simulation_data = Column(JSON)  # full simulation output

    # ── Statistical evaluation (ICH Q1E) ──────────────────────────────
    regression_slope = Column(Float)  # % per month
    regression_intercept = Column(Float)
    regression_r_squared = Column(Float)
    regression_p_value = Column(Float)
    confidence_interval_lower = Column(Float)  # shelf life CI lower (days)
    confidence_interval_upper = Column(Float)  # shelf life CI upper (days)
    statistical_data = Column(JSON)  # full regression output

    # ── Regulatory ─────────────────────────────────────────────────────
    ich_reference = Column(String(200))  # e.g., "ICH Q1A(R2) §2.1.2"
    zone_description = Column(String(500))  # human-readable condition

    # ── Status & Approval ──────────────────────────────────────────────
    status = Column(SAEnum(StudyStatus), default=StudyStatus.DRAFT)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True))
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)

    # ── Electronic signature (21 CFR Part 11) ─────────────────────────
    signature_hash = Column(String(64))
    signature_meaning = Column(String(200))
    signature_timestamp = Column(DateTime(timezone=True))

    # ── Metadata ───────────────────────────────────────────────────────
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships ──────────────────────────────────────────────────
    time_points = relationship("StabilityTimePoint", back_populates="study",
                               cascade="all, delete-orphan", order_by="StabilityTimePoint.time_days")
    degradation_results = relationship("DegradationResult", back_populates="study",
                                       cascade="all, delete-orphan")
    simulation_runs = relationship("SimulationRun", back_populates="study",
                                   cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_study_project", "project_id"),
        Index("idx_study_molecule", "molecule_id"),
        Index("idx_study_status", "status"),
        Index("idx_study_type_zone", "study_type", "climate_zone"),
    )


# ── Time Points ────────────────────────────────────────────────────────

class StabilityTimePoint(Base):
    """
    Individual time-point measurement within a stability study.
    Each row = one assay at one time point.
    """
    __tablename__ = "stability_time_points"

    id = Column(Integer, primary_key=True, index=True)
    study_id = Column(Integer, ForeignKey("stability_studies.id"), nullable=False, index=True)

    # ── Time ───────────────────────────────────────────────────────────
    time_days = Column(Float, nullable=False)  # days from study start
    time_months = Column(Float)  # convenience (time_days / 30.44)
    planned_date = Column(DateTime(timezone=True))
    actual_date = Column(DateTime(timezone=True))

    # ── Measurements ───────────────────────────────────────────────────
    assay_percent = Column(Float)  # % of initial (label claim)
    impurity_total = Column(Float)  # % total impurities
    impurity_largest = Column(Float)  # % largest single impurity
    dissolution_percent = Column(Float)  # % dissolved (if applicable)
    moisture_content = Column(Float)  # %
    ph_value = Column(Float)
    color_clarity = Column(String(100))
    appearance = Column(String(200))
    weight_change = Column(Float)  # % weight change

    # ── Physical measurements ──────────────────────────────────────────
    melting_point_measured = Column(Float)  # °C
    particle_size_d50 = Column(Float)  # µm
    hardness = Column(Float)  # N (tablets)
    friability = Column(Float)  # %

    # ── Custom attributes ──────────────────────────────────────────────
    custom_params = Column(JSON)  # {"viscosity": 1.2, "refractive_index": 1.33, ...}

    # ── Quality flags ──────────────────────────────────────────────────
    is_oos = Column(Boolean, default=False)  # Out of Specification
    is_oot = Column(Boolean, default=False)  # Out of Trend
    oos_investigation = Column(Text)

    # ── Notes ──────────────────────────────────────────────────────────
    analyst = Column(String(200))
    method_reference = Column(String(300))
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    study = relationship("StabilityStudy", back_populates="time_points")


# ── Degradation Results ────────────────────────────────────────────────

class DegradationResult(Base):
    """
    Identified degradation products and their kinetics.
    One row per degradation pathway per study.
    """
    __tablename__ = "degradation_results"

    id = Column(Integer, primary_key=True, index=True)
    study_id = Column(Integer, ForeignKey("stability_studies.id"), nullable=False, index=True)

    # ── Degradation product ────────────────────────────────────────────
    product_name = Column(String(300))
    product_smiles = Column(Text)
    product_cas = Column(String(20))
    degradation_pathway = Column(String(100))  # "hydrolysis", "oxidation", "photolysis", "thermal"

    # ── Kinetics ───────────────────────────────────────────────────────
    formation_rate = Column(Float)  # % per day
    max_observed = Column(Float)  # max % observed
    threshold = Column(Float)  # ICH identification threshold (%)
    is_above_threshold = Column(Boolean, default=False)

    # ── Identification ─────────────────────────────────────────────────
    identification_method = Column(String(200))  # "LC-MS", "NMR", "GC-MS"
    retention_time = Column(Float)  # min
    mass_spec_data = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    study = relationship("StabilityStudy", back_populates="degradation_results")


# ── Simulation Runs ────────────────────────────────────────────────────

class SimulationRun(Base):
    """
    Records of simulation runs with full input/output for reproducibility.
    Supports multiple simulation scenarios per study (what-if analysis).
    """
    __tablename__ = "simulation_runs"

    id = Column(Integer, primary_key=True, index=True)
    study_id = Column(Integer, ForeignKey("stability_studies.id"), nullable=False, index=True)

    # ── Simulation config ──────────────────────────────────────────────
    scenario_name = Column(String(200))  # "Base case", "Worst case", "Zone IVb"
    simulation_type = Column(String(50))  # "arrhenius", "monte_carlo", "accelerated_extrapolation"
    input_params = Column(JSON)  # full input snapshot

    # ── Results ────────────────────────────────────────────────────────
    time_series = Column(JSON)  # {"days": [...], "concentration": [...], "degradation_pct": [...]}
    shelf_life_days = Column(Float)
    shelf_life_months = Column(Float)
    t90_days = Column(Float)
    t95_days = Column(Float)
    t99_days = Column(Float)

    # ── Confidence ─────────────────────────────────────────────────────
    confidence_level = Column(Float, default=0.95)  # 95% CI
    ci_lower_days = Column(Float)
    ci_upper_days = Column(Float)
    rmse = Column(Float)  # Root Mean Square Error of fit

    # ── Accelerated conditions linkage ─────────────────────────────────
    accelerated_study_id = Column(Integer, ForeignKey("stability_studies.id"), nullable=True)
    extrapolation_method = Column(String(100))  # "arrhenius", "eyring", "wolczkowski"

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    study = relationship("StabilityStudy", back_populates="simulation_runs",
                         foreign_keys=[study_id])
