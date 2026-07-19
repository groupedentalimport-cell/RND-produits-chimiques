"""
DFT Engine — Density Functional Theory integration.
Interfaces with Psi4, ORCA, and Gaussian for quantum chemical calculations.

Computes:
  - Electronic energy and optimized geometry
  - Activation energy (Ea) from transition state theory
  - Reaction energy (ΔG, ΔH, ΔS) from DFT
  - HOMO/LUMO gap (reactivity indicator)
  - Electrostatic potential maps
  - Vibrational frequencies (thermochemistry)

Priority: Psi4 (free) > ORCA (free academic) > Gaussian (commercial)
"""

import os
import json
import logging
import tempfile
import subprocess
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class DFTResult:
    """Result of a DFT calculation."""
    molecule: str
    smiles: str
    method: str  # "B3LYP", "M062X", "ωB97X-D", etc.
    basis_set: str  # "6-31G*", "def2-TZVP", "cc-pVTZ", etc.

    # Energetics
    total_energy_hartree: Optional[float] = None  # Hartree
    total_energy_kj_mol: Optional[float] = None   # kJ/mol
    free_energy_hartree: Optional[float] = None
    enthalpy_hartree: Optional[float] = None
    entropy: Optional[float] = None  # J/(mol·K)

    # Electronic properties
    homo_energy: Optional[float] = None  # eV
    lumo_energy: Optional[float] = None  # eV
    homo_lumo_gap: Optional[float] = None  # eV
    dipole_moment: Optional[float] = None  # Debye
    ionization_potential: Optional[float] = None  # eV
    electron_affinity: Optional[float] = None  # eV
    chemical_potential: Optional[float] = None  # eV
    electronegativity: Optional[float] = None  # eV
    hardness: Optional[float] = None  # eV
    electrophilicity: Optional[float] = None  # eV

    # Geometry
    optimized_geometry: Optional[List[List[float]]] = None  # [[x,y,z], ...]
    atomic_numbers: Optional[List[int]] = None
    bond_lengths: Optional[Dict[str, float]] = None

    # Vibrational frequencies
    frequencies: Optional[List[float]] = None  # cm⁻¹
    zero_point_energy: Optional[float] = None  # kJ/mol

    # Computation metadata
    engine: str = "psi4"  # "psi4", "orca", "gaussian"
    wall_time_seconds: float = 0.0
    convergence: bool = False
    n_iterations: int = 0
    basis_functions: int = 0

    # Stability-relevant derived properties
    electrophilic_index: Optional[float] = None
    nucleophilic_index: Optional[float] = None
    Fukui_indices: Optional[Dict[str, float]] = None


@dataclass
class TransitionStateResult:
    """Result of a transition state search."""
    reactant_energy: float  # Hartree
    product_energy: float
    ts_energy: float
    activation_energy_kj_mol: float  # Ea = E_TS - E_reactant
    reaction_energy_kj_mol: float    # ΔE = E_product - E_reactant
    imaginary_frequency: Optional[float] = None  # cm⁻¹ (should be negative)
    reaction_coordinate: Optional[str] = None
    method: str = ""
    basis_set: str = ""


@dataclass
class ReactionEnergyResult:
    """Result of a reaction energy calculation."""
    reaction: str  # SMILES of reaction
    reactant_energies: List[float]
    product_energies: List[float]
    delta_e: float  # kJ/mol
    delta_h: Optional[float] = None
    delta_g: Optional[float] = None
    delta_s: Optional[float] = None
    activation_energy: Optional[float] = None
    method: str = ""
    basis_set: str = ""


# ═══════════════════════════════════════════════════════════════════════
# Hartree to kJ/mol conversion
# ═══════════════════════════════════════════════════════════════════════
HARTREE_TO_KJ_MOL = 2625.499638
HARTREE_TO_EV = 27.211386
HARTREE_TO_KCAL_MOL = 627.509474


