"""
Project & Analysis models — Multi-tenant with full audit trail.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String(300), nullable=False)
    code = Column(String(50), index=True)  # Project code (e.g., "PRJ-2026-001")
    description = Column(Text)
    product_type = Column(String(100))  # pharmaceutical, cosmetic, industrial, agrochemical
    formulation_type = Column(String(100))  # solution, suspension, emulsion, tablet, capsule
    target_market = Column(String(100))  # "FDA", "EMA", "NMPA", "PMDA", "TGA"

    # Status
    status = Column(String(50), default="draft")  # draft, active, under_review, approved, archived
    version = Column(String(20), default="1.0")

    # GxP
    is_gxp_critical = Column(Boolean, default=False)
    regulatory_submission_id = Column(String(100))  # e.g., NDA/ANDA/BLA number
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    organization = relationship("Organization", back_populates="projects")
    owner = relationship("User", back_populates="projects", foreign_keys=[owner_id])
    substances = relationship("Substance", back_populates="project", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="project", cascade="all, delete-orphan")


class Analysis(Base):
    """Stability analysis run — one per project iteration."""
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String(300))
    analysis_type = Column(String(50), default="stability")  # stability, compatibility, accelerated
    status = Column(String(30), default="pending")  # pending, running, completed, failed, cancelled

    # Parameters
    ph = Column(Float)
    conductivity = Column(Float)  # mS/cm
    ionic_strength = Column(Float)  # mol/L
    osmolarity = Column(Float)  # mOsm/L
    redox_potential = Column(Float)  # mV
    viscosity = Column(Float)  # cP
    density = Column(Float)  # g/mL

    # Results
    overall_score = Column(Float)
    risk_level = Column(String(30))  # low, moderate, high, critical
    results = Column(JSON)

    # QSPR/ML predictions
    qspr_predictions = Column(JSON)
    ml_model_version = Column(String(50))
    ml_confidence = Column(Float)

    # Kinetics
    kinetics_results = Column(JSON)
    predicted_shelf_life_days = Column(Float)
    predicted_shelf_life_months = Column(Float)

    # Accelerated stability
    accelerated_conditions = Column(JSON)

    # Packaging
    container_type = Column(String(50))
    container_compatibility = Column(JSON)

    # GxP: Electronic signature
    is_signed = Column(Boolean, default=False)
    signed_by = Column(Integer, ForeignKey("users.id"))
    signed_at = Column(DateTime(timezone=True))
    signature_hash = Column(String(64))
    signature_meaning = Column(String(200))

    # Report
    report_generated = Column(Boolean, default=False)
    report_format = Column(String(20))  # pdf, docx, xlsx
    report_path = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    # Relationships
    project = relationship("Project", back_populates="analyses")


class ShelfLifeStudy(Base):
    """Accelerated and long-term stability studies (ICH Q1A)."""
    __tablename__ = "shelf_life_studies"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False, index=True)
    study_type = Column(String(50))  # "long_term", "accelerated", "intermediate", "stress"

    # ICH conditions
    temperature = Column(Float)  # °C
    humidity = Column(Float)  # %RH
    duration_months = Column(Integer)
    time_points = Column(JSON)  # [{"month": 0, "result": 99.2}, ...]

    # Results
    degradation_rate = Column(Float)  # %/month
    activation_energy = Column(Float)  # kJ/mol
    q10_factor = Column(Float)
    shelf_life_months = Column(Float)
    confidence_interval = Column(JSON)  # {"lower": 18, "upper": 24}

    created_at = Column(DateTime(timezone=True), server_default=func.now())
