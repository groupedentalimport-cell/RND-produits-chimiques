"""
Advanced Molecular Descriptor Engine — RDKit-based.
Computes 200+ descriptors, SMARTS pattern detection, Morgan fingerprints,
functional group analysis, and stability-relevant molecular features.

Replaces rule-based empirical predictions with computed molecular properties.
"""

import numpy as np
from typing import Dict, Any, List, Optional, Tuple, Set
from dataclasses import dataclass, field
import logging
import json

logger = logging.getLogger(__name__)

try:
    from rdkit import Chem
    from rdkit.Chem import (
        Descriptors, Lipinski, rdMolDescriptors, rdFingerprintGenerator,
        AllChem, Draw, rdPartialCharges, Fragments, rdchem
    )
    from rdkit.Chem.MolStandardize import rdMolStandardize
    from rdkit.Chem import Descriptors as Desc
    HAS_RDKIT = True
except ImportError:
    HAS_RDKIT = False
    logger.warning("RDKit not installed — advanced descriptor computation disabled")


# ═══════════════════════════════════════════════════════════════════════
# SMARTS Patterns for Functional Group Detection
# Each pattern is linked to a stability risk assessment
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class SMARTSPattern:
    """A SMARTS pattern with stability implications."""
    name: str
    smarts: str
    category: str  # "stability_risk", "functional_group", "pharmacophore"
    risk_type: str  # "hydrolysis", "oxidation", "photodegradation", etc.
    severity: str  # "low", "moderate", "high", "critical"
    description: str
    _mol: Optional[Any] = field(default=None, repr=False)

    @property
    def rdkit_mol(self):
        if self._mol is None and HAS_RDKIT:
            self._mol = Chem.MolFromSmarts(self.smarts)
        return self._mol


# ── Stability-relevant SMARTS patterns ────────────────────────────────

