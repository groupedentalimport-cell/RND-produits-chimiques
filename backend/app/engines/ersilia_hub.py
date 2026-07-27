"""
Ersilia Hub Integration — 200+ open-source QSPR models.
Provides access to pre-trained models for ADMET, toxicity, solubility, etc.

Ersilia Hub: https://ersilia.io/model-hub
All models are open-source and run locally via the Ersilia CLI.
This module provides a Python wrapper for common models.
"""

import logging
import json
import subprocess
import tempfile
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class ErsiliaPrediction:
    """Prediction from an Ersilia model."""
    model_id: str
    model_name: str
    property_name: str
    input_smiles: str
    predicted_value: Any
    confidence: Optional[float] = None
    unit: str = ""
    description: str = ""
    source: str = "ersilia_hub"


# ── Popular Ersilia models for chemical stability ─────────────────────

ERSILIA_MODELS = {
    # Solubility & LogP
    "solubility": {
        "model_id": "eos7d58",
        "name": "Aqueous Solubility (ESOL)",
        "description": "Prediction of aqueous solubility from molecular structure",
        "unit": "log(mol/L)",
        "property": "solubility",
    },
    "logp": {
        "model_id": "eos3b5e",
        "name": "LogP (Wildman-Crippen)",
        "description": "Prediction of octanol-water partition coefficient",
        "unit": "dimensionless",
        "property": "logp",
    },
    "logd": {
        "model_id": "eos4wt0",
        "name": "LogD at pH 7.4",
        "description": "Distribution coefficient at physiological pH",
        "unit": "dimensionless",
        "property": "logd",
    },

    # ADMET
    "absorption": {
        "model_id": "eos7sis",
        "name": "Human Intestinal Absorption",
        "description": "Probability of human intestinal absorption > 30%",
        "unit": "probability",
        "property": "absorption",
    },
    "bbb_permeability": {
        "model_id": "eos4d9z",
        "name": "Blood-Brain Barrier Permeability",
        "description": "Probability of BBB penetration",
        "unit": "probability",
        "property": "bbb_permeability",
    },
    "pgp_substrate": {
        "model_id": "eos3c58",
        "name": "P-glycoprotein Substrate",
        "description": "Probability of being a P-gp substrate",
        "unit": "probability",
        "property": "pgp_substrate",
    },
    "cyp_inhibition": {
        "model_id": "eos4xti",
        "name": "CYP450 Inhibition",
        "description": "Probability of CYP450 inhibition",
        "unit": "probability",
        "property": "cyp_inhibition",
    },
    "hepatotoxicity": {
        "model_id": "eos8d58",
        "name": "Hepatotoxicity",
        "description": "Probability of hepatotoxic effect",
        "unit": "probability",
        "property": "hepatotoxicity",
    },

    # Toxicity
    "ld50": {
        "model_id": "eos4u6v",
        "name": "Oral Rat LD50",
        "description": "Median lethal dose (oral, rat)",
        "unit": "log(mol/kg)",
        "property": "ld50",
    },
    "ames_mutagenicity": {
        "model_id": "eos5axz",
        "name": "Ames Mutagenicity",
        "description": "Probability of Ames test positive (mutagenic)",
        "unit": "probability",
        "property": "ames_mutagenicity",
    },
    "skin_sensitization": {
        "model_id": "eos8ioa",
        "name": "Skin Sensitization",
        "description": "Probability of skin sensitization",
        "unit": "probability",
        "property": "skin_sensitization",
    },

    # Physical properties
    "melting_point": {
        "model_id": "eos4e44",
        "name": "Melting Point",
        "description": "Prediction of melting point",
        "unit": "°C",
        "property": "melting_point",
    },
    "boiling_point": {
        "model_id": "eos3bve",
        "name": "Boiling Point",
        "description": "Prediction of boiling point",
        "unit": "°C",
        "property": "boiling_point",
    },
    "vapor_pressure": {
        "model_id": "eos74d8",
        "name": "Vapor Pressure",
        "description": "Prediction of vapor pressure at 25°C",
        "unit": "log(mmHg)",
        "property": "vapor_pressure",
    },

    # Stability-specific
    "hydrolysis_stability": {
        "model_id": "eos9fia",
        "name": "Hydrolysis Stability",
        "description": "Prediction of hydrolytic stability",
        "unit": "probability",
        "property": "hydrolysis_stability",
    },
    "oxidation_stability": {
        "model_id": "eos7ki0",
        "name": "Oxidation Stability",
        "description": "Prediction of oxidative stability",
        "unit": "probability",
        "property": "oxidation_stability",
    },
}


