"""
ChEMBL Experimental Data Loader — Real stability & physicochemical data.
Fetches experimental measurements from ChEMBL API (2.3M compounds).

Data sources:
  - ChEMBL stability assays (half-life, degradation rate)
  - ChEMBL physicochemical properties (solubility, LogP, pKa)
  - ChEMBL ADMET data (absorption, metabolism)
"""

import requests
import logging
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)

CHEMBL_API = "https://www.ebi.ac.uk/chembl/api/data"
REQUEST_TIMEOUT = 30
RATE_LIMIT_DELAY = 0.3  # seconds between requests


@dataclass
class ExperimentalMeasurement:
    """Single experimental measurement with provenance."""
    property_name: str
    value: float
    unit: str
    source: str  # "chembl", "pubchem", "nist", "benchmark"
    source_id: str  # e.g., ChEMBL assay ID, PubChem CID
    assay_type: Optional[str] = None
    target_organism: Optional[str] = None
    reference: Optional[str] = None  # DOI or ChEMBL document ID
    confidence: float = 1.0  # 0-1, based on assay quality
    measurement_date: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None  # pH, temperature, etc.


@dataclass
class ChEMBLCompoundData:
    """Aggregated experimental data for a single ChEMBL compound."""
    chembl_id: str
    name: str
    smiles: str
    inchi_key: Optional[str] = None
    measurements: List[ExperimentalMeasurement] = field(default_factory=list)

    @property
    def best_solubility(self) -> Optional[ExperimentalMeasurement]:
        return self._best("solubility")

    @property
    def best_logp(self) -> Optional[ExperimentalMeasurement]:
        return self._best("logp")

    @property
    def best_half_life(self) -> Optional[ExperimentalMeasurement]:
        return self._best("half_life")

    @property
    def best_melting_point(self) -> Optional[ExperimentalMeasurement]:
        return self._best("melting_point")

    def _best(self, prop: str) -> Optional[ExperimentalMeasurement]:
        """Get highest-confidence measurement for a property."""
        candidates = [m for m in self.measurements if m.property_name == prop]
        if not candidates:
            return None
        return max(candidates, key=lambda m: m.confidence)