INSTABILITY_PATTERNS = [
    # Hydrolysis-prone groups
    SMARTSPattern(
        name="ester", smarts="[#6][CX3](=O)[OX2H0][#6]",
        category="stability_risk", risk_type="hydrolysis",
        severity="moderate",
        description="Ester bond — susceptible to acid/base-catalyzed hydrolysis",
    ),
    SMARTSPattern(
        name="lactone", smarts="[#6][CX3](=O)[OX2H0][#6]~1~[#6]~1",
        category="stability_risk", risk_type="hydrolysis",
        severity="moderate",
        description="Lactone (cyclic ester) — hydrolysis risk under acidic/basic conditions",
    ),
    SMARTSPattern(
        name="amide", smarts="[NX3][CX3](=O)[#6]",
        category="stability_risk", risk_type="hydrolysis",
        severity="low",
        description="Amide bond — more stable than ester but still hydrolyzable",
    ),
    SMARTSPattern(
        name="imide", smarts="[CX3](=O)[NX3][CX3](=O)",
        category="stability_risk", risk_type="hydrolysis",
        severity="moderate",
        description="Imide — hydrolysis risk, especially at elevated temperature",
    ),
    SMARTSPattern(
        name="anhydride", smarts="[CX3](=O)[OX2][CX3](=O)",
        category="stability_risk", risk_type="hydrolysis",
        severity="high",
        description="Anhydride — highly susceptible to hydrolysis",
    ),
    SMARTSPattern(
        name="acyl_halide", smarts="[CX3](=O)[F,Cl,Br,I]",
        category="stability_risk", risk_type="hydrolysis",
        severity="critical",
        description="Acyl halide — extremely reactive with water",
    ),
    SMARTSPattern(
        name="epoxide", smarts="C1OC1",
        category="stability_risk", risk_type="hydrolysis",
        severity="high",
        description="Epoxide — ring strain makes it reactive with nucleophiles",
    ),

    # Oxidation-prone groups
    SMARTSPattern(
        name="thiol", smarts="[SX2H]",
        category="stability_risk", risk_type="oxidation",
        severity="high",
        description="Thiol — readily oxidized to disulfides or sulfinic/sulfonic acids",
    ),
    SMARTSPattern(
        name="disulfide", smarts="[SX2][SX2]",
        category="stability_risk", risk_type="oxidation",
        severity="moderate",
        description="Disulfide — can undergo exchange or reduction",
    ),
    SMARTSPattern(
        name="aldehyde", smarts="[CX3H1](=O)[#6]",
        category="stability_risk", risk_type="oxidation",
        severity="high",
        description="Aldehyde — easily oxidized to carboxylic acid",
    ),
    SMARTSPattern(
        name="primary_alcohol", smarts="[OX2H][CX4H2][#6]",
        category="stability_risk", risk_type="oxidation",
        severity="low",
        description="Primary alcohol — oxidation risk with strong oxidizers",
    ),
    SMARTSPattern(
        name="catechol", smarts="c1cc(O)c(O)cc1",
        category="stability_risk", risk_type="oxidation",
        severity="high",
        description="Catechol — highly susceptible to auto-oxidation (quinone formation)",
    ),
    SMARTSPattern(
        name="hydroquinone", smarts="OC1=CC=C(O)C=C1",
        category="stability_risk", risk_type="oxidation",
        severity="high",
        description="Hydroquinone — oxidation to quinone",
    ),
    SMARTSPattern(
        name="furan", smarts="c1ccoc1",
        category="stability_risk", risk_type="oxidation",
        severity="moderate",
        description="Furan ring — oxidative ring-opening risk",
    ),

    # Photodegradation-prone groups
    SMARTSPattern(
        name="nitroaromatic", smarts="c1ccc(cc1)[N+](=O)[O-]",
        category="stability_risk", risk_type="photodegradation",
        severity="high",
        description="Nitroaromatic — photolabile, can form nitroso intermediates",
    ),
    SMARTSPattern(
        name="azide", smarts="[N-]=[N+]=[N-]",
        category="stability_risk", risk_type="photodegradation",
        severity="high",
        description="Azide — photolabile and potentially explosive",
    ),
    SMARTSPattern(
        name="azo", smarts="[NX2]=[NX2]",
        category="stability_risk", risk_type="photodegradation",
        severity="moderate",
        description="Azo bond — photodegradable (cis-trans isomerization)",
    ),
    SMARTSPattern(
        name="conjugated_diene", smarts="C=CC=C",
        category="stability_risk", risk_type="photodegradation",
        severity="moderate",
        description="Conjugated diene — UV-absorbing, photoisomerization risk",
    ),

    # Thermal decomposition-prone groups
    SMARTSPattern(
        name="peroxide", smarts="[OX2][OX2]",
        category="stability_risk", risk_type="thermal_decomposition",
        severity="critical",
        description="Peroxide — thermally unstable, explosive risk",
    ),
    SMARTSPattern(
        name="diazo", smarts="[N-]=[N+]=C",
        category="stability_risk", risk_type="thermal_decomposition",
        severity="high",
        description="Diazo compound — thermally labile, N2 loss",
    ),
    SMARTSPattern(
        name="nitrate_ester", smarts="[OX2][N+](=O)[O-]",
        category="stability_risk", risk_type="thermal_decomposition",
        severity="critical",
        description="Nitrate ester — thermally unstable, explosive",
    ),

    # Metal chelation-prone groups
    SMARTSPattern(
        name="catechol_chelator", smarts="c1cc(O)c(O)cc1",
        category="stability_risk", risk_type="complexation",
        severity="moderate",
        description="Catechol — strong metal chelator (Fe, Cu, Al)",
    ),
    SMARTSPattern(
        name="hydroxamate", smarts="[OX2H][CX3](=O)[NX3]",
        category="stability_risk", risk_type="complexation",
        severity="moderate",
        description="Hydroxamic acid — strong iron chelator",
    ),
    SMARTSPattern(
        name="dithiocarbamate", smarts="[SX2][CX3](=S)[NX3]",
        category="stability_risk", risk_type="complexation",
        severity="moderate",
        description="Dithiocarbamate — metal chelation",
    ),

    # Maillard-prone groups
    SMARTSPattern(
        name="reducing_sugar", smarts="OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
        category="stability_risk", risk_type="maillard",
        severity="moderate",
        description="Reducing sugar — Maillard reaction with amino groups",
    ),
]

