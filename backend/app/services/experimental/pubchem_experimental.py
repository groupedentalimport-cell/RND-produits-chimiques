"""
PubChem Experimental Data Loader — 115M compounds with physicochemical properties.
Fetches experimental properties via PUG-REST API.

Data sources:
  - PubChem Compound properties (experimental + computed)
  - PubChem BioAssay (activity, toxicity)
  - PubChem Literature (experimental references)
"""

import requests
import logging
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

PUG_REST = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
PUG_VIEW = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view"
REQUEST_TIMEOUT = 30
RATE_LIMIT_DELAY = 0.2


@dataclass
class PubChemProperty:
    """Single PubChem property with experimental provenance."""
    name: str
    value: Any
    unit: str
    source: str = "pubchem"
    cid: Optional[int] = None
    reference: Optional[str] = None
    is_experimental: bool = True


class PubChemExperimentalLoader:
    """
    Fetch experimental data from PubChem PUG-REST API.
    Supports physicochemical properties, safety data, and literature values.
    """

    # PubChem property tables for experimental data
    PROPERTY_TABLES = {
        "physicochemical": [
            "MolecularFormula", "MolecularWeight", "ExactMass",
            "XLogP", "TPSA", "Complexity", "Charge",
            "HBondDonorCount", "HBondAcceptorCount",
            "RotatableBondCount", "HeavyAtomCount",
            "IsomericSMILES", "CanonicalSMILES", "InChIKey",
        ],
        "experimental": [
            "Solubility", "LogP", "MeltingPoint", "BoilingPoint",
            "Density", "VaporPressure", "HenryLawConstant",
            "pKa", "FlashPoint", "AutoignitionTemp",
        ],
        "safety": [
            "GHSClassification", "GHSHazards", "GHSPictograms",
            "NFPA", "Explosive", "Flammable", "Oxidizer",
        ],
    }

    # Mapping PubChem property names to our internal names
    PROPERTY_MAP = {
        "XLogP": "logp",
        "MolecularWeight": "molar_mass",
        "TPSA": "psa",
        "HBondDonorCount": "hbd",
        "HBondAcceptorCount": "hba",
        "RotatableBondCount": "rotatable_bonds",
        "HeavyAtomCount": "heavy_atom_count",
        "ExactMass": "exact_mass",
        "MeltingPoint": "melting_point",
        "BoilingPoint": "boiling_point",
        "Density": "density",
        "Solubility": "solubility",
        "pKa": "pka",
        "VaporPressure": "vapor_pressure",
        "FlashPoint": "flash_point",
    }

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})
        self.last_request_time = 0.0

    def _rate_limit(self):
        elapsed = time.time() - self.last_request_time
        if elapsed < RATE_LIMIT_DELAY:
            time.sleep(RATE_LIMIT_DELAY - elapsed)
        self.last_request_time = time.time()

    def _get(self, url: str, params: Optional[Dict] = None) -> Optional[Dict]:
        self._rate_limit()
        try:
            resp = self.session.get(url, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.warning(f"PubChem API error: {e}")
            return None

    def fetch_by_cid(self, cid: int) -> Dict[str, Any]:
        """Fetch all experimental properties for a PubChem CID."""
        result = {
            "cid": cid,
            "properties": {},
            "experimental": {},
            "safety": {},
            "provenance": [],
        }

        # 1. Computed + basic properties
        props = self._get(
            f"{PUG_REST}/compound/cid/{cid}/property/"
            "MolecularFormula,MolecularWeight,ExactMass,XLogP,TPSA,"
            "Complexity,Charge,HBondDonorCount,HBondAcceptorCount,"
            "RotatableBondCount,HeavyAtomCount,IsomericSMILES,InChIKey/JSON"
        )
        if props and "PropertyTable" in props:
            for key, val in props["PropertyTable"]["Properties"][0].items():
                mapped = self.PROPERTY_MAP.get(key, key.lower())
                result["properties"][mapped] = val

        # 2. Experimental properties (from PubChem tables)
        exp_data = self._get(f"{PUG_VIEW}/data/compound/{cid}/JSON?heading=Experimental+Properties")
        if exp_data:
            result["experimental"] = self._parse_experimental_properties(exp_data)
            result["provenance"].append({
                "source": "pubchem",
                "type": "experimental_properties",
                "cid": cid,
            })

        # 3. Safety/GHS data
        safety = self._get(f"{PUG_VIEW}/data/compound/{cid}/JSON?heading=Safety+and+Hazards")
        if safety:
            result["safety"] = self._parse_safety_data(safety)

        return result

    def fetch_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Fetch PubChem data by compound name."""
        self._rate_limit()
        try:
            resp = self.session.get(
                f"{PUG_REST}/compound/name/{name}/cids/JSON",
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
            cids = data.get("IdentifierList", {}).get("CID", [])
            if not cids:
                return None
            return self.fetch_by_cid(cids[0])
        except requests.RequestException as e:
            logger.warning(f"PubChem name lookup failed for '{name}': {e}")
            return None

    def fetch_by_smiles(self, smiles: str) -> Optional[Dict[str, Any]]:
        """Fetch PubChem data by SMILES string."""
        self._rate_limit()
        try:
            resp = self.session.get(
                f"{PUG_REST}/compound/smiles/{smiles}/cids/JSON",
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
            cids = data.get("IdentifierList", {}).get("CID", [])
            if not cids:
                return None
            return self.fetch_by_cid(cids[0])
        except requests.RequestException as e:
            logger.warning(f"PubChem SMILES lookup failed: {e}")
            return None

    def fetch_by_cas(self, cas: str) -> Optional[Dict[str, Any]]:
        """Fetch PubChem data by CAS number."""
        self._rate_limit()
        try:
            resp = self.session.get(
                f"{PUG_REST}/compound/name/{cas}/cids/JSON",
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
            cids = data.get("IdentifierList", {}).get("CID", [])
            if not cids:
                return None
            return self.fetch_by_cid(cids[0])
        except requests.RequestException as e:
            logger.warning(f"PubChem CAS lookup failed for '{cas}': {e}")
            return None

    def _parse_experimental_properties(self, data: Dict) -> Dict[str, Any]:
        """Parse PubChem experimental properties from PUG_VIEW response."""
        experimental = {}
        try:
            sections = data.get("Record", {}).get("Section", [])
            for section in sections:
                if section.get("TOCHeading") == "Chemical and Physical Properties":
                    for subsection in section.get("Section", []):
                        heading = subsection.get("TOCHeading", "")
                        if "Experimental" in heading:
                            for info in subsection.get("Information", []):
                                name = info.get("Name", "")
                                value = info.get("Value", {})
                                if "StringWithMarkup" in value:
                                    val_str = value["StringWithMarkup"][0].get("String", "")
                                    experimental[name.lower().replace(" ", "_")] = {
                                        "value": val_str,
                                        "unit": value.get("Unit", ""),
                                    }
                                elif "Number" in value:
                                    nums = value.get("Number", [])
                                    if nums:
                                        experimental[name.lower().replace(" ", "_")] = {
                                            "value": nums[0],
                                            "unit": value.get("Unit", ""),
                                        }
        except (KeyError, IndexError, TypeError) as e:
            logger.warning(f"Error parsing PubChem experimental data: {e}")
        return experimental

    def _parse_safety_data(self, data: Dict) -> Dict[str, Any]:
        """Parse PubChem safety/GHS data."""
        safety = {}
        try:
            sections = data.get("Record", {}).get("Section", [])
            for section in sections:
                if section.get("TOCHeading") == "Safety and Hazards":
                    for subsection in section.get("Section", []):
                        heading = subsection.get("TOCHeading", "")
                        for info in subsection.get("Information", []):
                            value = info.get("Value", {})
                            if "StringWithMarkup" in value:
                                safety[heading] = value["StringWithMarkup"][0].get("String", "")
        except (KeyError, IndexError, TypeError):
            pass
        return safety

    def search_similar(self, smiles: str, threshold: int = 90, max_records: int = 50) -> List[Dict]:
        """Search for structurally similar compounds."""
        self._rate_limit()
        try:
            resp = self.session.get(
                f"{PUG_REST}/compound/fastsimilarity_2d/smiles/{smiles}/property/"
                "MolecularFormula,MolecularWeight,XLogP,TPSA,IsomericSMILES/JSON",
                params={"Threshold": threshold, "MaxRecords": max_records},
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            data = resp.json()
            return data.get("PropertyTable", {}).get("Properties", [])
        except requests.RequestException as e:
            logger.warning(f"PubChem similarity search failed: {e}")
            return []

    def to_experimental_measurements(self, pubchem_data: Dict) -> List[Dict[str, Any]]:
        """Convert PubChem data to standardized experimental measurements."""
        measurements = []

        # Map computed properties
        for key, value in pubchem_data.get("properties", {}).items():
            if key in self.PROPERTY_MAP.values() and value is not None:
                measurements.append({
                    "property_name": key,
                    "value": float(value) if isinstance(value, (int, float)) else value,
                    "unit": self._get_unit(key),
                    "source": "pubchem_computed",
                    "source_id": f"CID:{pubchem_data.get('cid')}",
                    "confidence": 0.7,  # computed = lower confidence
                })

        # Map experimental properties (higher confidence)
        for key, data in pubchem_data.get("experimental", {}).items():
            value = data.get("value")
            if value is not None:
                try:
                    value = float(value)
                except (ValueError, TypeError):
                    continue
                prop_name = self._map_experimental_name(key)
                measurements.append({
                    "property_name": prop_name,
                    "value": value,
                    "unit": data.get("unit", self._get_unit(prop_name)),
                    "source": "pubchem_experimental",
                    "source_id": f"CID:{pubchem_data.get('cid')}",
                    "confidence": 0.9,  # experimental = higher confidence
                })

        return measurements

    def _map_experimental_name(self, pubchem_name: str) -> str:
        """Map PubChem experimental property name to internal name."""
        name_lower = pubchem_name.lower()
        if "solub" in name_lower:
            return "solubility"
        if "logp" in name_lower or "partition" in name_lower:
            return "logp"
        if "melting" in name_lower:
            return "melting_point"
        if "boiling" in name_lower:
            return "boiling_point"
        if "density" in name_lower:
            return "density"
        if "pka" in name_lower or "dissociation" in name_lower:
            return "pka"
        if "vapor" in name_lower or "pressure" in name_lower:
            return "vapor_pressure"
        if "flash" in name_lower:
            return "flash_point"
        return name_lower.replace(" ", "_")

    def _get_unit(self, prop: str) -> str:
        units = {
            "solubility": "g/L",
            "logp": "dimensionless",
            "molar_mass": "g/mol",
            "psa": "Å²",
            "melting_point": "°C",
            "boiling_point": "°C",
            "density": "g/cm³",
            "pka": "dimensionless",
            "vapor_pressure": "mmHg",
            "flash_point": "°C",
        }
        return units.get(prop, "")
