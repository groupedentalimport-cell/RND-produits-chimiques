"""
Benchmark Dataset Loaders — ESOL, FreeSolv, Lipophilicity (MoleculeNet).
These provide experimental solubility, solvation free energy, and LogP data
for training and validating QSPR models.

Sources:
  - ESOL (Delaney 2004): Experimental aqueous solubility for 1,128 compounds
  - FreeSolv (Mobley & Guthrie 2014): Experimental hydration free energy for 642 compounds
  - Lipophilicity (Wu et al. 2018): Experimental LogD at pH 7.4 for 4,200 compounds
"""

import csv
import io
import logging
import requests
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# MoleculeNet / DeepChem benchmark URLs
ESOL_URL = "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/delaney-processed.csv"
FREESOLV_URL = "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/SAMPL.csv"
LIPO_URL = "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/Lipophilicity.csv"


@dataclass
class BenchmarkCompound:
    """A compound from a benchmark dataset with experimental value."""
    smiles: str
    experimental_value: float
    property_name: str  # "solubility", "hydration_free_energy", "logp"
    unit: str
    dataset: str  # "esol", "freesolv", "lipo"
    compound_id: Optional[str] = None
    name: Optional[str] = None


class ESOLLoader:
    """
    ESOL (Estimated SOLubility) dataset — Delaney 2004.
    Experimental aqueous solubility (log mol/L) for 1,128 compounds.
    Reference: Delaney, J. S. (2004). J. Chem. Inf. Comput. Sci., 44(3), 1000-1005.
    """

    PROPERTY_NAME = "solubility"
    UNIT = "log(mol/L)"
    DATASET = "esol"

    def __init__(self):
        self._cache: Optional[List[BenchmarkCompound]] = None

    def load(self) -> List[BenchmarkCompound]:
        """Load ESOL dataset from MoleculeNet."""
        if self._cache is not None:
            return self._cache

        compounds = []
        try:
            resp = requests.get(ESOL_URL, timeout=60)
            resp.raise_for_status()
            reader = csv.DictReader(io.StringIO(resp.text))

            for row in reader:
                smiles = row.get("smiles", "").strip()
                value = row.get("measured log solubility in mols per litre", "")
                name = row.get("Compound ID", "").strip()

                if not smiles or not value:
                    continue

                try:
                    solubility = float(value)
                except ValueError:
                    continue

                compounds.append(BenchmarkCompound(
                    smiles=smiles,
                    experimental_value=solubility,
                    property_name=self.PROPERTY_NAME,
                    unit=self.UNIT,
                    dataset=self.DATASET,
                    name=name if name else None,
                ))

            logger.info(f"Loaded {len(compounds)} compounds from ESOL dataset")
        except Exception as e:
            logger.error(f"Failed to load ESOL dataset: {e}")

        self._cache = compounds
        return compounds

    def get_training_data(self) -> Tuple[List[str], List[float]]:
        """Get SMILES and experimental values for QSPR training."""
        compounds = self.load()
        smiles_list = [c.smiles for c in compounds]
        values = [c.experimental_value for c in compounds]
        return smiles_list, values


