"""
USP/EP/JP Pharmacopoeia Integration — Monograph data for pharmaceutical products.
Provides reference standards, acceptance criteria, and test methods.

USP (United States Pharmacopeia):
  - ~5,000 monographs for drug substances and products
  - Pricing: ~2,500 $/year
  - Access: https://www.usp.org/

EP (European Pharmacopoeia):
  - ~3,000 monographs
  - Pricing: ~800 $/year
  - Access: https://www.edqm.eu/

JP (Japanese Pharmacopoeia):
  - ~1,800 monographs
  - Pricing: ~500 $/year
  - Access: https://www.pmda.go.jp/

When ready:
  1. Subscribe to USP: https://www.usp.org/online-subscription
  2. Subscribe to EP: https://www.edqm.eu/en/european-pharmacopoeia
  3. Set: USP_API_KEY, EP_API_KEY, JP_API_KEY
"""

import os
import json
import logging
import requests
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class MonographData:
    """Pharmacopoeia monograph data."""
    name: str
    pharmacopoeia: str  # "USP", "EP", "JP"
    monograph_number: str
    description: str
    identification_tests: List[str]
    purity_tests: Dict[str, Any]  # test → {method, limit, acceptance}
    assay_method: str
    assay_acceptance: str  # e.g., "98.0–102.0%"
    storage_conditions: str
    labeling_requirements: List[str]
    reference_standards: List[str]


@dataclass
class AcceptanceCriteria:
    """Acceptance criteria from pharmacopoeia."""
    test_name: str
    method: str
    limit_type: str  # "range", "max", "min", "complies"
    lower: Optional[float] = None
    upper: Optional[float] = None
    unit: str = "%"
    pharmacopoeia: str = ""


class PharmacopoeiaEngine:
    """
    Pharmacopoeia integration for USP, EP, JP monograph data.
    """

    PHARMACOPOEIAS = {
        "usp": {
            "name": "United States Pharmacopeia",
            "api_base": "https://api.usp.org/v1",
            "pricing": "~2,500 $/year",
            "monographs": "~5,000",
            "env_key": "USP_API_KEY",
        },
        "ep": {
            "name": "European Pharmacopoeia",
            "api_base": "https://api.edqm.eu/v1",
            "pricing": "~800 $/year",
            "monographs": "~3,000",
            "env_key": "EP_API_KEY",
        },
        "jp": {
            "name": "Japanese Pharmacopoeia",
            "api_base": "https://api.pmda.go.jp/v1",
            "pricing": "~500 $/year",
            "monographs": "~1,800",
            "env_key": "JP_API_KEY",
        },
    }

    def __init__(self):
        self._api_keys = {
            "usp": os.environ.get("USP_API_KEY"),
            "ep": os.environ.get("EP_API_KEY"),
            "jp": os.environ.get("JP_API_KEY"),
        }
        self._available = {k: bool(v) for k, v in self._api_keys.items()}

    @property
    def status(self) -> Dict[str, Any]:
        return {
            "available": self._available,
            "subscriptions": {
                k: {
                    "name": v["name"],
                    "pricing": v["pricing"],
                    "monographs": v["monographs"],
                    "api_key_set": self._available[k],
                }
                for k, v in self.PHARMACOPOEIAS.items()
            },
            "total_cost": "~3,800 $/year (all three)",
        }

    def search_monograph(
        self,
        compound_name: str,
        pharmacopoeia: str = "all",
    ) -> List[MonographData]:
        """Search for monographs across pharmacopoeias."""
        results = []

        targets = [pharmacopoeia] if pharmacopoeia != "all" else list(self.PHARMACOPOEIAS.keys())

        for ph in targets:
            if not self._available.get(ph):
                continue
            data = self._call_api(ph, "monographs/search", {"name": compound_name})
            if data:
                for item in data.get("results", []):
                    results.append(self._parse_monograph(item, ph))

        return results

    def get_acceptance_criteria(
        self,
        compound_name: str,
        test_name: str,
        pharmacopoeia: str = "all",
    ) -> List[AcceptanceCriteria]:
        """Get acceptance criteria for a specific test."""
        monographs = self.search_monograph(compound_name, pharmacopoeia)
        criteria = []

        for mono in monographs:
            if test_name in mono.purity_tests:
                test_data = mono.purity_tests[test_name]
                criteria.append(AcceptanceCriteria(
                    test_name=test_name,
                    method=test_data.get("method", ""),
                    limit_type=test_data.get("limit_type", "range"),
                    lower=test_data.get("lower"),
                    upper=test_data.get("upper"),
                    unit=test_data.get("unit", "%"),
                    pharmacopoeia=mono.pharmacopoeia,
                ))

        return criteria

    def get_standard_conditions(self, compound_name: str) -> Dict[str, Any]:
        """Get standard storage and testing conditions from pharmacopoeia."""
        monographs = self.search_monograph(compound_name)
        if not monographs:
            return {}

        mono = monographs[0]
        return {
            "storage": mono.storage_conditions,
            "assay_method": mono.assay_method,
            "assay_acceptance": mono.assay_acceptance,
            "reference_standards": mono.reference_standards,
            "pharmacopoeia": mono.pharmacopoeia,
        }

    def _call_api(self, ph: str, endpoint: str, params: Dict) -> Optional[Dict]:
        """Call pharmacopoeia API."""
        ph_info = self.PHARMACOPOEIAS.get(ph, {})
        api_base = ph_info.get("api_base", "")
        api_key = self._api_keys.get(ph)

        if not api_key:
            return None

        headers = {"Authorization": f"Bearer {api_key}"}
        try:
            resp = requests.get(f"{api_base}/{endpoint}", params=params, headers=headers, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"{ph.upper()} API error: {e}")
            return None

    def _parse_monograph(self, data: Dict, ph: str) -> MonographData:
        """Parse monograph data from API response."""
        return MonographData(
            name=data.get("name", ""),
            pharmacopoeia=ph.upper(),
            monograph_number=data.get("number", ""),
            description=data.get("description", ""),
            identification_tests=data.get("identification", []),
            purity_tests=data.get("purity", {}),
            assay_method=data.get("assay_method", ""),
            assay_acceptance=data.get("assay_acceptance", ""),
            storage_conditions=data.get("storage", ""),
            labeling_requirements=data.get("labeling", []),
            reference_standards=data.get("reference_standards", []),
        )


# Global singleton
pharmacopoeia_engine = PharmacopoeiaEngine()
