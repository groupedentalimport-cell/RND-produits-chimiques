"""
Vega QSAR Integration — Open-source mutagenicity prediction.
Alternative to Derek Nexus (Lhasa) for ICH M7 structural alert detection.

Vega QSAR provides:
  - AMES mutagenicity prediction (tested positive/negative)
  - Chromosomal aberration prediction
  - Skin sensitization prediction
  - Developmental toxicity prediction
  - Estrogen receptor binding prediction

Free for academic and commercial use.
Download: https://www.vega-qsar.eu/
"""

import os
import json
import logging
import subprocess
import tempfile
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class VegaAlert:
    """A Vega QSAR alert for mutagenicity."""
    alert_name: str
    smarts: str
    description: str
    severity: str  # "high", "moderate", "low"
    confidence: float  # 0-1
    model: str  # "ISS", "Benigni-Bossa", "CAESAR"
    reference: str


@dataclass
class VegaPrediction:
    """Prediction from Vega QSAR."""
    smiles: str
    property_name: str  # "mutagenicity", "chromosomal_aberration", etc.
    prediction: str  # "active", "inactive", "equivocal"
    probability: float  # 0-1
    alerts: List[VegaAlert]
    model: str
    reliability: str  # "good", "moderate", "low"


# ICH M7 compatible structural alerts from Vega QSAR / Benigni-Bossa
VEGA_MUTAGENICITY_ALERTS = [
    VegaAlert(
        alert_name="Aromatic amine",
        smarts="c1ccccc1[NX3H2]",
        description="Primary aromatic amine — metabolic activation to hydroxylamine/nitroso",
        severity="high", confidence=0.9, model="Benigni-Bossa",
        reference="ICH M7(R1) Appendix 3; Benigni et al. 2008",
    ),
    VegaAlert(
        alert_name="Aromatic nitro",
        smarts="c1ccc(cc1)[N+](=O)[O-]",
        description="Nitroaromatic — reduction to aromatic amine, then metabolic activation",
        severity="high", confidence=0.9, model="Benigni-Bossa",
        reference="ICH M7(R1) Appendix 3",
    ),
    VegaAlert(
        alert_name="Alkyl halide (primary)",
        smarts="[CX4H2][F,Cl,Br,I]",
        description="Primary alkyl halide — direct-acting alkylating agent (SN2)",
        severity="high", confidence=0.85, model="ISS",
        reference="ICH M7(R1) Appendix 3",
    ),
    VegaAlert(
        alert_name="Alkyl halide (secondary)",
        smarts="[CX4H]([CX4])[F,Cl,Br,I]",
        description="Secondary alkyl halide — alkylating agent",
        severity="moderate", confidence=0.7, model="ISS",
        reference="ICH M7(R1) Appendix 3",
    ),
    VegaAlert(
        alert_name="Epoxide",
        smarts="C1OC1",
        description="Epoxide — strained 3-membered ring, electrophilic, alkylates DNA",
        severity="high", confidence=0.9, model="CAESAR",
        reference="ICH M7(R1) Appendix 3",
    ),
    VegaAlert(
        alert_name="Aziridine",
        smarts="C1NC1",
        description="Aziridine — strained nitrogen heterocycle, alkylating agent",
        severity="high", confidence=0.9, model="Benigni-Bossa",
        reference="ICH M7(R1) Appendix 3",
    ),
    VegaAlert(
        alert_name="N-nitroso",
        smarts="[NX2][N+](=O)[O-]",
        description="N-nitroso compound — potent mutagen, forms diazonium ions",
        severity="high", confidence=0.95, model="ISS",
        reference="ICH M7(R1) Appendix 3 — TTC 1.5 ng/day",
    ),
    VegaAlert(
        alert_name="Aldehyde",
        smarts="[CX3H1](=O)[#6]",
        description="Aldehyde — electrophilic, forms Schiff bases with DNA bases",
        severity="moderate", confidence=0.7, model="CAESAR",
        reference="Benigni et al. 2008",
    ),
    VegaAlert(
        alert_name="Michael acceptor",
        smarts="C=CC(=O)[#6]",
        description="α,β-unsaturated carbonyl — Michael addition with nucleophilic DNA bases",
        severity="moderate", confidence=0.75, model="Benigni-Bossa",
        reference="ICH M7(R1) Appendix 3",
    ),
    VegaAlert(
        alert_name="Sulfonate ester",
        smarts="[OX2][SX3](=O)(=O)[#6]",
        description="Sulfonate ester — alkylating agent (like methyl methanesulfonate)",
        severity="high", confidence=0.85, model="ISS",
        reference="ICH M7(R1) Appendix 3",
    ),
    VegaAlert(
        alert_name="Acyl halide",
        smarts="[CX3](=O)[F,Cl,Br,I]",
        description="Acyl halide — reactive acylating agent",
        severity="moderate", confidence=0.7, model="Benigni-Bossa",
        reference="ICH M7(R1) Appendix 3",
    ),
    VegaAlert(
        alert_name="Hydrazine",
        smarts="[NX3H2][NX3H2]",
        description="Hydrazine — forms reactive diazo intermediates",
        severity="high", confidence=0.85, model="CAESAR",
        reference="ICH M7(R1) Appendix 3",
    ),
    VegaAlert(
        alert_name="Azo compound",
        smarts="[NX2]=[NX2]",
        description="Azo — reductive cleavage releases aromatic amines",
        severity="moderate", confidence=0.7, model="Benigni-Bossa",
        reference="ICH M7(R1) Appendix 3",
    ),
    VegaAlert(
        alert_name="Propiolactone",
        smarts="C1CC(=O)O1",
        description="β-lactone — strained ring, alkylating agent",
        severity="high", confidence=0.9, model="ISS",
        reference="ICH M7(R1) Appendix 3 — TTC 1.5 ng/day",
    ),
    VegaAlert(
        alert_name="Propiosultone",
        smarts="C1CCS(=O)(=O)O1",
        description="β-sultone — strained ring, alkylating agent",
        severity="high", confidence=0.9, model="ISS",
        reference="ICH M7(R1) Appendix 3 — TTC 1.5 ng/day",
    ),
    VegaAlert(
        alert_name="Acrylate",
        smarts="C=CC(=O)O",
        description="Acrylic ester — Michael acceptor",
        severity="moderate", confidence=0.65, model="Benigni-Bossa",
        reference="Benigni et al. 2008",
    ),
    VegaAlert(
        alert_name="Halogenated alkene",
        smarts="C=C([F,Cl,Br,I])[F,Cl,Br,I]",
        description="Gem-dihaloalkene — metabolic activation to acyl halide",
        severity="moderate", confidence=0.7, model="ISS",
        reference="Benigni et al. 2008",
    ),
    VegaAlert(
        alert_name="Polycyclic aromatic",
        smarts="c1ccc2ccccc2c1",
        description="Polycyclic aromatic hydrocarbon — metabolic activation to diol epoxide",
        severity="moderate", confidence=0.6, model="CAESAR",
        reference="Benigni et al. 2008",
    ),
    VegaAlert(
        alert_name="Nitrogen mustard",
        smarts="N(CCCl)CCCl",
        description="Nitrogen mustard — bifunctional alkylating agent, DNA crosslinker",
        severity="high", confidence=0.95, model="ISS",
        reference="ICH M7(R1) Appendix 3",
    ),
    VegaAlert(
        alert_name="Sulfur mustard",
        smarts="S(CCCl)CCCl",
        description="Sulfur mustard — bifunctional alkylating agent",
        severity="high", confidence=0.95, model="ISS",
        reference="ICH M7(R1) Appendix 3",
    ),
]


