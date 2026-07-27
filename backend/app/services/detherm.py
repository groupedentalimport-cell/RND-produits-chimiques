"""
DETHERM Integration — DECHEMA Thermophysical Property Database.
7M+ experimental data items for 60,600 pure substances and 163,000 mixtures.

Pricing: ~1,500 $/year (academic discount available)
Access: https://i-systems.dechema.de/
API: REST API with API key authentication

When ready to subscribe:
  1. Contact DECHEMA: https://dechema.de/en/detherm.html
  2. Request academic/institutional pricing
  3. Get API key
  4. Set environment variable: DETHERM_API_KEY=your_key_here
"""

import os
import json
import logging
import requests
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class DETHERMDataPoint:
    """A single DETHERM data point."""
    property_name: str
    value: float
    unit: str
    temperature_k: Optional[float] = None
    pressure_pa: Optional[float] = None
    phase: str = ""  # "liquid", "gas", "solid"
    source: str = "DETHERM"
    reference: str = ""
    cas: str = ""
    formula: str = ""


@dataclass
class DETHERMCompound:
    """DETHERM data for a single compound."""
    cas: str
    name: str
    formula: str
    molar_mass: float
    data_points: List[DETHERMDataPoint]
    properties_available: List[str]


class DETHEngine:
    """
    DETHERM database integration for thermophysical properties.
    """

    API_BASE = "https://i-systems.dechema.de/api/v1"

    # DETHERM property codes
    PROPERTY_CODES = {
        "density": "DENS",
        "viscosity": "VISC",
        "thermal_conductivity": "TCND",
        "surface_tension": "STEN",
        "vapor_pressure": "VPRS",
        "heat_capacity_cp": "HCP",
        "heat_capacity_cv": "HCV",
        "enthalpy_vaporization": "DHV",
        "enthalpy_fusion": "DHF",
        "refractive_index": "RIND",
        "dielectric_constant": "DIEL",
        "solubility": "SOLU",
        "diffusion_coefficient": "DIFF",
        "boiling_point": "TB",
        "melting_point": "TM",
        "critical_temperature": "TC",
        "critical_pressure": "PC",
        "critical_density": "DC",
        "acentric_factor": "ACEN",
    }

    def __init__(self):
        self.api_key = os.environ.get("DETHERM_API_KEY")
        self._available = bool(self.api_key)
        self._session = requests.Session()

    @property
    def is_available(self) -> bool:
        return self._available

    @property
    def status(self) -> Dict[str, Any]:
        return {
            "available": self._available,
            "api_key_set": bool(self.api_key),
            "subscription_required": True,
            "pricing": "~1,500 $/year (academic discount available)",
            "contact": "https://dechema.de/en/detherm.html",
            "data_coverage": "7M+ data items, 60,600 substances, 163,000 mixtures",
        }

    def _get(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make authenticated GET request to DETHERM API."""
        if not self._available:
            logger.warning("DETHERM API key not set. Set DETHERM_API_KEY environment variable.")
            return None

        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            resp = self._session.get(
                f"{self.API_BASE}/{endpoint}",
                params=params,
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"DETHERM API error: {e}")
            return None

    def search_compound(
        self,
        cas: Optional[str] = None,
        name: Optional[str] = None,
        formula: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Search DETHERM for a compound."""
        params = {}
        if cas:
            params["cas"] = cas
        if name:
            params["name"] = name
        if formula:
            params["formula"] = formula

        return self._get("compounds/search", params)

    def get_properties(
        self,
        cas: str,
        properties: Optional[List[str]] = None,
        temperature_range: Optional[tuple] = None,
    ) -> List[DETHERMDataPoint]:
        """Get thermophysical properties for a compound by CAS."""
        if not self._available:
            return []

        params = {"cas": cas}
        if properties:
            codes = [self.PROPERTY_CODES.get(p, p) for p in properties]
            params["properties"] = ",".join(codes)
        if temperature_range:
            params["t_min"] = temperature_range[0]
            params["t_max"] = temperature_range[1]

        data = self._get("data", params)
        if not data:
            return []

        points = []
        for item in data.get("data", []):
            points.append(DETHERMDataPoint(
                property_name=item.get("property", ""),
                value=item.get("value", 0),
                unit=item.get("unit", ""),
                temperature_k=item.get("temperature"),
                pressure_pa=item.get("pressure"),
                phase=item.get("phase", ""),
                reference=item.get("reference", ""),
                cas=cas,
            ))

        return points

    def get_binary_mixture(
        self,
        cas1: str,
        cas2: str,
        property_name: str,
    ) -> List[DETHERMDataPoint]:
        """Get binary mixture data."""
        if not self._available:
            return []

        code = self.PROPERTY_CODES.get(property_name, property_name)
        data = self._get("mixtures/binary", {
            "cas1": cas1, "cas2": cas2, "property": code,
        })

        if not data:
            return []

        return [
            DETHERMDataPoint(
                property_name=property_name,
                value=item.get("value", 0),
                unit=item.get("unit", ""),
                temperature_k=item.get("temperature"),
                pressure_pa=item.get("pressure"),
                source="DETHERM",
                reference=item.get("reference", ""),
            )
            for item in data.get("data", [])
        ]

    def to_standard_format(self, data_points: List[DETHERMDataPoint]) -> Dict[str, Any]:
        """Convert DETHERM data to standard format for database storage."""
        by_property = {}
        for dp in data_points:
            if dp.property_name not in by_property:
                by_property[dp.property_name] = []
            by_property[dp.property_name].append({
                "value": dp.value,
                "unit": dp.unit,
                "temperature_k": dp.temperature_k,
                "pressure_pa": dp.pressure_pa,
                "phase": dp.phase,
                "source": "DETHERM",
                "reference": dp.reference,
            })

        return {
            "source": "DETHERM (DECHEMA)",
            "properties": by_property,
            "total_points": len(data_points),
        }


# Global singleton
detherm_engine = DETHEngine()
