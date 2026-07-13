"""
ChEMBL Data Loader — Fetch molecules with real physicochemical data.
Supports batch loading, caching, and descriptor computation.
"""

import requests
import logging
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from sqlalchemy.orm import Session

from app.core.config import settings
from app.engines.descriptors import (
    compute_descriptors, compute_fingerprint_bits, standardize_smiles,
    compute_lipinski_properties
)

logger = logging.getLogger(__name__)

CHEMBL_API = settings.CHEMBL_API_BASE
PUBCHEM_API = settings.PUBCHEM_API_BASE
BATCH_SIZE = settings.MOLECULE_FETCH_BATCH_SIZE


@dataclass
class ChEMBLMolecule:
    """Structured ChEMBL molecule data."""
    chembl_id: str
    name: str
    smiles: str
    inchi: Optional[str]
    inchi_key: Optional[str]
    formula: Optional[str]
    mol_weight: Optional[float]
    logp: Optional[float]
    psa: Optional[float]
    hbd: Optional[int]
    hba: Optional[int]
    max_phase: Optional[float]
    first_approval: Optional[int]
    oral: Optional[bool]
    parenteral: Optional[bool]
    therapeutic_area: Optional[str]


def fetch_chembl_molecule(chembl_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a single molecule from ChEMBL API."""
    try:
        url = f"{CHEMBL_API}/molecule/{chembl_id}.json"
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        # Extract structures
        structs = data.get("molecule_structures", {})
        smiles = structs.get("canonical_smiles", "")
        inchi = structs.get("standard_inchi", "")
        inchi_key = structs.get("standard_inchi_key", "")

        # Extract properties
        props = data.get("molecule_properties", {})

        return {
            "chembl_id": chembl_id,
            "name": data.get("pref_name", chembl_id),
            "smiles": smiles,
            "inchi": inchi,
            "inchi_key": inchi_key,
            "formula": props.get("full_molecule_formula"),
            "mol_weight": _safe_float(props.get("full_mwt")),
            "logp": _safe_float(props.get("alogp")),
            "psa": _safe_float(props.get("psa")),
            "hbd": _safe_int(props.get("hbd")),
            "hba": _safe_int(props.get("hba")),
            "max_phase": _safe_float(data.get("max_phase")),
            "first_approval": _safe_int(data.get("first_approval")),
            "oral": data.get("oral"),
            "parenteral": data.get("parenteral"),
            "molecule_type": data.get("molecule_type"),
            "black_box_warning": data.get("black_box_warning"),
            "natural_product": data.get("natural_product"),
            "therapeutic_area": _extract_therapeutic_area(data),
        }
    except Exception as e:
        logger.error(f"Failed to fetch {chembl_id}: {e}")
        return None


def search_chembl_molecules(
    query: str,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Search ChEMBL for molecules by name or SMILES."""
    try:
        url = f"{CHEMBL_API}/molecule/search.json"
        params = {
            "q": query,
            "limit": min(limit, BATCH_SIZE),
            "offset": offset,
        }
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        molecules = []
        for mol in data.get("molecules", []):
            parsed = _parse_chembl_molecule(mol)
            if parsed:
                molecules.append(parsed)

        return molecules
    except Exception as e:
        logger.error(f"ChEMBL search failed: {e}")
        return []


def fetch_chembl_by_smiles(
    smiles: str,
    similarity_threshold: int = 85,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Search ChEMBL by structural similarity (SMILES)."""
    try:
        url = f"{CHEMBL_API}/similarity/search/{smiles}.json"
        params = {
            "limit": min(limit, BATCH_SIZE),
            "threshold": similarity_threshold,
        }
        resp = requests.get(url, params=params, timeout=60)
        resp.raise_for_status()
        data = resp.json()

        molecules = []
        for mol in data.get("molecules", []):
            parsed = _parse_chembl_molecule(mol)
            if parsed:
                molecules.append(parsed)

        return molecules
    except Exception as e:
        logger.error(f"ChEMBL similarity search failed: {e}")
        return []


def fetch_approved_drugs(limit: int = 1000) -> List[Dict[str, Any]]:
    """Fetch approved drugs from ChEMBL (max_phase=4)."""
    try:
        url = f"{CHEMBL_API}/molecule/search.json"
        params = {
            "limit": min(limit, BATCH_SIZE),
            "max_phase": 4,
        }
        all_molecules = []
        offset = 0

        while len(all_molecules) < limit:
            params["offset"] = offset
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            molecules = data.get("molecules", [])
            if not molecules:
                break

            for mol in molecules:
                parsed = _parse_chembl_molecule(mol)
                if parsed:
                    all_molecules.append(parsed)

            offset += BATCH_SIZE
            time.sleep(0.5)  # Rate limiting

        return all_molecules[:limit]
    except Exception as e:
        logger.error(f"Failed to fetch approved drugs: {e}")
        return []


def enrich_molecule_with_descriptors(mol_data: Dict[str, Any]) -> Dict[str, Any]:
    """Add computed molecular descriptors and fingerprints to molecule data."""
    smiles = mol_data.get("smiles", "")
    if not smiles:
        return mol_data

    # Standardize SMILES
    std_smiles = standardize_smiles(smiles)
    if std_smiles:
        mol_data["canonical_smiles"] = std_smiles
    else:
        mol_data["canonical_smiles"] = smiles

    # Compute descriptors
    descriptors = compute_descriptors(mol_data["canonical_smiles"])
    mol_data["descriptors"] = descriptors

    # Compute fingerprints
    fp = compute_fingerprint_bits(mol_data["canonical_smiles"])
    mol_data["fingerprint_bits"] = fp

    # Compute Lipinski properties
    lipinski = compute_lipinski_properties(mol_data["canonical_smiles"])
    mol_data["lipinski"] = lipinski

    return mol_data


def save_molecule_to_db(db: Session, mol_data: Dict[str, Any]) -> Optional[int]:
    """Save a molecule to the database with all computed properties."""
    from app.models.molecule import Molecule, MoleculeAlias

    # Check if already exists (by InChIKey or ChEMBL ID)
    existing = None
    if mol_data.get("inchi_key"):
        existing = db.query(Molecule).filter(Molecule.inchi_key == mol_data["inchi_key"]).first()
    if not existing and mol_data.get("chembl_id"):
        existing = db.query(Molecule).filter(Molecule.chembl_id == mol_data["chembl_id"]).first()

    if existing:
        # Update existing
        for key, value in mol_data.items():
            if hasattr(existing, key) and value is not None:
                setattr(existing, key, value)
        db.flush()
        return existing.id

    # Create new
    molecule = Molecule(
        name=mol_data.get("name", "Unknown"),
        chembl_id=mol_data.get("chembl_id"),
        pubchem_cid=mol_data.get("pubchem_cid"),
        smiles=mol_data.get("smiles"),
        canonical_smiles=mol_data.get("canonical_smiles"),
        inchi=mol_data.get("inchi"),
        inchi_key=mol_data.get("inchi_key"),
        formula=mol_data.get("formula"),
        molar_mass=mol_data.get("mol_weight"),
        logp=mol_data.get("logp"),
        psa=mol_data.get("psa"),
        hbd=mol_data.get("hbd"),
        hba=mol_data.get("hba"),
        max_phase=mol_data.get("max_phase"),
        first_approval=mol_data.get("first_approval"),
        oral=mol_data.get("oral"),
        parenteral=mol_data.get("parenteral"),
        therapeutic_area=mol_data.get("therapeutic_area"),
        descriptors=mol_data.get("descriptors"),
        data_source="chembl",
        data_quality_score=0.85,
    )
    db.add(molecule)
    db.flush()

    # Add aliases
    if mol_data.get("name") and mol_data["name"] != molecule.chembl_id:
        alias = MoleculeAlias(
            molecule_id=molecule.id,
            alias=mol_data["name"],
            alias_type="preferred_name",
        )
        db.add(alias)

    return molecule.id


def batch_load_from_chembl(
    db: Session,
    query: Optional[str] = None,
    limit: int = 500,
    compute_desc: bool = True,
) -> Dict[str, Any]:
    """
    Batch load molecules from ChEMBL into database.
    Returns statistics.
    """
    stats = {"fetched": 0, "saved": 0, "skipped": 0, "errors": 0}

    if query:
        molecules = search_chembl_molecules(query, limit=limit)
    else:
        molecules = fetch_approved_drugs(limit=limit)

    stats["fetched"] = len(molecules)

    for mol_data in molecules:
        try:
            if compute_desc:
                mol_data = enrich_molecule_with_descriptors(mol_data)

            mol_id = save_molecule_to_db(db, mol_data)
            if mol_id:
                stats["saved"] += 1
            else:
                stats["skipped"] += 1
        except Exception as e:
            logger.error(f"Error saving molecule {mol_data.get('chembl_id')}: {e}")
            stats["errors"] += 1

    db.commit()
    return stats


# ── Helpers ────────────────────────────────────────────────────────────

def _parse_chembl_molecule(data: Dict) -> Optional[Dict[str, Any]]:
    """Parse ChEMBL API response into standardized dict."""
    try:
        structs = data.get("molecule_structures") or {}
        props = data.get("molecule_properties") or {}

        return {
            "chembl_id": data.get("molecule_chembl_id", data.get("chembl_id")),
            "name": data.get("pref_name") or data.get("molecule_chembl_id", "Unknown"),
            "smiles": structs.get("canonical_smiles", ""),
            "inchi": structs.get("standard_inchi"),
            "inchi_key": structs.get("standard_inchi_key"),
            "formula": props.get("full_molecule_formula"),
            "mol_weight": _safe_float(props.get("full_mwt")),
            "logp": _safe_float(props.get("alogp")),
            "psa": _safe_float(props.get("psa")),
            "hbd": _safe_int(props.get("hbd")),
            "hba": _safe_int(props.get("hba")),
            "max_phase": _safe_float(data.get("max_phase")),
            "first_approval": _safe_int(data.get("first_approval")),
            "oral": data.get("oral"),
            "parenteral": data.get("parenteral"),
            "therapeutic_area": _extract_therapeutic_area(data),
        }
    except Exception:
        return None


def _extract_therapeutic_area(data: Dict) -> Optional[str]:
    """Extract therapeutic areas from ChEMBL data."""
    indications = data.get("indications") or []
    if not indications:
        return None
    areas = set()
    for ind in indications[:5]:
        mesh = ind.get("mesh_heading", "")
        if mesh:
            areas.add(mesh)
    return ", ".join(areas) if areas else None


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _safe_int(val) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None