# ── Functional group patterns (non-risk, for classification) ──────────

FUNCTIONAL_GROUP_PATTERNS = [
    SMARTSPattern(name="carboxylic_acid", smarts="C(=O)[OH]", category="functional_group", risk_type="none", severity="low", description="Carboxylic acid"),
    SMARTSPattern(name="sulfonic_acid", smarts="S(=O)(=O)[OH]", category="functional_group", risk_type="none", severity="low", description="Sulfonic acid"),
    SMARTSPattern(name="phosphoric_acid", smarts="P(=O)([OH])[OH]", category="functional_group", risk_type="none", severity="low", description="Phosphoric acid"),
    SMARTSPattern(name="primary_amine", smarts="[NX3H2][CX4]", category="functional_group", risk_type="none", severity="low", description="Primary amine"),
    SMARTSPattern(name="secondary_amine", smarts="[NX3H1]([CX4])[CX4]", category="functional_group", risk_type="none", severity="low", description="Secondary amine"),
    SMARTSPattern(name="tertiary_amine", smarts="[NX3]([CX4])([CX4])[CX4]", category="functional_group", risk_type="none", severity="low", description="Tertiary amine"),
    SMARTSPattern(name="quaternary_ammonium", smarts="[NX4+]", category="functional_group", risk_type="none", severity="low", description="Quaternary ammonium"),
    SMARTSPattern(name="guanidine", smarts="NC(=N)N", category="functional_group", risk_type="none", severity="low", description="Guanidine"),
    SMARTSPattern(name="imidazole", smarts="c1cnc[nH]1", category="functional_group", risk_type="none", severity="low", description="Imidazole"),
    SMARTSPattern(name="pyridine", smarts="c1ccncc1", category="functional_group", risk_type="none", severity="low", description="Pyridine"),
    SMARTSPattern(name="morpholine", smarts="C1COCCN1", category="functional_group", risk_type="none", severity="low", description="Morpholine"),
    SMARTSPattern(name="piperazine", smarts="C1CNCCN1", category="functional_group", risk_type="none", severity="low", description="Piperazine"),
    SMARTSPattern(name="sulfonamide", smarts="S(=O)(=O)N", category="functional_group", risk_type="none", severity="low", description="Sulfonamide"),
    SMARTSPattern(name="carbamate", smarts="[OX2][CX3](=O)[NX3]", category="functional_group", risk_type="none", severity="low", description="Carbamate"),
    SMARTSPattern(name="urea", smarts="[NX3][CX3](=O)[NX3]", category="functional_group", risk_type="none", severity="low", description="Urea"),
    SMARTSPattern(name="phosphate", smarts="P(=O)([OX2])[OX2]", category="functional_group", risk_type="none", severity="low", description="Phosphate ester"),
    SMARTSPattern(name="silane", smarts="[Si]", category="functional_group", risk_type="none", severity="low", description="Silane/siloxane"),
    SMARTSPattern(name="boronic_acid", smarts="B(O)O", category="functional_group", risk_type="none", severity="low", description="Boronic acid"),
    SMARTSPattern(name="isocyanate", smarts="[N]=[C]=[O]", category="functional_group", risk_type="none", severity="low", description="Isocyanate"),
    SMARTSPattern(name="thiocyanate", smarts="SC#N", category="functional_group", risk_type="none", severity="low", description="Thiocyanate"),
]


@dataclass
class FunctionalGroupAnalysis:
    """Results of functional group detection."""
    detected_groups: List[Dict[str, Any]]
    instability_risks: List[Dict[str, Any]]
    risk_count_by_type: Dict[str, int]
    overall_instability_score: float  # 0-100, higher = more stable
    functional_group_count: int
    instability_pattern_count: int


@dataclass
class DescriptorResult:
    """Complete descriptor computation result."""
    smiles: str
    canonical_smiles: str
    molecular_formula: str
    descriptors: Dict[str, float]
    fingerprint: Optional[List[int]]
    fingerprint_bits: int
    functional_groups: FunctionalGroupAnalysis
    lipinski: Dict[str, Any]
    computed_property_count: int
    computation_errors: List[str]


