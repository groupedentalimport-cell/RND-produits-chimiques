"""
Experimental Data Sources — Integration with ChEMBL, PubChem, ESOL/FreeSolv, NIST.
Replaces simulated data with real experimental measurements.
"""

from app.services.experimental.chembl_experimental import ChEMBLExperimentalLoader
from app.services.experimental.pubchem_experimental import PubChemExperimentalLoader
from app.services.experimental.benchmark_loaders import (
    ESOLLoader, FreeSolvLoader, LipophilicityLoader
)
from app.services.experimental.nist_webbook import NISTWebBookLoader
from app.services.experimental.data_registry import ExperimentalDataRegistry

__all__ = [
    "ChEMBLExperimentalLoader",
    "PubChemExperimentalLoader",
    "ESOLLoader",
    "FreeSolvLoader",
    "LipophilicityLoader",
    "NISTWebBookLoader",
    "ExperimentalDataRegistry",
]
