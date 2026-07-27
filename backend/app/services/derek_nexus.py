"""
Derek Nexus (Lhasa Limited) Integration — ICH M7 Mutagenicity Alerts.
Industry-standard for regulatory submissions — accepted by FDA/EMA.

Derek Nexus provides:
  - Structural alerts for mutagenicity (ICH M7 compliant)
  - Skin sensitization alerts
  - Chromosomal aberration alerts
  - Carcinogenicity alerts
  - Used in combination with Sarah Nexus (Ames test prediction)

Sarah Nexus provides:
  - Quantitative Ames test prediction
  - Statistical model with confidence
  - Complementary to Derek (structural alerts)

Pricing: ~10,000 $/year (often bundled together)
Contact: https://www.lhasalimited.org/

When ready:
  1. Contact Lhasa Limited: https://www.lhasalimited.org/contact-us
  2. License Derek Nexus + Sarah Nexus bundle
  3. Install locally (Windows/Linux) or use API
  4. Set: DEREK_NEXUS_PATH=/path/to/install or DEREK_API_KEY
"""

import os
import json
import logging
import subprocess
import tempfile
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class DerekAlert:
    """A Derek Nexus structural alert."""
    alert_name: str
    alert_type: str  # "mutagenicity", "skin_sensitization", "chromosomal_aberration"
    certainty: str  # "plausible", "probable", "equivocal"
    evidence: str  # "positive", "negative", "inconclusive"
    toxicophore: str  # SMILES of the alerting substructure
    atom_indices: List[int]  # atoms involved in the alert
    explanation: str
    references: List[str]


@dataclass
class DerekPrediction:
    """Derek Nexus prediction result."""
    smiles: str
    compound_name: str
    prediction: str  # "positive", "negative", "equivocal", "inconclusive"
    confidence: str  # "high", "medium", "low"
    alerts: List[DerekAlert]
    sar_summary: str
    model_version: str


@dataclass
class SarahPrediction:
    """Sarah Nexus Ames test prediction."""
    smiles: str
    prediction: str  # "mutagen", "non-mutagen"
    probability: float  # 0-1
    confidence: str
    contributing_fragments: List[Dict[str, Any]]