# ═══════════════════════════════════════════════════════════════════════
# Core Computation Functions
# ═══════════════════════════════════════════════════════════════════════

def get_all_descriptor_functions() -> Dict[str, Any]:
    """Return dict of all available RDKit descriptor functions."""
    if not HAS_RDKIT:
        return {}
    return dict(Descriptors.descList)


def compute_descriptors(smiles: str) -> Dict[str, float]:
    """
    Compute 200+ molecular descriptors from SMILES.
    Returns dict of descriptor_name → value.
    """
    if not HAS_RDKIT:
        return {}

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        logger.warning(f"Invalid SMILES: {smiles}")
        return {}

    descriptors = {}
    desc_functions = get_all_descriptor_functions()

    for name, func in desc_functions.items():
        try:
            value = func(mol)
            if value is not None and np.isfinite(value):
                descriptors[name] = round(float(value), 6)
            else:
                descriptors[name] = 0.0
        except Exception:
            descriptors[name] = 0.0

    # Add custom descriptors
    try:
        descriptors["NumAmideBonds"] = rdMolDescriptors.CalcNumAmideBonds(mol)
        descriptors["NumBridgeheadAtoms"] = rdMolDescriptors.CalcNumBridgeheadAtoms(mol)
        descriptors["NumSpiroAtoms"] = rdMolDescriptors.CalcNumSpiroAtoms(mol)
        descriptors["NumAtomStereoCenters"] = len(Chem.FindMolChiralCenters(mol))
        descriptors["NumUnspecifiedAtomStereoCenters"] = len(
            Chem.FindMolChiralCenters(mol, includeUnassigned=True)
        )
        # Fraction Csp3 (already in descList but ensure it's there)
        descriptors["FractionCSP3"] = Descriptors.FractionCSP3(mol)
    except Exception:
        pass

    return descriptors


def compute_fingerprint(
    smiles: str,
    radius: int = 2,
    n_bits: int = 2048,
    as_numpy: bool = True,
) -> Optional[Any]:
    """
    Compute Morgan/Circular fingerprint.
    radius=2, n_bits=2048 is the standard for QSPR.
    radius=1 for simpler similarity, radius=3 for more specific.
    """
    if not HAS_RDKIT:
        return None

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None

    generator = rdFingerprintGenerator.GetMorganGenerator(radius=radius, fpSize=n_bits)
    if as_numpy:
        return generator.GetFingerprintAsNumPy(mol)
    return generator.GetFingerprintAsNumPy(mol).tolist()


def compute_fingerprint_bits(smiles: str, radius: int = 2, n_bits: int = 2048) -> Optional[List[int]]:
    """Compute fingerprint as list of integers (for JSON storage)."""
    fp = compute_fingerprint(smiles, radius, n_bits, as_numpy=True)
    if fp is None:
        return None
    return fp.tolist()


def compute_maccs_keys(smiles: str) -> Optional[np.ndarray]:
    """Compute MACCS structural keys (166 bits)."""
    if not HAS_RDKIT:
        return None
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    generator = rdFingerprintGenerator.GetMACCSGenerator()
    return generator.GetFingerprintAsNumPy(mol)


def compute_topological_torsion_fp(smiles: str, n_bits: int = 2048) -> Optional[np.ndarray]:
    """Compute topological torsion fingerprint."""
    if not HAS_RDKIT:
        return None
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    generator = rdFingerprintGenerator.GetTopologicalTorsionGenerator(fpSize=n_bits)
    return generator.GetFingerprintAsNumPy(mol)


def compute_rdkit_fp(smiles: str, n_bits: int = 2048) -> Optional[np.ndarray]:
    """Compute RDKit topological fingerprint."""
    if not HAS_RDKIT:
        return None
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    generator = rdFingerprintGenerator.GetRDKitFPGenerator(fpSize=n_bits)
    return generator.GetFingerprintAsNumPy(mol)