class ChEMBLExperimentalLoader:
    """
    Fetch real experimental data from ChEMBL API.
    Supports stability, solubility, LogP, pKa, melting point, half-life.
    """

    # ChEMBL assay type mappings for stability-related data
    STABILITY_ASSAY_TYPES = {
        "solubility": ["Solubility", "Aqueous solubility"],
        "logp": ["LogP", "Partition coefficient", "Log D"],
        "half_life": ["Half-life", "t1/2", "Stability"],
        "melting_point": ["Melting point"],
        "pka": ["pKa", "Dissociation constant"],
        "degradation": ["Degradation", "Chemical stability"],
        "permeability": ["Permeability", "Caco-2"],
    }

    def __init__(self, cache_ttl_hours: int = 72):
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})
        self.cache: Dict[str, Any] = {}
        self.cache_ttl = cache_ttl_hours * 3600
        self.last_request_time = 0.0

    def _rate_limit(self):
        """Respect ChEMBL API rate limits."""
        elapsed = time.time() - self.last_request_time
        if elapsed < RATE_LIMIT_DELAY:
            time.sleep(RATE_LIMIT_DELAY - elapsed)
        self.last_request_time = time.time()

    def _get(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make rate-limited GET request to ChEMBL API."""
        self._rate_limit()
        cache_key = f"{endpoint}:{params}"
        if cache_key in self.cache:
            ts, data = self.cache[cache_key]
            if time.time() - ts < self.cache_ttl:
                return data

        try:
            url = f"{CHEMBL_API}/{endpoint}"
            resp = self.session.get(url, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            self.cache[cache_key] = (time.time(), data)
            return data
        except requests.RequestException as e:
            logger.warning(f"ChEMBL API error for {endpoint}: {e}")
            return None

    def fetch_compound(self, chembl_id: str) -> Optional[ChEMBLCompoundData]:
        """Fetch full experimental data for a ChEMBL compound."""
        # Get basic molecule data
        mol_data = self._get(f"molecule/{chembl_id}.json")
        if not mol_data:
            return None

        structs = mol_data.get("molecule_structures") or {}
        compound = ChEMBLCompoundData(
            chembl_id=chembl_id,
            name=mol_data.get("pref_name", chembl_id),
            smiles=structs.get("canonical_smiles", ""),
            inchi_key=structs.get("standard_inchi_key"),
        )

        # Fetch experimental assays
        assays = self._get("assay.json", {
            "target_chembl_id__isnull": "false",
            "assay_type__in": "B,F",  # Binding, Functional
            "limit": 100,
        })

        # Fetch activity data for this compound
        activities = self._get("activity.json", {
            "molecule_chembl_id": chembl_id,
            "limit": 500,
        })

        if activities and "activities" in activities:
            for act in activities["activities"]:
                measurement = self._parse_activity(act)
                if measurement:
                    compound.measurements.append(measurement)

        return compound

    def _parse_activity(self, activity: Dict) -> Optional[ExperimentalMeasurement]:
        """Parse a ChEMBL activity record into an ExperimentalMeasurement."""
        value = activity.get("standard_value")
        units = activity.get("standard_units")
        relation = activity.get("standard_relation", "=")
        type_name = activity.get("standard_type", "")

        if value is None or not type_name:
            return None

        # Map ChEMBL types to our property names
        prop_mapping = {
            "Solubility": "solubility",
            "LogP": "logp",
            "LogD": "logp",
            "Half-life": "half_life",
            "Melting point": "melting_point",
            "pKa": "pka",
            "Permeability": "permeability",
            "IC50": "ic50",
            "EC50": "ec50",
            "Ki": "ki",
            "Kd": "kd",
        }

        prop_name = prop_mapping.get(type_name, type_name.lower().replace(" ", "_"))

        # Only accept exact measurements (not inequalities)
        if relation != "=":
            return None

        # Convert units to standard
        value_std = self._convert_units(value, units, prop_name)
        if value_std is None:
            return None

        confidence = self._assay_confidence(activity)

        return ExperimentalMeasurement(
            property_name=prop_name,
            value=value_std,
            unit=self._standard_unit(prop_name),
            source="chembl",
            source_id=activity.get("assay_chembl_id", ""),
            assay_type=activity.get("assay_type"),
            target_organism=activity.get("target_organism"),
            reference=activity.get("document_chembl_id"),
            confidence=confidence,
            conditions={
                "ph": activity.get("ph"),
                "temperature": activity.get("assay_test_type"),
            },
        )

    def _convert_units(self, value: float, units: str, prop: str) -> Optional[float]:
        """Convert ChEMBL units to standard units."""
        if not units:
            return value

        units_lower = units.lower().strip()

        # Solubility: convert to g/L
        if prop == "solubility":
            if "ug/ml" in units_lower or "µg/ml" in units_lower:
                return value / 1000  # µg/mL → g/L
            if "mg/ml" in units_lower:
                return value  # mg/mL ≈ g/L
            if "mg/l" in units_lower or "µg/µl" in units_lower:
                return value / 1000  # mg/L → g/L
            if "mm" in units_lower or "mmol" in units_lower:
                return None  # Need molar mass to convert

        # LogP is dimensionless
        if prop == "logp":
            return value

        # Half-life: convert to hours
        if prop == "half_life":
            if "h" in units_lower or "hour" in units_lower:
                return value
            if "min" in units_lower:
                return value / 60
            if "day" in units_lower or "d" in units_lower:
                return value * 24

        # Melting point: convert to °C
        if prop == "melting_point":
            if "c" in units_lower or "°c" in units_lower or "celsius" in units_lower:
                return value
            if "k" in units_lower or "kelvin" in units_lower:
                return value - 273.15
            if "f" in units_lower or "fahrenheit" in units_lower:
                return (value - 32) * 5 / 9

        return value

    def _standard_unit(self, prop: str) -> str:
        """Return standard unit for a property."""
        units = {
            "solubility": "g/L",
            "logp": "dimensionless",
            "half_life": "hours",
            "melting_point": "°C",
            "pka": "dimensionless",
            "permeability": "cm/s",
        }
        return units.get(prop, "unknown")

    def _assay_confidence(self, activity: Dict) -> float:
        """Estimate confidence from assay quality indicators."""
        confidence = 0.7  # baseline

        # Published document = higher confidence
        if activity.get("document_chembl_id"):
            confidence += 0.1

        # Standard type = higher confidence
        if activity.get("standard_type"):
            confidence += 0.1

        # pChEMBL value available = high confidence
        if activity.get("pchembl_value"):
            confidence += 0.1

        return min(confidence, 1.0)

    def search_compounds(
        self,
        query: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Search ChEMBL for compounds matching a query."""
        data = self._get("molecule/search.json", {
            "q": query,
            "limit": limit,
            "offset": offset,
        })
        if not data or "molecules" not in data:
            return []

        results = []
        for mol in data["molecules"]:
            structs = mol.get("molecule_structures") or {}
            results.append({
                "chembl_id": mol.get("molecule_chembl_id"),
                "name": mol.get("pref_name"),
                "smiles": structs.get("canonical_smiles"),
                "max_phase": mol.get("max_phase"),
                "first_approval": mol.get("first_approval"),
            })
        return results

    def fetch_stability_data(
        self,
        chembl_id: str,
    ) -> Dict[str, Any]:
        """
        Fetch all stability-related experimental data for a compound.
        Returns structured data for stability assessment.
        """
        compound = self.fetch_compound(chembl_id)
        if not compound:
            return {}

        return {
            "chembl_id": chembl_id,
            "name": compound.name,
            "smiles": compound.smiles,
            "experimental": {
                "solubility": self._measurement_to_dict(compound.best_solubility),
                "logp": self._measurement_to_dict(compound.best_logp),
                "half_life": self._measurement_to_dict(compound.best_half_life),
                "melting_point": self._measurement_to_dict(compound.best_melting_point),
            },
            "measurement_count": len(compound.measurements),
            "data_quality": self._overall_quality(compound),
        }

    def _measurement_to_dict(self, m: Optional[ExperimentalMeasurement]) -> Optional[Dict]:
        if not m:
            return None
        return {
            "value": m.value,
            "unit": m.unit,
            "source": m.source,
            "source_id": m.source_id,
            "confidence": m.confidence,
            "reference": m.reference,
        }

    def _overall_quality(self, compound: ChEMBLCompoundData) -> float:
        """Compute overall data quality score (0-1)."""
        if not compound.measurements:
            return 0.0
        avg_conf = sum(m.confidence for m in compound.measurements) / len(compound.measurements)
        prop_coverage = len(set(m.property_name for m in compound.measurements)) / 6  # 6 key props
        return min(avg_conf * 0.6 + prop_coverage * 0.4, 1.0)