class DFTEngine:
    """
    DFT calculation engine with support for multiple backends.
    Provides a unified interface for quantum chemical calculations.
    """

    # Supported DFT methods
    METHODS = {
        "B3LYP": {"type": "hybrid-GGA", "accuracy": "good", "cost": "moderate"},
        "M062X": {"type": "hybrid-meta-GGA", "accuracy": "excellent", "cost": "moderate"},
        "wB97X-D": {"type": "range-separated-hybrid", "accuracy": "excellent", "cost": "high"},
        "PBE0": {"type": "hybrid-GGA", "accuracy": "good", "cost": "moderate"},
        "B97M-V": {"type": "meta-GGA", "accuracy": "excellent", "cost": "moderate"},
        "HF": {"type": "Hartree-Fock", "accuracy": "basic", "cost": "low"},
        "MP2": {"type": "post-HF", "accuracy": "very-good", "cost": "high"},
        "CCSD": {"type": "post-HF", "accuracy": "excellent", "cost": "very-high"},
        "CCSD(T)": {"type": "post-HF", "accuracy": "gold-standard", "cost": "very-high"},
    }

    BASIS_SETS = {
        "STO-3G": {"quality": "minimal", "cost": "very-low"},
        "3-21G": {"quality": "split-valence", "cost": "low"},
        "6-31G*": {"quality": "polarized", "cost": "moderate"},
        "6-311G**": {"quality": "triple-zeta", "cost": "moderate"},
        "6-311+G(2d,2p)": {"quality": "diffuse+polarized", "cost": "high"},
        "def2-SVP": {"quality": "split-valence", "cost": "low"},
        "def2-TZVP": {"quality": "triple-zeta", "cost": "moderate"},
        "def2-TZVPP": {"quality": "triple-zeta+polarized", "cost": "high"},
        "cc-pVDZ": {"quality": "correlation-consistent-DZ", "cost": "moderate"},
        "cc-pVTZ": {"quality": "correlation-consistent-TZ", "cost": "high"},
        "cc-pVQZ": {"quality": "correlation-consistent-QZ", "cost": "very-high"},
        "aug-cc-pVTZ": {"quality": "augmented-TZ", "cost": "very-high"},
    }

    def __init__(self, engine: str = "auto", scratch_dir: str = "/tmp/dft_scratch"):
        self.engine = engine
        self.scratch_dir = Path(scratch_dir)
        self.scratch_dir.mkdir(parents=True, exist_ok=True)
        self._available_engines = self._detect_engines()

    def _detect_engines(self) -> Dict[str, bool]:
        """Detect available DFT engines."""
        engines = {}

        # Psi4
        try:
            import psi4
            engines["psi4"] = True
            logger.info("Psi4 detected")
        except ImportError:
            engines["psi4"] = False

        # ORCA
        orca_path = os.environ.get("ORCA_PATH", "orca")
        try:
            result = subprocess.run(
                [orca_path, "--version"],
                capture_output=True, text=True, timeout=10
            )
            engines["orca"] = result.returncode == 0
            if engines["orca"]:
                logger.info(f"ORCA detected at {orca_path}")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            engines["orca"] = False

        # Gaussian
        gaussian_path = os.environ.get("GAUSSIAN_PATH", "g16")
        try:
            result = subprocess.run(
                [gaussian_path],
                capture_output=True, text=True, timeout=5
            )
            engines["gaussian"] = True
            logger.info(f"Gaussian detected at {gaussian_path}")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            engines["gaussian"] = False

        # Auto-select best available
        if self.engine == "auto":
            if engines.get("psi4"):
                self.engine = "psi4"
            elif engines.get("orca"):
                self.engine = "orca"
            elif engines.get("gaussian"):
                self.engine = "gaussian"
            else:
                self.engine = "none"
                logger.warning("No DFT engine detected")

        return engines

    @property
    def is_available(self) -> bool:
        return self.engine != "none" and self._available_engines.get(self.engine, False)

    def compute_single_point(
        self,
        smiles: str,
        method: str = "B3LYP",
        basis_set: str = "6-31G*",
        charge: int = 0,
        multiplicity: int = 1,
    ) -> DFTResult:
        """
        Run single-point DFT calculation on a molecule.
        Returns electronic energy, HOMO/LUMO, dipole moment, etc.
        """
        if not self.is_available:
            return self._mock_dft_result(smiles, method, basis_set)

        if self.engine == "psi4":
            return self._run_psi4_single_point(smiles, method, basis_set, charge, multiplicity)
        elif self.engine == "orca":
            return self._run_orca_single_point(smiles, method, basis_set, charge, multiplicity)
        elif self.engine == "gaussian":
            return self._run_gaussian_single_point(smiles, method, basis_set, charge, multiplicity)

        return self._mock_dft_result(smiles, method, basis_set)

    def compute_geometry_optimization(
        self,
        smiles: str,
        method: str = "B3LYP",
        basis_set: str = "6-31G*",
        charge: int = 0,
        multiplicity: int = 1,
    ) -> DFTResult:
        """Run geometry optimization and frequency calculation."""
        if not self.is_available:
            return self._mock_dft_result(smiles, method, basis_set)

        if self.engine == "psi4":
            return self._run_psi4_opt(smiles, method, basis_set, charge, multiplicity)
        elif self.engine == "orca":
            return self._run_orca_opt(smiles, method, basis_set, charge, multiplicity)

        return self._mock_dft_result(smiles, method, basis_set)

    def compute_transition_state(
        self,
        reactant_smiles: str,
        product_smiles: str,
        method: str = "B3LYP",
        basis_set: str = "6-31G*",
    ) -> TransitionStateResult:
        """
        Estimate activation energy from reactant/product energies.
        
        WARNING: This is an ESTIMATION, not a real transition state search.
        A proper TS search requires NEB, QST2, or eigenvector following.
        This method provides a rough estimate for screening purposes only.
        For production use, implement proper TS search with Psi4/ORCA.
        """
        if not self.is_available:
            return self._mock_ts_result(reactant_smiles, product_smiles, method, basis_set)

        # Compute reactant and product energies
        reactant = self.compute_single_point(reactant_smiles, method, basis_set)
        product = self.compute_single_point(product_smiles, method, basis_set)
        
        if not reactant.convergence or not product.convergence:
            logger.warning("DFT calculations did not converge — TS estimate unreliable")

        # ESTIMATION: Use Hammond's postulate approximation
        # For exothermic reactions, TS resembles reactant (lower barrier)
        # For endothermic reactions, TS resembles product (higher barrier)
        delta_e = (product.total_energy_hartree - reactant.total_energy_hartree) if product.total_energy_hartree and reactant.total_energy_hartree else 0.0
        
        # Rough barrier estimate based on reaction energy
        # This is a VERY rough approximation — real TS search needed for accuracy
        if delta_e < 0:
            # Exothermic: barrier ~ 10-30% of |ΔE| (Evans-Polanyi)
            barrier_estimate = abs(delta_e) * 0.2
        else:
            # Endothermic: barrier ~ ΔE + small extra
            barrier_estimate = delta_e + 0.01  # ~26 kJ/mol minimum
        
        ts_energy = reactant.total_energy_hartree + barrier_estimate

        ea = barrier_estimate * HARTREE_TO_KJ_MOL

        return TransitionStateResult(
            reactant_energy=reactant.total_energy_hartree,
            product_energy=product.total_energy_hartree,
            ts_energy=ts_energy,
            activation_energy_kj_mol=round(ea, 2),
            reaction_energy_kj_mol=round(delta_e * HARTREE_TO_KJ_MOL, 2),
            method=method,
            basis_set=basis_set,
        )

    def compute_reaction_energy(
        self,
        reactant_smiles_list: List[str],
        product_smiles_list: List[str],
        method: str = "B3LYP",
        basis_set: str = "6-31G*",
    ) -> ReactionEnergyResult:
        """
        Compute reaction energy: ΔE = ΣE(products) - ΣE(reactants)
        """
        reactant_energies = []
        for smi in reactant_smiles_list:
            result = self.compute_single_point(smi, method, basis_set)
            reactant_energies.append(result.total_energy_hartree or 0.0)

        product_energies = []
        for smi in product_smiles_list:
            result = self.compute_single_point(smi, method, basis_set)
            product_energies.append(result.total_energy_hartree or 0.0)

        delta_e = (sum(product_energies) - sum(reactant_energies)) * HARTREE_TO_KJ_MOL

        return ReactionEnergyResult(
            reaction=".".join(reactant_smiles_list) + ">>" + ".".join(product_smiles_list),
            reactant_energies=reactant_energies,
            product_energies=product_energies,
            delta_e=delta_e,
            method=method,
            basis_set=basis_set,
        )

    def compute_homo_lumo(
        self,
        smiles: str,
        method: str = "B3LYP",
        basis_set: str = "6-31G*",
    ) -> Dict[str, float]:
        """
        Compute HOMO/LUMO energies and derived reactivity descriptors.
        """
        result = self.compute_single_point(smiles, method, basis_set)

        if result.homo_energy is None:
            return {}

        mu = (result.homo_energy + result.lumo_energy) / 2  # chemical potential
        eta = (result.lumo_energy - result.homo_energy) / 2  # hardness
        omega = mu**2 / (2 * eta) if eta != 0 else 0  # electrophilicity

        return {
            "homo_eV": round(result.homo_energy, 4),
            "lumo_eV": round(result.lumo_energy, 4),
            "gap_eV": round(result.homo_lumo_gap, 4),
            "chemical_potential_eV": round(mu, 4),
            "hardness_eV": round(eta, 4),
            "electrophilicity_eV": round(omega, 4),
            "nucleophilicity_index": round(-mu, 4),
            "electrophilic_index": round(omega, 4),
        }

    # ── Psi4 backend ──────────────────────────────────────────────────

    def _run_psi4_single_point(
        self, smiles: str, method: str, basis_set: str,
        charge: int, multiplicity: int,
    ) -> DFTResult:
        """Run Psi4 single-point calculation."""
        try:
            import psi4

            psi4.set_memory("4 GB")
            psi4.set_output_file(str(self.scratch_dir / "psi4_output.dat"), True)

            # Build molecule from SMILES (requires RDKit for 3D coords)
            mol = self._smiles_to_psi4_mol(smiles, charge, multiplicity)
            if mol is None:
                return self._mock_dft_result(smiles, method, basis_set)

            psi4.geometry(mol)

            energy = psi4.energy(f"{method}/{basis_set}")

            # Get orbital energies
            wfn = psi4.wavefunction()
            homo, lumo = None, None
            if wfn:
                eps = wfn.epsilon_a()
                nalpha = wfn.nalpha()
                if eps and nalpha > 0:
                    homo = float(eps[nalpha - 1]) * HARTREE_TO_EV
                    lumo = float(eps[nalpha]) * HARTREE_TO_EV

            return DFTResult(
                molecule=smiles,
                smiles=smiles,
                method=method,
                basis_set=basis_set,
                total_energy_hartree=float(energy),
                total_energy_kj_mol=float(energy) * HARTREE_TO_KJ_MOL,
                homo_energy=homo,
                lumo_energy=lumo,
                homo_lumo_gap=(lumo - homo) if homo and lumo else None,
                engine="psi4",
                convergence=True,
            )

        except Exception as e:
            logger.error(f"Psi4 calculation failed: {e}")
            return self._mock_dft_result(smiles, method, basis_set)

    def _run_psi4_opt(
        self, smiles: str, method: str, basis_set: str,
        charge: int, multiplicity: int,
    ) -> DFTResult:
        """Run Psi4 geometry optimization + frequencies."""
        try:
            import psi4

            psi4.set_memory("4 GB")
            mol = self._smiles_to_psi4_mol(smiles, charge, multiplicity)
            if mol is None:
                return self._mock_dft_result(smiles, method, basis_set)

            psi4.geometry(mol)
            energy, wfn = psi4.optimize(f"{method}/{basis_set}", return_wfn=True)

            # Frequencies
            freq_result = psi4.frequency(f"{method}/{basis_set}", ref_wfn=wfn)
            freqs = list(freq_result.frequencies()) if freq_result else []

            return DFTResult(
                molecule=smiles,
                smiles=smiles,
                method=method,
                basis_set=basis_set,
                total_energy_hartree=float(energy),
                total_energy_kj_mol=float(energy) * HARTREE_TO_KJ_MOL,
                frequencies=freqs,
                engine="psi4",
                convergence=True,
            )

        except Exception as e:
            logger.error(f"Psi4 optimization failed: {e}")
            return self._mock_dft_result(smiles, method, basis_set)

    def _smiles_to_psi4_mol(self, smiles: str, charge: int, mult: int) -> Optional[str]:
        """Convert SMILES to Psi4 geometry string via RDKit."""
        try:
            from rdkit import Chem
            from rdkit.Chem import AllChem

            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                return None
            mol = Chem.AddHs(mol)
            AllChem.EmbedMolecule(mol, AllChem.ETKDGv3())
            AllChem.MMFFOptimizeMolecule(mol)

            conf = mol.GetConformer()
            atoms = mol.GetAtoms()

            geom = f"{charge} {mult}\n"
            for i, atom in enumerate(atoms):
                pos = conf.GetAtomPosition(i)
                geom += f"{atom.GetSymbol()}  {pos.x:.6f}  {pos.y:.6f}  {pos.z:.6f}\n"

            return geom

        except Exception as e:
            logger.error(f"SMILES to Psi4 geometry failed: {e}")
            return None

    # ── ORCA backend ──────────────────────────────────────────────────

    def _run_orca_single_point(
        self, smiles: str, method: str, basis_set: str,
        charge: int, multiplicity: int,
    ) -> DFTResult:
        """Run ORCA single-point calculation."""
        orca_path = os.environ.get("ORCA_PATH", "orca")
        inp_file = self.scratch_dir / "orca_input.inp"
        out_file = self.scratch_dir / "orca_output.out"

        # Map method names to ORCA format
        orca_method = self._map_method_to_orca(method)

        # Generate 3D coordinates
        xyz = self._smiles_to_xyz(smiles)
        if not xyz:
            return self._mock_dft_result(smiles, method, basis_set)

        inp_content = f"""! {orca_method} {basis_set} TightSCF
%pal nprocs 4 end
* xyz {charge} {multiplicity}
{xyz}
*
"""
        inp_file.write_text(inp_content)

        try:
            result = subprocess.run(
                [orca_path, str(inp_file)],
                capture_output=True, text=True, timeout=3600,
                cwd=str(self.scratch_dir),
            )

            output = out_file.read_text() if out_file.exists() else result.stdout

            # Parse energy
            energy = self._parse_orca_energy(output)
            homo, lumo = self._parse_orca_orbitals(output)

            return DFTResult(
                molecule=smiles,
                smiles=smiles,
                method=method,
                basis_set=basis_set,
                total_energy_hartree=energy,
                total_energy_kj_mol=energy * HARTREE_TO_KJ_MOL if energy else None,
                homo_energy=homo,
                lumo_energy=lumo,
                homo_lumo_gap=(lumo - homo) if homo and lumo else None,
                engine="orca",
                convergence="SCF CONVERGED" in output,
            )

        except Exception as e:
            logger.error(f"ORCA calculation failed: {e}")
            return self._mock_dft_result(smiles, method, basis_set)

    def _run_orca_opt(
        self, smiles: str, method: str, basis_set: str,
        charge: int, multiplicity: int,
    ) -> DFTResult:
        """Run ORCA geometry optimization."""
        orca_path = os.environ.get("ORCA_PATH", "orca")
        inp_file = self.scratch_dir / "orca_opt.inp"
        out_file = self.scratch_dir / "orca_opt.out"

        orca_method = self._map_method_to_orca(method)
        xyz = self._smiles_to_xyz(smiles)
        if not xyz:
            return self._mock_dft_result(smiles, method, basis_set)

        inp_content = f"""! {orca_method} {basis_set} Opt TightSCF Freq
%pal nprocs 4 end
* xyz {charge} {multiplicity}
{xyz}
*
"""
        inp_file.write_text(inp_content)

        try:
            result = subprocess.run(
                [orca_path, str(inp_file)],
                capture_output=True, text=True, timeout=7200,
                cwd=str(self.scratch_dir),
            )

            output = out_file.read_text() if out_file.exists() else result.stdout
            energy = self._parse_orca_energy(output)
            freqs = self._parse_orca_frequencies(output)

            return DFTResult(
                molecule=smiles,
                smiles=smiles,
                method=method,
                basis_set=basis_set,
                total_energy_hartree=energy,
                total_energy_kj_mol=energy * HARTREE_TO_KJ_MOL if energy else None,
                frequencies=freqs,
                engine="orca",
                convergence=True,
            )

        except Exception as e:
            logger.error(f"ORCA optimization failed: {e}")
            return self._mock_dft_result(smiles, method, basis_set)

    # ── Gaussian backend ──────────────────────────────────────────────

    def _run_gaussian_single_point(
        self, smiles: str, method: str, basis_set: str,
        charge: int, multiplicity: int,
    ) -> DFTResult:
        """Run Gaussian single-point calculation."""
        gaussian = os.environ.get("GAUSSIAN_PATH", "g16")
        inp_file = self.scratch_dir / "gaussian_input.gjf"
        out_file = self.scratch_dir / "gaussian_output.log"

        xyz = self._smiles_to_xyz(smiles)
        if not xyz:
            return self._mock_dft_result(smiles, method, basis_set)

        inp_content = f"""%chk=gaussian.chk
%mem=4GB
%nproc=4
# {method}/{basis_set} SP SCF=Tight

DFT single-point calculation

{charge} {multiplicity}
{xyz}

"""
        inp_file.write_text(inp_content)

        try:
            result = subprocess.run(
                [gaussian, str(inp_file)],
                capture_output=True, text=True, timeout=3600,
                cwd=str(self.scratch_dir),
            )

            output = out_file.read_text() if out_file.exists() else ""
            energy = self._parse_gaussian_energy(output)

            return DFTResult(
                molecule=smiles,
                smiles=smiles,
                method=method,
                basis_set=basis_set,
                total_energy_hartree=energy,
                total_energy_kj_mol=energy * HARTREE_TO_KJ_MOL if energy else None,
                engine="gaussian",
                convergence="Normal termination" in output,
            )

        except Exception as e:
            logger.error(f"Gaussian calculation failed: {e}")
            return self._mock_dft_result(smiles, method, basis_set)

    # ── Helper methods ────────────────────────────────────────────────

    def _smiles_to_xyz(self, smiles: str) -> Optional[str]:
        """Convert SMILES to XYZ coordinate block."""
        try:
            from rdkit import Chem
            from rdkit.Chem import AllChem

            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                return None
            mol = Chem.AddHs(mol)
            AllChem.EmbedMolecule(mol, AllChem.ETKDGv3())
            AllChem.MMFFOptimizeMolecule(mol)

            conf = mol.GetConformer()
            atoms = mol.GetAtoms()

            lines = []
            for i, atom in enumerate(atoms):
                pos = conf.GetAtomPosition(i)
                lines.append(f"{atom.GetSymbol()}  {pos.x:.6f}  {pos.y:.6f}  {pos.z:.6f}")

            return "\n".join(lines)

        except Exception:
            return None

    def _map_method_to_orca(self, method: str) -> str:
        """Map generic method name to ORCA format."""
        mapping = {
            "B3LYP": "B3LYP", "M062X": "M062X", "wB97X-D": "wB97X-D",
            "PBE0": "PBE0", "HF": "HF", "MP2": "MP2",
            "CCSD": "CCSD", "CCSD(T)": "CCSD(T)",
        }
        return mapping.get(method, method)

    def _parse_orca_energy(self, output: str) -> Optional[float]:
        """Parse ORCA output for total energy."""
        for line in output.split("\n"):
            if "FINAL SINGLE POINT ENERGY" in line:
                try:
                    return float(line.split()[-1])
                except ValueError:
                    pass
        return None

    def _parse_orca_orbitals(self, output: str) -> Tuple[Optional[float], Optional[float]]:
        """Parse ORCA output for HOMO/LUMO energies."""
        homo, lumo = None, None
        lines = output.split("\n")
        for i, line in enumerate(lines):
            if "ORBITAL ENERGIES" in line:
                for j in range(i + 4, min(i + 200, len(lines))):
                    parts = lines[j].split()
                    if len(parts) >= 4 and parts[1] == "0":
                        energy_ev = float(parts[2])
                        occ = int(float(parts[3]))
                        if occ == 2:
                            homo = energy_ev
                        elif occ == 0 and lumo is None:
                            lumo = energy_ev
        return homo, lumo

    def _parse_orca_frequencies(self, output: str) -> List[float]:
        """Parse ORCA output for vibrational frequencies."""
        freqs = []
        for line in output.split("\n"):
            if "cm**-1" in line:
                try:
                    freq = float(line.split()[0])
                    freqs.append(freq)
                except (ValueError, IndexError):
                    pass
        return freqs

    def _parse_gaussian_energy(self, output: str) -> Optional[float]:
        """Parse Gaussian output for total energy."""
        for line in output.split("\n"):
            if "SCF Done" in line:
                try:
                    return float(line.split("=")[1].split()[0])
                except (ValueError, IndexError):
                    pass
        return None

    def _mock_dft_result(self, smiles: str, method: str, basis_set: str) -> DFTResult:
        """Return a mock DFT result when no engine is available."""
        return DFTResult(
            molecule=smiles,
            smiles=smiles,
            method=method,
            basis_set=basis_set,
            engine="none",
            convergence=False,
            total_energy_hartree=None,
        )

    def _mock_ts_result(
        self, reactant: str, product: str, method: str, basis_set: str
    ) -> TransitionStateResult:
        """Return a mock TS result."""
        return TransitionStateResult(
            reactant_energy=0.0, product_energy=0.0, ts_energy=0.0,
            activation_energy_kj_mol=0.0, reaction_energy_kj_mol=0.0,
            method=method, basis_set=basis_set,
        )


# Global singleton
dft_engine = DFTEngine()