class FreeSolvLoader:
    """
    FreeSolv dataset — Mobley & Guthrie 2014.
    Experimental hydration free energy (kcal/mol) for 642 compounds.
    Reference: Mobley, D. L., & Guthrie, J. P. (2014). J. Comput.-Aided Mol. Des., 28(7), 711-720.
    """

    PROPERTY_NAME = "hydration_free_energy"
    UNIT = "kcal/mol"
    DATASET = "freesolv"

    def __init__(self):
        self._cache: Optional[List[BenchmarkCompound]] = None

    def load(self) -> List[BenchmarkCompound]:
        """Load FreeSolv dataset from MoleculeNet."""
        if self._cache is not None:
            return self._cache

        compounds = []
        try:
            resp = requests.get(FREESOLV_URL, timeout=60)
            resp.raise_for_status()
            reader = csv.DictReader(io.StringIO(resp.text))

            for row in reader:
                smiles = row.get("smiles", "").strip()
                value = row.get("expt", "")
                name = row.get("Compound ID", "").strip()

                if not smiles or not value:
                    continue

                try:
                    dG = float(value)
                except ValueError:
                    continue

                compounds.append(BenchmarkCompound(
                    smiles=smiles,
                    experimental_value=dG,
                    property_name=self.PROPERTY_NAME,
                    unit=self.UNIT,
                    dataset=self.DATASET,
                    name=name if name else None,
                ))

            logger.info(f"Loaded {len(compounds)} compounds from FreeSolv dataset")
        except Exception as e:
            logger.error(f"Failed to load FreeSolv dataset: {e}")

        self._cache = compounds
        return compounds

    def get_training_data(self) -> Tuple[List[str], List[float]]:
        compounds = self.load()
        return [c.smiles for c in compounds], [c.experimental_value for c in compounds]


class LipophilicityLoader:
    """
    Lipophilicity dataset — Wu et al. 2018 (MoleculeNet).
    Experimental LogD at pH 7.4 for 4,200 compounds from ChEMBL.
    Reference: Wu, Z., et al. (2018). J. Chem. Inf. Model., 58(3), 556-567.
    """

    PROPERTY_NAME = "logd"
    UNIT = "dimensionless"
    DATASET = "lipophilicity"

    def __init__(self):
        self._cache: Optional[List[BenchmarkCompound]] = None

    def load(self) -> List[BenchmarkCompound]:
        """Load Lipophilicity dataset from MoleculeNet."""
        if self._cache is not None:
            return self._cache

        compounds = []
        try:
            resp = requests.get(LIPO_URL, timeout=60)
            resp.raise_for_status()
            reader = csv.DictReader(io.StringIO(resp.text))

            for row in reader:
                smiles = row.get("smiles", "").strip()
                value = row.get("exp", "")

                if not smiles or not value:
                    continue

                try:
                    logd = float(value)
                except ValueError:
                    continue

                compounds.append(BenchmarkCompound(
                    smiles=smiles,
                    experimental_value=logd,
                    property_name=self.PROPERTY_NAME,
                    unit=self.UNIT,
                    dataset=self.DATASET,
                ))

            logger.info(f"Loaded {len(compounds)} compounds from Lipophilicity dataset")
        except Exception as e:
            logger.error(f"Failed to load Lipophilicity dataset: {e}")

        self._cache = compounds
        return compounds

    def get_training_data(self) -> Tuple[List[str], List[float]]:
        compounds = self.load()
        return [c.smiles for c in compounds], [c.experimental_value for c in compounds]


class BenchmarkAggregator:
    """
    Aggregate all benchmark datasets for multi-task QSPR training.
    Provides unified access to experimental data from ESOL, FreeSolv, and Lipophilicity.
    """

    def __init__(self):
        self.esol = ESOLLoader()
        self.freesolv = FreeSolvLoader()
        self.lipo = LipophilicityLoader()

    def load_all(self) -> Dict[str, List[BenchmarkCompound]]:
        """Load all benchmark datasets."""
        return {
            "esol": self.esol.load(),
            "freesolv": self.freesolv.load(),
            "lipophilicity": self.lipo.load(),
        }

    def get_all_training_data(self) -> Dict[str, Tuple[List[str], List[float]]]:
        """Get training data for all properties."""
        return {
            "solubility": self.esol.get_training_data(),
            "hydration_free_energy": self.freesolv.get_training_data(),
            "logd": self.lipo.get_training_data(),
        }

    def summary(self) -> Dict[str, Any]:
        """Summary statistics of all loaded datasets."""
        all_data = self.load_all()
        return {
            dataset: {
                "count": len(compounds),
                "property": compounds[0].property_name if compounds else None,
                "unit": compounds[0].unit if compounds else None,
            }
            for dataset, compounds in all_data.items()
        }