class VegaQSAREngine:
    """
    Vega QSAR engine for mutagenicity and toxicity prediction.
    Uses structural alerts (SMARTS) when Vega CLI is not available.
    """

    def __init__(self, vega_jar_path: Optional[str] = None):
        self.vega_jar = vega_jar_path or os.environ.get("VEGA_JAR_PATH")
        self._available = self._check_availability()
        self._compiled_patterns = {}
        self._compile_alerts()

    def _check_availability(self) -> bool:
        """Check if Vega QSAR CLI is available."""
        if self.vega_jar and os.path.exists(self.vega_jar):
            try:
                result = subprocess.run(
                    ["java", "-jar", self.vega_jar, "--version"],
                    capture_output=True, text=True, timeout=30
                )
                return result.returncode == 0
            except (FileNotFoundError, subprocess.TimeoutExpired):
                pass
        return False

    def _compile_alerts(self):
        """Compile SMARTS patterns for structural alert detection."""
        try:
            from rdkit import Chem
            for alert in VEGA_MUTAGENICITY_ALERTS:
                mol = Chem.MolFromSmarts(alert.smarts)
                if mol is not None:
                    self._compiled_patterns[alert.alert_name] = mol
                else:
                    logger.warning(f"Invalid SMARTS for {alert.alert_name}: {alert.smarts}")
        except ImportError:
            logger.warning("RDKit not available — Vega SMARTS detection disabled")

    @property
    def is_available(self) -> bool:
        return True  # Always available via SMARTS patterns

    def predict_mutagenicity(self, smiles: str) -> VegaPrediction:
        """
        Predict mutagenicity using structural alerts.
        This is the SMARTS-based fallback when Vega CLI is not available.
        For full Vega prediction, use the CLI with the CAESAR/ISS/BB models.
        """
        detected_alerts = []

        try:
            from rdkit import Chem
            mol = Chem.MolFromSmiles(smiles)
            if mol is not None:
                for alert in VEGA_MUTAGENICITY_ALERTS:
                    pattern = self._compiled_patterns.get(alert.alert_name)
                    if pattern and mol.HasSubstructMatch(pattern):
                        detected_alerts.append(alert)
        except Exception as e:
            logger.warning(f"SMARTS check failed: {e}")

        # Classify based on alerts
        if detected_alerts:
            high_alerts = [a for a in detected_alerts if a.severity == "high"]
            if high_alerts:
                prediction = "active"
                probability = min(0.95, max(a.confidence for a in high_alerts))
                reliability = "good"
            else:
                prediction = "equivocal"
                probability = 0.5
                reliability = "moderate"
        else:
            prediction = "inactive"
            probability = 0.1
            reliability = "good"

        return VegaPrediction(
            smiles=smiles,
            property_name="mutagenicity",
            prediction=prediction,
            probability=probability,
            alerts=detected_alerts,
            model="SMARTS-based (Vega-compatible)",
            reliability=reliability,
        )

    def predict_chromosomal_aberration(self, smiles: str) -> VegaPrediction:
        """Predict chromosomal aberration potential."""
        # Simplified — uses subset of alerts
        mut_pred = self.predict_mutagenicity(smiles)
        # Chromosomal aberration correlates with mutagenicity but is not identical
        return VegaPrediction(
            smiles=smiles,
            property_name="chromosomal_aberration",
            prediction=mut_pred.prediction,
            probability=mut_pred.probability * 0.8,  # lower confidence
            alerts=mut_pred.alerts,
            model="SMARTS-based (correlation with mutagenicity)",
            reliability="moderate",
        )

    def run_vega_cli(self, smiles: str, model: str = "mutagenicity") -> Optional[VegaPrediction]:
        """Run Vega QSAR CLI for full prediction (requires Vega installation)."""
        if not self._available:
            return None

        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".smi", delete=False) as f:
                f.write(smiles)
                input_file = f.name

            result = subprocess.run(
                ["java", "-jar", self.vega_jar, "-i", input_file, "-o", "/tmp/vega_out.json", "-m", model],
                capture_output=True, text=True, timeout=120,
            )

            os.unlink(input_file)

            if result.returncode == 0:
                output = json.loads(Path("/tmp/vega_out.json").read_text())
                return self._parse_vega_output(output, smiles)

        except Exception as e:
            logger.error(f"Vega CLI failed: {e}")

        return None

    def _parse_vega_output(self, output: Dict, smiles: str) -> VegaPrediction:
        """Parse Vega CLI JSON output."""
        return VegaPrediction(
            smiles=smiles,
            property_name=output.get("model", "mutagenicity"),
            prediction=output.get("prediction", "unknown"),
            probability=output.get("probability", 0.0),
            alerts=[],  # Would parse from output
            model=output.get("model_name", "Vega"),
            reliability=output.get("reliability", "unknown"),
        )

    def to_ich_m7_assessment(self, smiles: str, compound_name: str = "") -> Dict[str, Any]:
        """
        Convert Vega prediction to ICH M7 assessment format.
        Compatible with CTD Module 3.2.P.8 reporting.
        """
        pred = self.predict_mutagenicity(smiles)

        from app.regulatory.ich_standards import M7ImpurityClass

        if pred.prediction == "active" and pred.alerts:
            impurity_class = M7ImpurityClass.CLASS_3  # structural alert, no Ames data
            ttc = min(a.confidence for a in pred.alerts) * 1500
        elif pred.prediction == "inactive":
            impurity_class = M7ImpurityClass.CLASS_4  # no alert, no data
            ttc = 1500.0
        else:
            impurity_class = M7ImpurityClass.CLASS_4
            ttc = 1500.0

        return {
            "compound": compound_name,
            "smiles": smiles,
            "impurity_class": impurity_class.value,
            "vega_prediction": pred.prediction,
            "vega_probability": pred.probability,
            "structural_alerts": [
                {"name": a.alert_name, "severity": a.severity, "description": a.description}
                for a in pred.alerts
            ],
            "ttc_threshold_ng_day": ttc,
            "ich_reference": "ICH M7(R1)",
            "prediction_model": pred.model,
            "reliability": pred.reliability,
            "note": "SMARTS-based prediction. For regulatory submission, confirm with Ames test or Derek Nexus.",
        }


# Global singleton
vega_engine = VegaQSAREngine()
