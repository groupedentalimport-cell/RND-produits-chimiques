"""
Unified Property Prediction Pipeline — Integrates all prediction engines.
Orchestrates RDKit, Chemprop, DeepChem, Vega QSAR, Ersilia, and DFT
for comprehensive molecular property prediction.

Priority order (by confidence):
  1. Experimental data (if available)
  2. DFT calculations (if engine available)
  3. Chemprop MPNN (if trained model exists)
  4. RDKit descriptors + scikit-learn QSPR
  5. Ersilia Hub models
  6. Rule-based estimation (fallback)
"""

import logging
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class UnifiedPrediction:
    """A prediction from the unified pipeline."""
    property_name: str
    value: float
    unit: str
    confidence: float  # 0-1
    method: str  # source of prediction
    source_priority: int  # 1=highest (experimental), 6=lowest (rule-based)
    uncertainty: Optional[float] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MoleculeProfile:
    """Complete property profile for a molecule."""
    smiles: str
    canonical_smiles: str
    molecular_formula: str
    predictions: Dict[str, UnifiedPrediction]
    mutagenicity_alert: Optional[Dict[str, Any]] = None
    stability_score: float = 0.0
    data_quality: float = 0.0
    methods_used: List[str] = field(default_factory=list)


class UnifiedPredictor:
    """
    Unified molecular property prediction pipeline.
    Combines all available prediction methods with priority ordering.
    """

    # Properties we can predict
    PREDICTABLE_PROPERTIES = [
        "solubility", "logp", "logd", "melting_point", "boiling_point",
        "pka", "vapor_pressure", "density", "viscosity",
        "hydrolysis_stability", "oxidation_stability",
        "half_life", "degradation_rate", "stability_score",
    ]

    def __init__(self):
        self._engines = {}
        self._init_engines()

    def _init_engines(self):
        """Initialize all available prediction engines."""
        # RDKit descriptors (always first priority for computed properties)
        try:
            from app.engines.descriptors import compute_descriptors, compute_lipinski_properties
            self._engines["rdkit"] = True
        except ImportError:
            self._engines["rdkit"] = False

        # Chemprop MPNN
        try:
            from app.ml.chemprop_engine import chemprop_engine
            self._engines["chemprop"] = chemprop_engine.is_available
        except ImportError:
            self._engines["chemprop"] = False

        # Vega QSAR
        try:
            from app.engines.vega_qsar import vega_engine
            self._engines["vega"] = True  # Always available via SMARTS
        except ImportError:
            self._engines["vega"] = False

        # Ersilia Hub
        try:
            from app.engines.ersilia_hub import ersilia_hub
            self._engines["ersilia"] = True
        except ImportError:
            self._engines["ersilia"] = False

        # QSPR engine
        try:
            from app.ml.qspr_engine import qspr_pipeline
            self._engines["qspr"] = True
        except ImportError:
            self._engines["qspr"] = False

        # DFT
        try:
            from app.engines.dft_engine import dft_engine
            self._engines["dft"] = dft_engine.is_available
        except ImportError:
            self._engines["dft"] = False

        logger.info(f"Prediction engines: {self._engines}")

    @property
    def available_engines(self) -> Dict[str, bool]:
        return dict(self._engines)

    def predict_all(self, smiles: str) -> MoleculeProfile:
        """
        Predict all available properties for a molecule.
        Returns a complete molecular profile.
        """
        from app.engines.descriptors import (
            compute_descriptors, compute_lipinski_properties,
            compute_full_analysis, standardize_smiles
        )

        canonical = standardize_smiles(smiles)
        if not canonical:
            return MoleculeProfile(
                smiles=smiles, canonical_smiles="", molecular_formula="",
                predictions={}, data_quality=0.0,
            )

        # Full analysis (descriptors + functional groups + fingerprints)
        analysis = compute_full_analysis(canonical)

        predictions = {}

        # 1. Solubility prediction
        predictions["solubility"] = self._predict_solubility(canonical, analysis.descriptors)

        # 2. LogP prediction
        predictions["logp"] = self._predict_logp(canonical, analysis.descriptors)

        # 3. Melting point prediction
        predictions["melting_point"] = self._predict_melting_point(canonical, analysis.descriptors)

        # 4. Stability predictions
        predictions["hydrolysis_stability"] = self._predict_hydrolysis_stability(canonical, analysis)
        predictions["oxidation_stability"] = self._predict_oxidation_stability(canonical, analysis)
        predictions["stability_score"] = self._compute_stability_score(analysis)

        # 5. Mutagenicity (Vega QSAR)
        mutagenicity = None
        if self._engines.get("vega"):
            from app.engines.vega_qsar import vega_engine
            vega_pred = vega_engine.predict_mutagenicity(canonical)
            mutagenicity = {
                "prediction": vega_pred.prediction,
                "probability": vega_pred.probability,
                "alerts": [
                    {"name": a.alert_name, "severity": a.severity}
                    for a in vega_pred.alerts
                ],
                "model": vega_pred.model,
            }

        # Compute overall data quality
        methods_used = list(set(p.method for p in predictions.values()))
        data_quality = self._compute_data_quality(predictions)

        return MoleculeProfile(
            smiles=smiles,
            canonical_smiles=canonical,
            molecular_formula=analysis.molecular_formula,
            predictions=predictions,
            mutagenicity_alert=mutagenicity,
            stability_score=predictions.get("stability_score", UnifiedPrediction("", 0, "", 0, "", 6)).value,
            data_quality=data_quality,
            methods_used=methods_used,
        )

    def _predict_solubility(self, smiles: str, descriptors: Dict[str, float]) -> UnifiedPrediction:
        """Predict aqueous solubility."""
        # Try Chemprop first
        if self._engines.get("chemprop"):
            from app.ml.chemprop_engine import chemprop_engine
            preds = chemprop_engine.predict([smiles], "solubility")
            if preds:
                return UnifiedPrediction(
                    property_name="solubility",
                    value=preds[0].predicted_value,
                    unit="log(mol/L)",
                    confidence=0.8,
                    method="chemprop_mpnn",
                    source_priority=3,
                    uncertainty=preds[0].uncertainty,
                )

        # Try QSPR
        if self._engines.get("qspr"):
            from app.ml.qspr_engine import qspr_pipeline
            if "solubility" in qspr_pipeline.models:
                desc_vector = np.array(list(descriptors.values())[:50])
                pred = qspr_pipeline.predict(desc_vector, "solubility", list(descriptors.keys())[:50])
                if pred.confidence > 0:
                    return UnifiedPrediction(
                        property_name="solubility",
                        value=pred.predicted_value,
                        unit="log(mol/L)",
                        confidence=pred.confidence,
                        method="qspr_sklearn",
                        source_priority=4,
                        uncertainty=pred.uncertainty,
                    )

        # RDKit estimation (MolLogP-based rough estimate)
        logp = descriptors.get("MolLogP", 0)
        mw = descriptors.get("MolWt", 180)
        # Rough Delaney-type estimate
        sol_est = 0.16 - 0.63 * logp - 0.0062 * mw + 0.066 * descriptors.get("RotatableBonds", 0)
        return UnifiedPrediction(
            property_name="solubility",
            value=round(sol_est, 2),
            unit="log(mol/L)",
            confidence=0.4,
            method="rdkit_estimation",
            source_priority=6,
        )

    def _predict_logp(self, smiles: str, descriptors: Dict[str, float]) -> UnifiedPrediction:
        """Predict LogP (octanol-water partition coefficient)."""
        # RDKit has a good LogP calculator built-in
        logp = descriptors.get("MolLogP", None)
        if logp is not None:
            return UnifiedPrediction(
                property_name="logp",
                value=round(logp, 2),
                unit="dimensionless",
                confidence=0.7,
                method="rdkit_wildman_crippen",
                source_priority=4,
            )
        return UnifiedPrediction(property_name="logp", value=0, unit="dimensionless", confidence=0, method="none", source_priority=6)

    def _predict_melting_point(self, smiles: str, descriptors: Dict[str, float]) -> UnifiedPrediction:
        """Predict melting point."""
        # Rough estimation from molecular properties
        mw = descriptors.get("MolWt", 180)
        logp = descriptors.get("MolLogP", 0)
        hbd = descriptors.get("NumHDonors", 0)
        hba = descriptors.get("NumHAcceptors", 0)
        rotb = descriptors.get("NumRotatableBonds", 0)

        # Very rough estimation (would need trained model for accuracy)
        mp_est = 50 + 0.5 * mw - 10 * logp + 20 * hbd + 5 * hba - 3 * rotb
        mp_est = max(-50, min(400, mp_est))

        return UnifiedPrediction(
            property_name="melting_point",
            value=round(mp_est, 1),
            unit="°C",
            confidence=0.3,
            method="rdkit_estimation",
            source_priority=6,
        )

    def _predict_hydrolysis_stability(self, smiles: str, analysis) -> UnifiedPrediction:
        """Predict hydrolysis stability from functional group analysis."""
        fg = analysis.functional_groups
        hydrolysis_risks = [r for r in fg.instability_risks if r.get("risk_type") == "hydrolysis"]

        if not hydrolysis_risks:
            score = 95.0  # very stable
        else:
            penalty = sum(
                {"low": 5, "moderate": 15, "high": 25, "critical": 40}.get(r["severity"], 10) * r["count"]
                for r in hydrolysis_risks
            )
            score = max(0, 100 - penalty)

        return UnifiedPrediction(
            property_name="hydrolysis_stability",
            value=round(score, 1),
            unit="score (0-100)",
            confidence=0.6,
            method="smarts_risk_engine",
            source_priority=5,
            details={"risks": hydrolysis_risks},
        )

    def _predict_oxidation_stability(self, smiles: str, analysis) -> UnifiedPrediction:
        """Predict oxidation stability from functional group analysis."""
        fg = analysis.functional_groups
        ox_risks = [r for r in fg.instability_risks if r.get("risk_type") == "oxidation"]

        if not ox_risks:
            score = 95.0
        else:
            penalty = sum(
                {"low": 5, "moderate": 15, "high": 25, "critical": 40}.get(r["severity"], 10) * r["count"]
                for r in ox_risks
            )
            score = max(0, 100 - penalty)

        return UnifiedPrediction(
            property_name="oxidation_stability",
            value=round(score, 1),
            unit="score (0-100)",
            confidence=0.6,
            method="smarts_risk_engine",
            source_priority=5,
            details={"risks": ox_risks},
        )

    def _compute_stability_score(self, analysis) -> UnifiedPrediction:
        """Compute overall stability score."""
        fg = analysis.functional_groups
        return UnifiedPrediction(
            property_name="stability_score",
            value=round(fg.overall_instability_score, 1),
            unit="score (0-100)",
            confidence=0.5,
            method="smart_patterns",
            source_priority=5,
        )

    def _compute_data_quality(self, predictions: Dict[str, UnifiedPrediction]) -> float:
        """Compute overall data quality score."""
        if not predictions:
            return 0.0
        confidences = [p.confidence for p in predictions.values()]
        priorities = [p.source_priority for p in predictions.values()]
        avg_conf = np.mean(confidences)
        avg_priority = np.mean(priorities)
        # Quality = confidence * (1 - priority/6)
        return min(avg_conf * (1 - avg_priority / 6 + 0.1), 1.0)


# Global singleton
unified_predictor = UnifiedPredictor()