def detect_functional_groups(smiles: str) -> FunctionalGroupAnalysis:
    """
    Detect functional groups and instability risks using SMARTS patterns.
    Returns comprehensive analysis with risk scoring.
    """
    if not HAS_RDKIT:
        return FunctionalGroupAnalysis([], [], {}, 100.0, 0, 0)

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return FunctionalGroupAnalysis([], [], {}, 0.0, 0, 0)

    detected_groups = []
    instability_risks = []
    risk_counts: Dict[str, int] = {}

    # Check functional groups
    for pattern in FUNCTIONAL_GROUP_PATTERNS:
        if pattern.rdkit_mol is not None:
            matches = mol.GetSubstructMatches(pattern.rdkit_mol)
            if matches:
                detected_groups.append({
                    "name": pattern.name,
                    "count": len(matches),
                    "category": pattern.category,
                    "description": pattern.description,
                    "atom_indices": [list(m) for m in matches],
                })

    # Check instability patterns
    for pattern in INSTABILITY_PATTERNS:
        if pattern.rdkit_mol is not None:
            matches = mol.GetSubstructMatches(pattern.rdkit_mol)
            if matches:
                instability_risks.append({
                    "name": pattern.name,
                    "count": len(matches),
                    "risk_type": pattern.risk_type,
                    "severity": pattern.severity,
                    "description": pattern.description,
                    "atom_indices": [list(m) for m in matches],
                })
                risk_counts[pattern.risk_type] = risk_counts.get(pattern.risk_type, 0) + len(matches)

    # Compute overall instability score
    severity_weights = {"low": 5, "moderate": 15, "high": 30, "critical": 50}
    total_penalty = 0
    for risk in instability_risks:
        total_penalty += severity_weights.get(risk["severity"], 10) * risk["count"]

    # Score: 100 = perfectly stable, 0 = extremely unstable
    overall_score = max(0, 100 - total_penalty)

    return FunctionalGroupAnalysis(
        detected_groups=detected_groups,
        instability_risks=instability_risks,
        risk_count_by_type=risk_counts,
        overall_instability_score=overall_score,
        functional_group_count=len(detected_groups),
        instability_pattern_count=len(instability_risks),
    )


def compute_partial_charges(smiles: str) -> Optional[Dict[str, float]]:
    """Compute Gasteiger partial charges for each atom."""
    if not HAS_RDKIT:
        return None
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    try:
        rdPartialCharges.ComputeGasteigerCharges(mol)
        charges = {}
        for i, atom in enumerate(mol.GetAtoms()):
            charges[f"atom_{i}_{atom.GetSymbol()}"] = round(float(atom.GetDoubleProp("_GasteigerCharge")), 4)
        return charges
    except Exception:
        return None


def compute_3d_coordinates(smiles: str) -> Optional[np.ndarray]:
    """Generate 3D coordinates using ETKDG algorithm."""
    if not HAS_RDKIT:
        return None
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    mol = Chem.AddHs(mol)
    try:
        AllChem.EmbedMolecule(mol, AllChem.ETKDGv3())
        conf = mol.GetConformer()
        coords = np.array([conf.GetAtomPosition(i) for i in range(mol.GetNumAtoms())])
        return coords
    except Exception:
        return None


def compute_conformational_energy(smiles: str) -> Optional[float]:
    """Compute rough conformational energy using UFF force field."""
    if not HAS_RDKIT:
        return None
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    mol = Chem.AddHs(mol)
    try:
        AllChem.EmbedMolecule(mol, AllChem.ETKDGv3())
        ff = AllChem.UFFGetMoleculeForceField(mol)
        if ff is None:
            return None
        energy = ff.CalcEnergy()
        return round(float(energy), 2)  # kcal/mol
    except Exception:
        return None


def standardize_smiles(smiles: str) -> Optional[str]:
    """Canonicalize and standardize SMILES using RDKit."""
    if not HAS_RDKIT:
        return smiles
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    normalizer = rdMolStandardize.Normalizer()
    mol = normalizer.normalize(mol)
    chooser = rdMolStandardize.LargestFragmentChooser()
    mol = chooser.choose(mol)
    return Chem.MolToSmiles(mol, canonical=True)


def compute_similarity(fp1: np.ndarray, fp2: np.ndarray) -> float:
    """Compute Tanimoto similarity between two fingerprints."""
    intersection = np.sum(fp1 & fp2)
    union = np.sum(fp1 | fp2)
    if union == 0:
        return 0.0
    return float(intersection / union)