class ErsiliaHub:
    """
    Interface to Ersilia Hub for pre-trained QSPR models.
    Models run locally via the Ersilia CLI or Python API.
    """

    def __init__(self, use_cli: bool = False):
        self.use_cli = use_cli
        self._model_cache: Dict[str, Any] = {}
        self._ersilia_available = self._check_ersilia()

    def _check_ersilia(self) -> bool:
        """Check if Ersilia CLI is available."""
        if not self.use_cli:
            return False
        try:
            result = subprocess.run(
                ["ersilia", "--version"],
                capture_output=True, text=True, timeout=10
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def list_models(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """List available models, optionally filtered by category."""
        models = []
        for key, info in ERSILIA_MODELS.items():
            if category and category not in key and category not in info.get("description", ""):
                continue
            models.append({
                "id": info["model_id"],
                "key": key,
                "name": info["name"],
                "description": info["description"],
                "unit": info["unit"],
                "property": info["property"],
            })
        return models

    def get_model_info(self, model_key: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific model."""
        if model_key in ERSILIA_MODELS:
            info = ERSILIA_MODELS[model_key]
            return {
                "id": info["model_id"],
                "key": model_key,
                "name": info["name"],
                "description": info["description"],
                "unit": info["unit"],
                "property": info["property"],
                "available": True,
            }
        return None

    def predict(
        self,
        model_key: str,
        smiles: str,
    ) -> Optional[ErsiliaPrediction]:
        """
        Run prediction using an Ersilia model.
        If Ersilia CLI is not available, returns None (use other methods).
        """
        if model_key not in ERSILIA_MODELS:
            logger.warning(f"Unknown model: {model_key}")
            return None

        model_info = ERSILIA_MODELS[model_key]

        if not self._ersilia_available:
            logger.debug(f"Ersilia CLI not available, skipping {model_key}")
            return None

        try:
            result = self._run_ersilia_model(model_info["model_id"], smiles)
            if result is not None:
                return ErsiliaPrediction(
                    model_id=model_info["model_id"],
                    model_name=model_info["name"],
                    property_name=model_info["property"],
                    input_smiles=smiles,
                    predicted_value=result,
                    unit=model_info["unit"],
                    description=model_info["description"],
                )
        except Exception as e:
            logger.warning(f"Ersilia prediction failed for {model_key}: {e}")

        return None

    def _run_ersilia_model(self, model_id: str, smiles: str) -> Optional[float]:
        """Run an Ersilia model via CLI."""
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
                f.write("smiles\n" + smiles + "\n")
                input_file = f.name

            result = subprocess.run(
                ["ersilia", "serve", model_id],
                capture_output=True, text=True, timeout=30,
            )

            result = subprocess.run(
                ["ersilia", "run", "-i", input_file],
                capture_output=True, text=True, timeout=60,
            )

            if result.returncode == 0:
                output = json.loads(result.stdout)
                if output and len(output) > 0:
                    return float(output[0].get("value", output[0]))

        except Exception as e:
            logger.debug(f"Ersilia CLI error: {e}")

        return None

    def batch_predict(
        self,
        model_key: str,
        smiles_list: List[str],
    ) -> List[Optional[ErsiliaPrediction]]:
        """Run predictions for multiple SMILES."""
        return [self.predict(model_key, smi) for smi in smiles_list]

    def multi_property_predict(
        self,
        smiles: str,
        properties: Optional[List[str]] = None,
    ) -> Dict[str, Optional[ErsiliaPrediction]]:
        """
        Predict multiple properties for a single molecule.
        If properties is None, predicts all available.
        """
        if properties is None:
            properties = list(ERSILIA_MODELS.keys())

        results = {}
        for prop in properties:
            results[prop] = self.predict(prop, smiles)
        return results


# Global singleton
ersilia_hub = ErsiliaHub()
