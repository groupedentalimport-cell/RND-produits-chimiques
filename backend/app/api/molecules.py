"""
Molecule API — Search, browse, and manage the chemical database.
Supports ChEMBL/PubChem import, SMILES search, descriptor viewing.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.models.molecule import Molecule, MoleculeAlias
from app.models.user import User
from app.engines.descriptors import (
    compute_descriptors, compute_lipinski_properties,
    compute_fingerprint_bits, standardize_smiles
)
from app.services.gxp_audit import log_event

router = APIRouter(prefix="/molecules", tags=["Molecules"])


# ── Schemas ────────────────────────────────────────────────────────────

class MoleculeCreate(BaseModel):
    name: str
    smiles: str
    cas_number: Optional[str] = None
    formula: Optional[str] = None
    molar_mass: Optional[float] = None
    logp: Optional[float] = None
    solubility_water: Optional[float] = None
    melting_point: Optional[float] = None
    oxidation_sensitivity: Optional[float] = 0.0
    hydrolysis_sensitivity: Optional[float] = 0.0
    light_sensitivity: Optional[float] = 0.0
    category: Optional[str] = None


class MoleculeResponse(BaseModel):
    id: int
    name: str
    chembl_id: Optional[str]
    smiles: Optional[str]
    canonical_smiles: Optional[str]
    formula: Optional[str]
    molar_mass: Optional[float]
    logp: Optional[float]
    psa: Optional[float]
    hbd: Optional[int]
    hba: Optional[int]
    max_phase: Optional[float]
    descriptors: Optional[dict]
    data_source: Optional[str]
    predicted_stability_score: Optional[float]
    prediction_confidence: Optional[float]

    class Config:
        from_attributes = True


class MoleculeSearchRequest(BaseModel):
    query: Optional[str] = None
    smiles: Optional[str] = None
    cas_number: Optional[str] = None
    chembl_id: Optional[str] = None
    min_mw: Optional[float] = None
    max_mw: Optional[float] = None
    drug_like_only: bool = False
    limit: int = 50
    offset: int = 0


# ── Routes ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[MoleculeResponse])
def list_molecules(
    limit: int = Query(50, le=200),
    offset: int = 0,
    source: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("read:molecules")),
):
    """List molecules in the database."""
    query = db.query(Molecule)
    if source:
        query = query.filter(Molecule.data_source == source)
    molecules = query.order_by(Molecule.name).offset(offset).limit(limit).all()
    return molecules


@router.get("/{molecule_id}", response_model=MoleculeResponse)
def get_molecule(
    molecule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("read:molecules")),
):
    """Get molecule details including descriptors and predictions."""
    mol = db.query(Molecule).filter(Molecule.id == molecule_id).first()
    if not mol:
        raise HTTPException(status_code=404, detail="Molecule not found")

    log_event(
        db=db, user_id=current_user.id, org_id=current_user.org_id,
        event_type="READ", resource_type="Molecule", resource_id=molecule_id,
        action=f"Viewed molecule: {mol.name}",
    )
    return mol


@router.post("/search")
def search_molecules(
    request: MoleculeSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("read:molecules")),
):
    """Search molecules by name, SMILES, CAS, or ChEMBL ID."""
    query = db.query(Molecule)

    if request.query:
        query = query.filter(Molecule.name.ilike(f"%{request.query}%"))
    if request.cas_number:
        query = query.filter(Molecule.cas_number == request.cas_number)
    if request.chembl_id:
        query = query.filter(Molecule.chembl_id == request.chembl_id)
    if request.min_mw:
        query = query.filter(Molecule.molar_mass >= request.min_mw)
    if request.max_mw:
        query = query.filter(Molecule.molar_mass <= request.max_mw)

    molecules = query.offset(request.offset).limit(request.limit).all()
    return {
        "count": query.count(),
        "molecules": molecules,
    }


@router.post("/compute-descriptors")
def compute_molecule_descriptors(
    smiles: str,
    current_user: User = Depends(require_permission("read:molecules")),
):
    """Compute molecular descriptors for a SMILES string (no DB write)."""
    std = standardize_smiles(smiles)
    if not std:
        raise HTTPException(status_code=400, detail="Invalid SMILES")

    descriptors = compute_descriptors(std)
    lipinski = compute_lipinski_properties(std)

    return {
        "smiles": smiles,
        "canonical_smiles": std,
        "descriptors": descriptors,
        "lipinski": lipinski,
        "descriptor_count": len(descriptors),
    }


@router.post("/", response_model=MoleculeResponse)
def create_molecule(
    mol_data: MoleculeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("write:molecules")),
):
    """Create a new molecule with auto-computed descriptors."""
    std_smiles = standardize_smiles(mol_data.smiles)
    if not std_smiles:
        raise HTTPException(status_code=400, detail="Invalid SMILES")

    descriptors = compute_descriptors(std_smiles)
    fp = compute_fingerprint_bits(std_smiles)

    molecule = Molecule(
        name=mol_data.name,
        smiles=mol_data.smiles,
        canonical_smiles=std_smiles,
        cas_number=mol_data.cas_number,
        formula=mol_data.formula,
        molar_mass=mol_data.molar_mass,
        logp=mol_data.logp,
        solubility_water=mol_data.solubility_water,
        melting_point=mol_data.melting_point,
        oxidation_sensitivity=mol_data.oxidation_sensitivity,
        hydrolysis_sensitivity=mol_data.hydrolysis_sensitivity,
        light_sensitivity=mol_data.light_sensitivity,
        descriptors=descriptors,
        data_source="manual",
        data_quality_score=0.5,
    )
    db.add(molecule)
    db.flush()

    log_event(
        db=db, user_id=current_user.id, org_id=current_user.org_id,
        event_type="CREATE", resource_type="Molecule", resource_id=molecule.id,
        action=f"Created molecule: {mol_data.name}",
        new_values={"name": mol_data.name, "smiles": mol_data.smiles},
    )
    db.commit()
    return molecule


@router.post("/import/chembl")
def import_from_chembl(
    query: Optional[str] = None,
    limit: int = Query(100, le=1000),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("write:molecules")),
):
    """Import molecules from ChEMBL database."""
    from app.services.chembl_loader import batch_load_from_chembl

    background_tasks.add_task(
        batch_load_from_chembl, db=db, query=query, limit=limit
    )

    log_event(
        db=db, user_id=current_user.id, org_id=current_user.org_id,
        event_type="CREATE", resource_type="Molecule",
        action=f"Started ChEMBL import: query={query}, limit={limit}",
    )

    return {"status": "import_started", "query": query, "limit": limit}


@router.get("/stats/database")
def database_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("read:molecules")),
):
    """Get chemical database statistics."""
    from sqlalchemy import func

    total = db.query(func.count(Molecule.id)).scalar()
    by_source = dict(
        db.query(Molecule.data_source, func.count(Molecule.id))
        .group_by(Molecule.data_source)
        .all()
    )
    with_chembl = db.query(func.count(Molecule.id)).filter(Molecule.chembl_id.isnot(None)).scalar()
    with_descriptors = db.query(func.count(Molecule.id)).filter(Molecule.descriptors.isnot(None)).scalar()

    return {
        "total_molecules": total,
        "by_source": by_source,
        "with_chembl_id": with_chembl,
        "with_descriptors": with_descriptors,
    }