def compute_molecular_formula(smiles: str) -> Optional[str]:
    """Get molecular formula from SMILES."""
    if not HAS_RDKIT:
        return None
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    return rdMolDescriptors.CalcMolFormula(mol)


def compute_lipinski_properties(smiles: str) -> Dict[str, Any]:
    """Compute Lipinski Rule of 5 + Veber + drug-likeness filters."""
    if not HAS_RDKIT:
        return {}
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return {}

    mw = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    psa = Descriptors.TPSA(mol)
    rotb = Descriptors.NumRotatableBonds(mol)

    violations = 0
    if mw > 500: violations += 1
    if logp > 5: violations += 1
    if hbd > 5: violations += 1
    if hba > 10: violations += 1

    return {
        "molecular_weight": round(mw, 2),
        "logp": round(logp, 2),
        "hbd": hbd,
        "hba": hba,
        "tpsa": round(psa, 2),
        "rotatable_bonds": rotb,
        "lipinski_violations": violations,
        "lipinski_pass": violations <= 1,
        "veber_pass": (rotb <= 10) and (psa <= 140),
        "drug_like": violations <= 1 and rotb <= 10 and psa <= 140,
        "fsp3": round(Descriptors.FractionCSP3(mol), 3),
        "aromatic_rings": Descriptors.NumAromaticRings(mol),
        "heavy_atoms": mol.GetNumHeavyAtoms(),
    }


def get_descriptor_vector(descriptors: Dict[str, float], descriptor_names: List[str]) -> np.ndarray:
    """Convert descriptor dict to fixed-length numpy vector for ML."""
    return np.array([descriptors.get(name, 0.0) for name in descriptor_names])


def batch_compute_descriptors(smiles_list: List[str]) -> List[Dict[str, Any]]:
    """Compute descriptors for a batch of SMILES strings."""
    results = []
    for smiles in smiles_list:
        desc = compute_descriptors(smiles)
        desc["_smiles"] = smiles
        results.append(desc)
    return results


def compute_full_analysis(smiles: str) -> DescriptorResult:
    """
    Complete molecular analysis: descriptors + fingerprints + functional groups + Lipinski.
    This is the main entry point for comprehensive molecular characterization.
    """
    errors = []

    # Standardize SMILES
    canonical = standardize_smiles(smiles)
    if canonical is None:
        return DescriptorResult(
            smiles=smiles, canonical_smiles="", molecular_formula="",
            descriptors={}, fingerprint=None, fingerprint_bits=0,
            functional_groups=FunctionalGroupAnalysis([], [], {}, 0.0, 0, 0),
            lipinski={}, computed_property_count=0,
            computation_errors=[f"Invalid SMILES: {smiles}"],
        )

    # Molecular formula
    formula = compute_molecular_formula(canonical) or ""

    # 200+ descriptors
    try:
        descriptors = compute_descriptors(canonical)
    except Exception as e:
        descriptors = {}
        errors.append(f"Descriptor computation error: {e}")

    # Morgan fingerprint (2048 bits)
    try:
        fp = compute_fingerprint_bits(canonical, radius=2, n_bits=2048)
    except Exception as e:
        fp = None
        errors.append(f"Fingerprint computation error: {e}")

    # Functional group analysis
    try:
        fg_analysis = detect_functional_groups(canonical)
    except Exception as e:
        fg_analysis = FunctionalGroupAnalysis([], [], {}, 100.0, 0, 0)
        errors.append(f"Functional group detection error: {e}")

    # Lipinski properties
    try:
        lipinski = compute_lipinski_properties(canonical)
    except Exception as e:
        lipinski = {}
        errors.append(f"Lipinski computation error: {e}")

    return DescriptorResult(
        smiles=smiles,
        canonical_smiles=canonical,
        molecular_formula=formula,
        descriptors=descriptors,
        fingerprint=fp,
        fingerprint_bits=len(fp) if fp else 0,
        functional_groups=fg_analysis,
        lipinski=lipinski,
        computed_property_count=len(descriptors),
        computation_errors=errors,
    )