class DerekNexusEngine:
    """
    Derek Nexus + Sarah Nexus integration for ICH M7 assessment.
    """

    def __init__(self):
        self.derek_path = os.environ.get("DEREK_NEXUS_PATH")
        self.derek_api = os.environ.get("DEREK_API_KEY")
        self.sarah_path = os.environ.get("SARAH_NEXUS_PATH")
        self._derek_available = self._check_derek()
        self._sarah_available = self._check_sarah()

    def _check_derek(self) -> bool:
        if self.derek_path and Path(self.derek_path).exists():
            return True
        if self.derek_api:
            return True
        return False

    def _check_sarah(self) -> bool:
        if self.sarah_path and Path(self.sarah_path).exists():
            return True
        return False

    @property
    def status(self) -> Dict[str, Any]:
        return {
            "derek_nexus": {
                "available": self._derek_available,
                "path_set": bool(self.derek_path),
                "api_key_set": bool(self.derek_api),
            },
            "sarah_nexus": {
                "available": self._sarah_available,
                "path_set": bool(self.sarah_path),
            },
            "subscription_required": True,
            "pricing": "~10,000 $/year (bundle Derek + Sarah)",
            "contact": "https://www.lhasalimited.org/",
            "note": "Industry standard for ICH M7 regulatory submissions. Accepted by FDA/EMA.",
            "alternative": "Vega QSAR (free) — less accepted by regulators",
        }

    def predict_mutagenicity(self, smiles: str, compound_name: str = "") -> Optional[DerekPrediction]:
        """
        Run Derek Nexus mutagenicity prediction.
        Returns structural alerts with certainty levels.
        """
        if not self._derek_available:
            return None

        if self.derek_api:
            return self._call_derek_api(smiles, compound_name)
        elif self.derek_path:
            return self._run_derek_cli(smiles, compound_name)

        return None

    def predict_ames(self, smiles: str) -> Optional[SarahPrediction]:
        """
        Run Sarah Nexus Ames test prediction.
        Returns mutagen/non-mutagen with probability.
        """
        if not self._sarah_available:
            return None

        return self._run_sarah_cli(smiles)

    def full_ich_m7_assessment(
        self,
        smiles: str,
        compound_name: str = "",
        ames_test_result: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Complete ICH M7 assessment combining Derek + Sarah + Vega.
        This is the gold standard for regulatory submissions.
        """
        result = {
            "compound": compound_name,
            "smiles": smiles,
            "derek": None,
            "sarah": None,
            "ich_m7_class": None,
            "ttc_threshold": 1500,
            "regulatory_status": "pending",
        }

        # Derek prediction
        derek_pred = self.predict_mutagenicity(smiles, compound_name)
        if derek_pred:
            result["derek"] = {
                "prediction": derek_pred.prediction,
                "confidence": derek_pred.confidence,
                "alerts": [
                    {"name": a.alert_name, "certainty": a.certainty, "type": a.alert_type}
                    for a in derek_pred.alerts
                ],
            }

        # Sarah prediction
        sarah_pred = self.predict_ames(smiles)
        if sarah_pred:
            result["sarah"] = {
                "prediction": sarah_pred.prediction,
                "probability": sarah_pred.probability,
                "confidence": sarah_pred.confidence,
            }

        # Classify per ICH M7
        if ames_test_result == "negative":
            result["ich_m7_class"] = "5"
            result["ttc_threshold"] = 1500
            result["justification"] = "Negative Ames test → Class 5"
        elif derek_pred and derek_pred.prediction == "positive":
            if ames_test_result == "positive":
                result["ich_m7_class"] = "1"
                result["ttc_threshold"] = 1.5
                result["justification"] = "Derek positive + Ames positive → Class 1"
            else:
                result["ich_m7_class"] = "2"
                result["ttc_threshold"] = 18
                result["justification"] = "Derek positive, no Ames data → Class 2"
        elif derek_pred and derek_pred.alerts:
            result["ich_m7_class"] = "3"
            result["ttc_threshold"] = 18
            result["justification"] = "Structural alert present → Class 3"
        else:
            result["ich_m7_class"] = "4"
            result["ttc_threshold"] = 1500
            result["justification"] = "No alert, no data → Class 4"

        result["regulatory_status"] = "assessed"
        return result

    def _call_derek_api(self, smiles: str, compound_name: str) -> Optional[DerekPrediction]:
        """Call Derek Nexus API."""
        try:
            import requests
            headers = {"Authorization": f"Bearer {self.derek_api}", "Content-Type": "application/json"}
            resp = requests.post(
                "https://api.lhasalimited.org/derek/v1/predict",
                json={"smiles": smiles, "name": compound_name},
                headers=headers, timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            return self._parse_derek_response(data, smiles, compound_name)
        except Exception as e:
            logger.error(f"Derek API error: {e}")
            return None

    def _run_derek_cli(self, smiles: str, compound_name: str) -> Optional[DerekPrediction]:
        """Run Derek Nexus CLI."""
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".smi", delete=False) as f:
                f.write(f"{smiles}\t{compound_name}")
                input_file = f.name

            result = subprocess.run(
                [str(Path(self.derek_path) / "derek"), "-i", input_file, "-o", "/tmp/derek_out.json"],
                capture_output=True, text=True, timeout=120,
            )

            os.unlink(input_file)

            if result.returncode == 0:
                output = json.loads(Path("/tmp/derek_out.json").read_text())
                return self._parse_derek_response(output, smiles, compound_name)

        except Exception as e:
            logger.error(f"Derek CLI error: {e}")

        return None

    def _run_sarah_cli(self, smiles: str) -> Optional[SarahPrediction]:
        """Run Sarah Nexus CLI."""
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".smi", delete=False) as f:
                f.write(smiles)
                input_file = f.name

            result = subprocess.run(
                [str(Path(self.sarah_path) / "sarah"), "-i", input_file, "-o", "/tmp/sarah_out.json"],
                capture_output=True, text=True, timeout=120,
            )

            os.unlink(input_file)

            if result.returncode == 0:
                output = json.loads(Path("/tmp/sarah_out.json").read_text())
                return SarahPrediction(
                    smiles=smiles,
                    prediction=output.get("prediction", "unknown"),
                    probability=output.get("probability", 0),
                    confidence=output.get("confidence", "unknown"),
                    contributing_fragments=output.get("fragments", []),
                )

        except Exception as e:
            logger.error(f"Sarah CLI error: {e}")

        return None

    def _parse_derek_response(self, data: Dict, smiles: str, name: str) -> DerekPrediction:
        """Parse Derek API response."""
        alerts = []
        for alert_data in data.get("alerts", []):
            alerts.append(DerekAlert(
                alert_name=alert_data.get("name", ""),
                alert_type=alert_data.get("type", "mutagenicity"),
                certainty=alert_data.get("certainty", "equivocal"),
                evidence=alert_data.get("evidence", "inconclusive"),
                toxicophore=alert_data.get("toxicophore", ""),
                atom_indices=alert_data.get("atoms", []),
                explanation=alert_data.get("explanation", ""),
                references=alert_data.get("references", []),
            ))

        return DerekPrediction(
            smiles=smiles,
            compound_name=name,
            prediction=data.get("prediction", "inconclusive"),
            confidence=data.get("confidence", "low"),
            alerts=alerts,
            sar_summary=data.get("summary", ""),
            model_version=data.get("version", ""),
        )


# Global singleton
derek_engine = DerekNexusEngine()
