"""
Reaxys (Elsevier) / SciFinder-n (ACS) Integration.
Chemistry databases for reaction data, stability, and thermodynamic properties.

Reaxys:
  - 700M+ experimental reactions
  - Thermodynamic data (ΔH, ΔG, ΔS)
  - Stability data from literature
  - Pricing: ~2,000–10,000 $/year (institutional)
  - API: https://developer.elsevier.com/

SciFinder-n (ACS):
  - 200M+ substances
  - Experimental properties
  - Reaction schemes
  - Pricing: ~3,000–8,000 $/year (institutional)
  - API: Via CAS SciFinder-n API (requires institutional access)

When ready:
  1. Reaxys: Contact Elsevier via https://www.elsevier.com/products/reaxys
  2. SciFinder-n: Contact CAS via https://www.cas.org/products/scifinder-n
  3. Set environment variables: REAXYS_API_KEY, SCIFINDER_API_KEY
"""

import os
import json
import logging
import requests
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ReactionData:
    """Reaction data from Reaxys/SciFinder."""
    reaction_id: str
    reactants: List[str]  # SMILES
    products: List[str]  # SMILES
    conditions: Dict[str, Any]  # temperature, solvent, catalyst, etc.
    yield_percent: Optional[float] = None
    reference: str = ""
    source: str = ""


@dataclass
class StabilityData:
    """Stability data from literature."""
    compound_name: str
    smiles: str
    property_name: str  # "half_life", "degradation_rate", "stability_constant"
    value: float
    unit: str
    conditions: Dict[str, Any]
    reference: str
    source: str


class ReaxysEngine:
    """
    Reaxys (Elsevier) integration for reaction and stability data.
    """

    API_BASE = "https://api.elsevier.com/analytics/reaxys"

    def __init__(self):
        self.api_key = os.environ.get("REAXYS_API_KEY")
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
            "pricing": "~2,000–10,000 $/year (institutional)",
            "contact": "https://www.elsevier.com/products/reaxys",
            "data_coverage": "700M+ reactions, thermodynamic data, stability data",
        }

    def search_reactions(
        self,
        smiles: str,
        reaction_type: Optional[str] = None,
        limit: int = 50,
    ) -> List[ReactionData]:
        """Search for reactions involving a compound."""
        if not self._available:
            return []

        headers = {"X-ELS-APIKey": self.api_key, "Accept": "application/json"}
        params = {
            "query": f"reactant:{smiles}",
            "limit": limit,
        }
        if reaction_type:
            params["reaction_type"] = reaction_type

        try:
            resp = requests.get(f"{self.API_BASE}/reactions", params=params, headers=headers, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            return self._parse_reactions(data)
        except Exception as e:
            logger.error(f"Reaxys API error: {e}")
            return []

    def search_stability_data(
        self,
        smiles: Optional[str] = None,
        cas: Optional[str] = None,
    ) -> List[StabilityData]:
        """Search for stability data for a compound."""
        if not self._available:
            return []

        headers = {"X-ELS-APIKey": self.api_key, "Accept": "application/json"}
        params = {}
        if smiles:
            params["smiles"] = smiles
        if cas:
            params["cas"] = cas

        try:
            resp = requests.get(f"{self.API_BASE}/stability", params=params, headers=headers, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            return self._parse_stability(data)
        except Exception as e:
            logger.error(f"Reaxys stability search error: {e}")
            return []

    def get_thermodynamic_data(self, cas: str) -> Dict[str, Any]:
        """Get thermodynamic data (ΔH, ΔG, ΔS) for a compound."""
        if not self._available:
            return {}

        headers = {"X-ELS-APIKey": self.api_key, "Accept": "application/json"}
        try:
            resp = requests.get(f"{self.API_BASE}/thermodynamics", params={"cas": cas}, headers=headers, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"Reaxys thermodynamics error: {e}")
            return {}

    def _parse_reactions(self, data: Dict) -> List[ReactionData]:
        """Parse Reaxys reaction data."""
        reactions = []
        for item in data.get("results", []):
            reactions.append(ReactionData(
                reaction_id=item.get("id", ""),
                reactants=item.get("reactants", []),
                products=item.get("products", []),
                conditions=item.get("conditions", {}),
                yield_percent=item.get("yield"),
                reference=item.get("reference", ""),
                source="Reaxys",
            ))
        return reactions

    def _parse_stability(self, data: Dict) -> List[StabilityData]:
        """Parse Reaxys stability data."""
        results = []
        for item in data.get("results", []):
            results.append(StabilityData(
                compound_name=item.get("compound_name", ""),
                smiles=item.get("smiles", ""),
                property_name=item.get("property", ""),
                value=item.get("value", 0),
                unit=item.get("unit", ""),
                conditions=item.get("conditions", {}),
                reference=item.get("reference", ""),
                source="Reaxys",
            ))
        return results


class SciFinderEngine:
    """
    SciFinder-n (CAS) integration for substance and reaction data.
    """

    API_BASE = "https://api.cas.org/scifinder/v1"

    def __init__(self):
        self.api_key = os.environ.get("SCIFINDER_API_KEY")
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
            "pricing": "~3,000–8,000 $/year (institutional)",
            "contact": "https://www.cas.org/products/scifinder-n",
            "data_coverage": "200M+ substances, reactions, experimental properties",
        }

    def search_substance(
        self,
        smiles: Optional[str] = None,
        cas: Optional[str] = None,
        name: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Search SciFinder for a substance."""
        if not self._available:
            return None

        headers = {"Authorization": f"Bearer {self.api_key}"}
        params = {}
        if smiles:
            params["smiles"] = smiles
        if cas:
            params["cas"] = cas
        if name:
            params["name"] = name

        try:
            resp = requests.get(f"{self.API_BASE}/substances", params=params, headers=headers, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"SciFinder API error: {e}")
            return None

    def get_experimental_properties(self, cas: str) -> Dict[str, Any]:
        """Get experimental properties from SciFinder."""
        if not self._available:
            return {}

        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            resp = requests.get(f"{self.API_BASE}/properties", params={"cas": cas}, headers=headers, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"SciFinder properties error: {e}")
            return {}


# Global singletons
reaxys_engine = ReaxysEngine()
scifinder_engine = SciFinderEngine()
