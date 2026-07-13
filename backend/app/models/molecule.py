"""
Molecule model — Chemical database with molecular descriptors for QSPR.
Supports 100,000+ molecules from ChEMBL/PubChem.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON, Text, Index, LargeBinary
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Molecule(Base):
    """
    Master molecule table. Each record = one unique chemical entity.
    Linked to ChEMBL/PubChem for provenance.
    """
    __tablename__ = "molecules"

    id = Column(Integer, primary_key=True, index=True)

    # ── Identifiers ────────────────────────────────────────────────────
    name = Column(String(500), nullable=False, index=True)
    cas_number = Column(String(20), index=True)
    iupac_name = Column(String(1000))
    smiles = Column(Text, index=True)
    inchi = Column(Text)
    inchi_key = Column(String(27), unique=True, index=True)  # Fixed-length InChIKey
    canonical_smiles = Column(Text)

    # ── External references ────────────────────────────────────────────
    chembl_id = Column(String(20), unique=True, index=True)  # e.g., CHEMBL25
    pubchem_cid = Column(Integer, unique=True, index=True)
    drugbank_id = Column(String(20))

    # ── Basic properties ───────────────────────────────────────────────
    formula = Column(String(200))
    molar_mass = Column(Float)  # g/mol
    exact_mass = Column(Float)
    logp = Column(Float)  # Partition coefficient
    logd = Column(Float)  # Distribution coefficient at pH 7.4
    pka_acid = Column(Float)
    pka_base = Column(Float)
    psa = Column(Float)  # Polar surface area (Å²)
    hbd = Column(Integer)  # H-bond donors
    hba = Column(Integer)  # H-bond acceptors
    rotatable_bonds = Column(Integer)
    aromatic_rings = Column(Integer)
    heavy_atom_count = Column(Integer)
    formal_charge = Column(Integer)

    # ── Solubility & physical ──────────────────────────────────────────
    solubility_water = Column(Float)  # mg/L or g/L
    solubility_unit = Column(String(20), default="mg/L")
    melting_point = Column(Float)  # °C
    boiling_point = Column(Float)  # °C
    density = Column(Float)  # g/cm³
    vapor_pressure = Column(Float)  # mmHg
    henrys_law_constant = Column(Float)  # atm·m³/mol

    # ── Stability-related properties ───────────────────────────────────
    oxidation_sensitivity = Column(Float, default=0.0)  # 0-1
    hydrolysis_sensitivity = Column(Float, default=0.0)  # 0-1
    light_sensitivity = Column(Float, default=0.0)  # 0-1
    thermal_sensitivity = Column(Float, default=0.0)  # 0-1
    ph_optimal = Column(Float, default=7.0)
    temp_optimal = Column(Float, default=25.0)

    # ── Functional flags ───────────────────────────────────────────────
    is_reducing_sugar = Column(Boolean, default=False)
    is_amino_acid = Column(Boolean, default=False)
    is_chelator = Column(Boolean, default=False)
    is_strong_oxidizer = Column(Boolean, default=False)
    is_reductant = Column(Boolean, default=False)
    is_acid = Column(Boolean, default=False)
    is_base = Column(Boolean, default=False)
    is_salt = Column(Boolean, default=False)
    is_solvent = Column(Boolean, default=False)
    is_polymer = Column(Boolean, default=False)
    is_surfactant = Column(Boolean, default=False)
    is_preservative = Column(Boolean, default=False)
    is_antioxidant = Column(Boolean, default=False)
    is_excipient = Column(Boolean, default=False)
    is_active_ingredient = Column(Boolean, default=False)

    # ── Classification ─────────────────────────────────────────────────
    therapeutic_area = Column(String(200))  # e.g., "Cardiovascular, Oncology"
    max_phase = Column(Float)  # ChEMBL max_phase (0=preclinical, 1-4=clinical phases)
    first_approval = Column(Integer)  # Year of first approval
    oral = Column(Boolean)
    parenteral = Column(Boolean)
    topical = Column(Boolean)

    # ── Molecular descriptors (stored as JSON for flexibility) ─────────
    # 200+ descriptors computed by RDKit
    descriptors = Column(JSON)  # {"MolWt": 180.16, "TPSA": 110.0, ...}
    fingerprints = Column(LargeBinary)  # Morgan fingerprint as binary

    # ── QSPR predictions (cached) ─────────────────────────────────────
    predicted_stability_score = Column(Float)
    predicted_degradation_rate = Column(Float)
    predicted_solubility_class = Column(String(50))  # "very_soluble", "soluble", "slightly_soluble", "insoluble"
    prediction_confidence = Column(Float)
    prediction_model_version = Column(String(50))
    prediction_date = Column(DateTime(timezone=True))

    # ── Data provenance ────────────────────────────────────────────────
    data_source = Column(String(100))  # "chembl", "pubchem", "manual", "literature"
    data_quality_score = Column(Float)  # 0-1, confidence in data accuracy
    last_verified_at = Column(DateTime(timezone=True))

    # ── Metadata ───────────────────────────────────────────────────────
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    substance_links = relationship("Substance", back_populates="molecule", lazy="dynamic")

    __table_args__ = (
        Index("idx_molecule_name_trgm", "name", postgresql_using="gin",
              postgresql_ops={"name": "gin_trgm_ops"}),
        Index("idx_molecule_smiles_trgm", "canonical_smiles", postgresql_using="gin",
              postgresql_ops={"canonical_smiles": "gin_trgm_ops"}),
    )


class MoleculeAlias(Base):
    """Alternative names / synonyms for molecules."""
    __tablename__ = "molecule_aliases"

    id = Column(Integer, primary_key=True, index=True)
    molecule_id = Column(Integer, ForeignKey("molecules.id"), nullable=False, index=True)
    alias = Column(String(500), nullable=False, index=True)
    alias_type = Column(String(50))  # "trade_name", "inn", "abbreviation", "common"

    molecule = relationship("Molecule")


class Substance(Base):
    """Substance within a project — links a molecule to a specific formulation."""
    __tablename__ = "substances"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    molecule_id = Column(Integer, ForeignKey("molecules.id"), nullable=True, index=True)

    name = Column(String(300), nullable=False)  # Display name (may differ from molecule name)
    cas_number = Column(String(20))
    formula = Column(String(200))
    molar_mass = Column(Float)

    # Formulation details
    concentration = Column(Float)
    concentration_unit = Column(String(30), default="g/L")  # mg/L, g/L, %, mol/L, ppm, mM
    purity = Column(Float, default=100.0)  # %
    grade = Column(String(50))  # "USP", "EP", "Pharma", "Technical", "AR"
    supplier = Column(String(200))
    lot_number = Column(String(100))
    expiry_date = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="substances")
    molecule = relationship("Molecule", back_populates="substance_links")
