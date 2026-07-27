"""
Experimental Data Registry — Unified access to all experimental data sources.
Coordinates ChEMBL, PubChem, NIST, and benchmark datasets.

This is the central point for:
  1. Looking up experimental data for a compound
  2. Training QSPR models on real experimental data
  3. Providing data provenance and confidence scores
  4. Caching and deduplication across sources
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime

from app.services.experimental.chembl_experimental import ChEMBLExperimentalLoader
from app.services.experimental.pubchem_experimental import PubChemExperimentalLoader
from app.services.experimental.nist_webbook import NISTWebBookLoader
from app.services.experimental.benchmark_loaders import BenchmarkAggregator

logger = logging.getLogger(__name__)


@dataclass
class ProvenanceRecord:
    """Data provenance tracking for regulatory compliance."""
    property_name: str
    value: float
    unit: str
    source: str  # "chembl", "pubchem", "nist", "benchmark_esol", etc.
    source_id: str
    confidence: float
    fetched_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    reference: Optional[str] = None


@dataclass
class EnrichedCompound:
    """A compound enriched with experimental data from multiple sources."""
    name: str
    cas: Optional[str] = None
    smiles: Optional[str] = None
    chembl_id: Optional[str] = None
    pubchem_cid: Optional[int] = None

    # Aggregated properties (best value from highest-confidence source)
    properties: Dict[str, Any] = field(default_factory=dict)

    # Full provenance chain
    provenance: List[ProvenanceRecord] = field(default_factory=list)

    # Data quality metrics
    data_quality_score: float = 0.0
    experimental_property_count: int = 0
    source_count: int = 0

    def best_property(self, prop_name: str) -> Optional[Dict[str, Any]]:
        """Get the best (highest confidence) value for a property."""
        candidates = [p for p in self.provenance if p.property_name == prop_name]
        if not candidates:
            return self.properties.get(prop_name)
        best = max(candidates, key=lambda p: p.confidence)
        return {
            "value": best.value,
            "unit": best.unit,
            "source": best.source,
            "confidence": best.confidence,
            "reference": best.reference,
        }


class ExperimentalDataRegistry:
    """
    Unified registry for experimental chemical data.
    Provides single point of access for all data sources.
    """

    def __init__(self):
        self.chembl = ChEMBLExperimentalLoader()
        self.pubchem = PubChemExperimentalLoader()
        self.nist = NISTWebBookLoader()
        self.benchmarks = BenchmarkAggregator()

        # In-memory cache for enriched compounds
        self._cache: Dict[str, EnrichedCompound] = {}

    def enrich_compound(
        self,
        name: str,
        cas: Optional[str] = None,
        smiles: Optional[str] = None,
        chembl_id: Optional[str] = None,
        pubchem_cid: Optional[int] = None,
    ) -> EnrichedCompound:
        """
        Enrich a compound with experimental data from all available sources.
        Priority: NIST > ChEMBL experimental > PubChem experimental > computed.
        """
        cache_key = cas or name or smiles or str(chembl_id)
        if cache_key in self._cache:
            return self._cache[cache_key]

        enriched = EnrichedCompound(
            name=name,
            cas=cas,
            smiles=smiles,
            chembl_id=chembl_id,
            pubchem_cid=pubchem_cid,
        )
        sources_used = set()

        # 1. NIST WebBook (highest confidence for thermodynamic data)
        nist_data = self.nist.lookup_by_name(name)
        if not nist_data and cas:
            nist_data = self.nist.lookup_by_cas(cas)
        if nist_data:
            nist_measurements = self.nist.to_experimental_measurements(nist_data)
            for m in nist_measurements:
                enriched.provenance.append(ProvenanceRecord(
                    property_name=m["property_name"],
                    value=m["value"],
                    unit=m["unit"],
                    source="nist_webbook",
                    source_id=m["source_id"],
                    confidence=m["confidence"],
                ))
            sources_used.add("nist")
            # Set properties from NIST (highest priority)
            for key, val in [
                ("melting_point", nist_data.melting_point),
                ("boiling_point", nist_data.boiling_point),
                ("density", nist_data.density_25c),
                ("solubility", nist_data.solubility_water_25c),
                ("pka", nist_data.pka or nist_data.pka_acid),
                ("molar_mass", nist_data.molar_mass),
            ]:
                if val is not None:
                    enriched.properties[key] = val

        # 2. PubChem (good for computed + some experimental)
        pubchem_data = None
        if pubchem_cid:
            pubchem_data = self.pubchem.fetch_by_cid(pubchem_cid)
        elif cas:
            pubchem_data = self.pubchem.fetch_by_cas(cas)
        elif name:
            pubchem_data = self.pubchem.fetch_by_name(name)

        if pubchem_data:
            pubchem_measurements = self.pubchem.to_experimental_measurements(pubchem_data)
            for m in pubchem_measurements:
                prop = m["property_name"]
                # Only add if NIST didn't already provide this property
                if prop not in enriched.properties:
                    enriched.provenance.append(ProvenanceRecord(
                        property_name=prop,
                        value=m["value"] if isinstance(m["value"], (int, float)) else 0,
                        unit=m["unit"],
                        source=m["source"],
                        source_id=m["source_id"],
                        confidence=m["confidence"],
                    ))
                    if isinstance(m["value"], (int, float)):
                        enriched.properties[prop] = m["value"]
            if not pubchem_cid and pubchem_data.get("cid"):
                enriched.pubchem_cid = pubchem_data["cid"]
            sources_used.add("pubchem")

        # 3. ChEMBL (experimental assay data)
        if chembl_id:
            chembl_stability = self.chembl.fetch_stability_data(chembl_id)
            if chembl_stability:
                for prop, data in chembl_stability.get("experimental", {}).items():
                    if data and data.get("value") is not None:
                        if prop not in enriched.properties:
                            enriched.properties[prop] = data["value"]
                        enriched.provenance.append(ProvenanceRecord(
                            property_name=prop,
                            value=data["value"],
                            unit=data.get("unit", ""),
                            source="chembl",
                            source_id=data.get("source_id", chembl_id),
                            confidence=data.get("confidence", 0.8),
                            reference=data.get("reference"),
                        ))
                sources_used.add("chembl")

        # Compute quality metrics
        enriched.source_count = len(sources_used)
        enriched.experimental_property_count = len(set(
            p.property_name for p in enriched.provenance
        ))
        if enriched.provenance:
            avg_conf = sum(p.confidence for p in enriched.provenance) / len(enriched.provenance)
            prop_coverage = enriched.experimental_property_count / 10  # 10 key properties
            enriched.data_quality_score = min(
                avg_conf * 0.6 + prop_coverage * 0.3 + (0.1 if enriched.source_count > 1 else 0),
                1.0,
            )

        self._cache[cache_key] = enriched
        return enriched

    def get_qspr_training_data(
        self,
        property_name: str,
        use_benchmarks: bool = True,
    ) -> Tuple[List[str], List[float], List[str]]:
        """
        Get training data for QSPR model training.
        Returns (smiles_list, values, source_list).
        """
        all_smiles = []
        all_values = []
        all_sources = []

        if use_benchmarks:
            training_data = self.benchmarks.get_all_training_data()

            # Map property names to benchmark datasets
            benchmark_map = {
                "solubility": "solubility",
                "logp": "logd",
                "logd": "logd",
                "hydration_free_energy": "hydration_free_energy",
            }

            target_dataset = benchmark_map.get(property_name)
            if target_dataset and target_dataset in training_data:
                smiles, values = training_data[target_dataset]
                all_smiles.extend(smiles)
                all_values.extend(values)
                all_sources.extend([f"benchmark_{target_dataset}"] * len(smiles))

        logger.info(
            f"QSPR training data for '{property_name}': "
            f"{len(all_smiles)} samples from {set(all_sources)}"
        )
        return all_smiles, all_values, all_sources

    def benchmark_summary(self) -> Dict[str, Any]:
        """Get summary of all available benchmark data."""
        return self.benchmarks.summary()

    def clear_cache(self):
        """Clear the enrichment cache."""
        self._cache.clear()
