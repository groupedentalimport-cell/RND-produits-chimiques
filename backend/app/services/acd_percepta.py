"""
ACD/Percepta Integration — Validated ADMET property prediction.
Industry-standard for regulatory submissions (CTD Module 3.2.P.8).

ACD/Percepta provides:
  - pKa prediction (most accurate commercial predictor)
  - LogP/LogD prediction
  - Solubility prediction (intrinsic + at any pH)
  - ADMET properties (absorption, distribution, metabolism, excretion, toxicity)
  - Ionization constants
  - Membrane permeability

Pricing: ~5,000–15,000 $/year depending on modules
Contact: https://www.acdlabs.com/
API: ACD/Percepta HTTP API or local installation

When ready:
  1. Contact ACD/Labs: https://www.acdlabs.com/contact/
  2. Select required modules (pKa, LogP, Solubility, ADMET)
  3. Get API key or install locally
  4. Set: ACD_PERCEPTA_API_KEY=your_key or ACD_PERCEPTA_PATH=/path/to/install
"""

import os
import json
import logging
import requests
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class PerceptaPKaResult:
    """pKa prediction result from ACD/Percepta."""
    smiles: str
    pka_values: List[Dict[str, Any]]  # [{value, type, atom_index, confidence}]
    dominant_species_at_ph: Dict[float, str]  # pH → dominant form
    charge_at_ph: Dict[float, float]  # pH → net charge
    isoelectric_point: Optional[float] = None


@dataclass
class PerceptaSolubilityResult:
    """Solubility prediction result."""
    smiles: str
    intrinsic_solubility: float  # log(S) in mol/L
    solubility_at_ph: Dict[float, float]  # pH → log(S)
    solubility_mg_ml: Dict[float, float]  # pH → mg/mL
    unit: str = "log(mol/L)"


@dataclass
class PerceptaLogPResult:
    """LogP/LogD prediction result."""
    smiles: str
    logp: float
    logd_at_ph: Dict[float, float]  # pH → LogD
    method: str = "ACD/Percepta"


@dataclass
class PerceptaADMETResult:
    """ADMET prediction result."""
    smiles: str
    absorption: Dict[str, Any]  # human absorption, Caco-2, etc.
    distribution: Dict[str, Any]  # Vd, protein binding, BBB
    metabolism: Dict[str, Any]  # CYP inhibition, metabolic stability
    excretion: Dict[str, Any]  # clearance, half-life
    toxicity: Dict[str, Any]  # hERG, hepatotoxicity, mutagenicity


class ACDPerceptaEngine:
    """
    ACD/Percepta integration for validated property prediction.
    """

    MODULES = {
        "pka": {
            "name": "ACD/pKa",
            "description": "pKa prediction (most accurate commercial predictor)",
            "pricing": "Included in base package",
            "accuracy": "±0.5 pH units for 95% of compounds",
        },
        "logp": {
            "name": "ACD/LogP",
            "description": "LogP and LogD prediction",
            "pricing": "Included in base package",
            "accuracy": "±0.3 log units for 90% of compounds",
        },
        "solubility": {
            "name": "ACD/Solubility",
            "description": "Aqueous solubility at any pH",
            "pricing": "Add-on module",
            "accuracy": "±0.5 log units for 85% of compounds",
        },
        "admet": {
            "name": "ACD/ADMET",
            "description": "Full ADMET property suite",
            "pricing": "Premium add-on",
            "properties": ["absorption", "distribution", "metabolism", "excretion", "toxicity"],
        },
        "permeability": {
            "name": "ACD/Permeability",
            "description": "Membrane permeability (Caco-2, PAMPA)",
            "pricing": "Add-on module",
        },
    }

    def __init__(self):
        self.api_key = os.environ.get("ACD_PERCEPTA_API_KEY")
        self.api_base = os.environ.get("ACD_PERCEPTA_API", "https://api.acdlabs.com/v1")
        self._available = bool(self.api_key)

    @property
    def is_available(self) -> bool:
        return self._available

    @property
    def status(self) -> Dict[str, Any]:
        return {
            "available": self._available,
            "api_key_set": bool(self.api_key),
            "subscription_required": True,
            "pricing": "~5,000–15,000 $/year (modules)",
            "contact": "https://www.acdlabs.com/",
            "modules": {k: v["name"] for k, v in self.MODULES.items()},
            "note": "Industry standard for regulatory submissions. Accepted by FDA/EMA.",
        }

    def predict_pka(self, smiles: str) -> Optional[PerceptaPKaResult]:
        """Predict pKa values for a molecule."""
        if not self._available:
            return None

        data = self._call_api("pka", {"smiles": smiles})
        if not data:
            return None

        return PerceptaPKaResult(
            smiles=smiles,
            pka_values=data.get("pka_values", []),
            dominant_species_at_ph=data.get("dominant_species", {}),
            charge_at_ph=data.get("charge", {}),
            isoelectric_point=data.get("isoelectric_point"),
        )

    def predict_solubility(self, smiles: str, ph_range: Optional[List[float]] = None) -> Optional[PerceptaSolubilityResult]:
        """Predict aqueous solubility at various pH values."""
        if not self._available:
            return None

        params = {"smiles": smiles}
        if ph_range:
            params["ph_values"] = ",".join(str(p) for p in ph_range)

        data = self._call_api("solubility", params)
        if not data:
            return None

        return PerceptaSolubilityResult(
            smiles=smiles,
            intrinsic_solubility=data.get("intrinsic_solubility", 0),
            solubility_at_ph=data.get("solubility_at_ph", {}),
            solubility_mg_ml=data.get("solubility_mg_ml", {}),
        )

    def predict_logp(self, smiles: str) -> Optional[PerceptaLogPResult]:
        """Predict LogP and LogD at various pH values."""
        if not self._available:
            return None

        data = self._call_api("logp", {"smiles": smiles})
        if not data:
            return None

        return PerceptaLogPResult(
            smiles=smiles,
            logp=data.get("logp", 0),
            logd_at_ph=data.get("logd", {}),
        )

    def predict_admet(self, smiles: str) -> Optional[PerceptaADMETResult]:
        """Predict full ADMET properties."""
        if not self._available:
            return None

        data = self._call_api("admet", {"smiles": smiles})
        if not data:
            return None

        return PerceptaADMETResult(
            smiles=smiles,
            absorption=data.get("absorption", {}),
            distribution=data.get("distribution", {}),
            metabolism=data.get("metabolism", {}),
            excretion=data.get("excretion", {}),
            toxicity=data.get("toxicity", {}),
        )

    def _call_api(self, endpoint: str, params: Dict) -> Optional[Dict]:
        """Call ACD/Percepta API."""
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        try:
            resp = requests.post(f"{self.api_base}/{endpoint}", json=params, headers=headers, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"ACD/Percepta API error: {e}")
            return None


# Global singleton
percepta_engine = ACDPerceptaEngine()
