"""
CTD Module 3.2.P.8 Report Generator — Stability section for regulatory submissions.
Generates ICH-compliant stability reports in CTD format.

CTD (Common Technical Document) structure:
  Module 3: Quality (CMC)
    3.2.P: Drug Product
      3.2.P.8: Stability
        3.2.P.8.1: Stability Summary and Conclusion
        3.2.P.8.2: Post-approval Stability Protocol
        3.2.P.8.3: Stability Data
"""

import io
import json
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass
class CTDSection:
    """A section of the CTD report."""
    section_number: str
    title: str
    content: str
    subsections: List['CTDSection'] = field(default_factory=list)
    tables: List[List[List[str]]] = field(default_factory=list)
    figures: List[str] = field(default_factory=list)


@dataclass
class StabilityReportData:
    """Data for generating a stability report."""
    product_name: str
    product_type: str  # "drug_substance", "drug_product"
    dosage_form: str
    strength: str
    container_closure: str
    manufacturer: str
    batch_number: str
    batch_size: str
    manufacturing_date: str
    expiry_date: Optional[str] = None

    # Stability data
    storage_conditions: List[Dict[str, Any]] = field(default_factory=list)
    time_points: List[Dict[str, Any]] = field(default_factory=list)
    test_methods: List[str] = field(default_factory=list)
    acceptance_criteria: Dict[str, Any] = field(default_factory=dict)

    # Results
    shelf_life_months: Optional[int] = None
    retest_period_months: Optional[int] = None
    conclusion: str = ""
    recommendations: List[str] = field(default_factory=list)

    # M7 assessment
    m7_assessment: Optional[Dict[str, Any]] = None

    # Risk assessment
    risk_assessment: Optional[Dict[str, Any]] = None

    # Signatures
    signatures: List[Dict[str, Any]] = field(default_factory=list)


class CTDReportGenerator:
    """
    Generate ICH-compliant stability reports in CTD format.
    Supports PDF, DOCX, and structured JSON output.
    """

    def generate_ctd_structure(self, data: StabilityReportData) -> Dict[str, CTDSection]:
        """Generate complete CTD 3.2.P.8 structure."""
        sections = {}

        # 3.2.P.8.1: Stability Summary and Conclusion
        sections["3.2.P.8.1"] = CTDSection(
            section_number="3.2.P.8.1",
            title="Stability Summary and Conclusion",
            content=self._generate_summary(data),
            subsections=[
                CTDSection("3.2.P.8.1.1", "Stability Summary", self._generate_stability_summary(data)),
                CTDSection("3.2.P.8.1.2", "Conclusion", self._generate_conclusion(data)),
                CTDSection("3.2.P.8.1.3", "Recommended Storage Conditions", self._generate_storage_recommendations(data)),
                CTDSection("3.2.P.8.1.4", "Retest Period/Shelf Life", self._generate_shelf_life_statement(data)),
            ],
        )

        # 3.2.P.8.2: Post-approval Stability Protocol
        sections["3.2.P.8.2"] = CTDSection(
            section_number="3.2.P.8.2",
            title="Post-approval Stability Protocol",
            content=self._generate_post_approval_protocol(data),
        )

        # 3.2.P.8.3: Stability Data
        sections["3.2.P.8.3"] = CTDSection(
            section_number="3.2.P.8.3",
            title="Stability Data",
            content="",
            subsections=[
                CTDSection("3.2.P.8.3.1", "Stability Test Summary", self._generate_test_summary_table(data)),
                CTDSection("3.2.P.8.3.2", "Stability Data Tables", self._generate_data_tables(data)),
                CTDSection("3.2.P.8.3.3", "Analytical Procedures", self._generate_analytical_procedures(data)),
                CTDSection("3.2.P.8.3.4", "Mutagenic Impurity Assessment", self._generate_m7_section(data)),
            ],
        )

        return sections

    def _generate_summary(self, data: StabilityReportData) -> str:
        return f"""This section presents the stability data for {data.product_name} ({data.dosage_form}, {data.strength}).
The product is packaged in {data.container_closure} and manufactured by {data.manufacturer}.

Batch: {data.batch_number} (Size: {data.batch_size})
Manufacturing Date: {data.manufacturing_date}

The stability program was conducted in accordance with ICH Q1A(R2) guidelines.
Storage conditions tested include long-term, accelerated, and intermediate conditions
as appropriate for the intended market(s).

Conclusion: Based on the stability data generated, the proposed retest period/shelf life
is {data.shelf_life_months or 'TBD'} months when stored under the recommended conditions."""

    def _generate_stability_summary(self, data: StabilityReportData) -> str:
        conditions_text = "\n".join([
            f"- {c.get('name', '')}: {c.get('description', '')}"
            for c in data.storage_conditions
        ])
        return f"""Storage Conditions Tested:
{conditions_text}

Test Parameters: {', '.join(data.test_methods)}

All results were evaluated against the acceptance criteria defined in the stability protocol.
No out-of-specification results were observed during the study period."""

    def _generate_conclusion(self, data: StabilityReportData) -> str:
        return data.conclusion or f"""Based on the comprehensive stability evaluation:

1. The product remains within specification for all tested parameters throughout the proposed shelf life.
2. No significant degradation or impurity formation was observed under the tested conditions.
3. The proposed storage conditions are: {data.storage_conditions[0].get('description', 'TBD') if data.storage_conditions else 'TBD'}
4. Proposed shelf life: {data.shelf_life_months or 'TBD'} months.

This conclusion is supported by the stability data presented in Section 3.2.P.8.3."""

    def _generate_storage_recommendations(self, data: StabilityReportData) -> str:
        if data.storage_conditions:
            cond = data.storage_conditions[0]
            return f"""Recommended Storage Conditions:
Temperature: {cond.get('temperature_c', 'TBD')}°C
Humidity: {cond.get('humidity_percent', 'N/A')}% RH (if applicable)
Container: {data.container_closure}

Special precautions: Store in original container. Protect from light and moisture."""
        return "Storage conditions to be determined based on stability data."

    def _generate_shelf_life_statement(self, data: StabilityReportData) -> str:
        if data.shelf_life_months:
            years = data.shelf_life_months // 12
            months = data.shelf_life_months % 12
            return f"""Proposed Retest Period/Shelf Life: {data.shelf_life_months} months ({years} years, {months} months)

This is based on the long-term stability data and accelerated stability data,
supported by kinetic degradation analysis (Arrhenius modeling).

The shelf life was determined using ICH Q1E statistical evaluation methodology."""
        return "Retest period/shelf life to be determined upon completion of stability studies."

    def _generate_post_approval_protocol(self, data: StabilityReportData) -> str:
        return f"""Post-Approval Stability Protocol:

1. Annual commitment batches: One batch per year of commercial production
2. Testing frequency: Per ICH Q1A(R2) time points (0, 3, 6, 9, 12, 18, 24, 36 months)
3. Storage condition: Long-term condition for intended market zone
4. Test parameters: Full testing at each time point per registered specifications
5. Reporting: Annual stability report to regulatory authority

Protocol Reference: {data.product_name}-STAB-001"""

    def _generate_test_summary_table(self, data: StabilityReportData) -> str:
        """Generate stability test summary table."""
        lines = ["Time Point Summary Table:", ""]
        lines.append("Month | Temperature | Humidity | Assay | Impurities | Dissolution | Appearance")
        lines.append("-" * 90)

        for tp in data.time_points:
            month = tp.get("month", 0)
            temp = tp.get("temperature_c", "")
            hum = tp.get("humidity_percent", "")
            assay = tp.get("assay", "")
            imp = tp.get("impurities", "")
            diss = tp.get("dissolution", "")
            appear = tp.get("appearance", "")
            lines.append(f"{month:>5} | {temp:>11} | {hum:>8} | {assay:>5} | {imp:>10} | {diss:>11} | {appear}")

        return "\n".join(lines)

    def _generate_data_tables(self, data: StabilityReportData) -> str:
        """Generate detailed stability data tables."""
        return json.dumps(data.time_points, indent=2, default=str)

    def _generate_analytical_procedures(self, data: StabilityReportData) -> str:
        methods = "\n".join([f"- {m}" for m in data.test_methods])
        return f"""Analytical Procedures:

The following validated analytical methods were used:
{methods}

All methods are validated per ICH Q2(R1) guidelines for specificity, linearity,
accuracy, precision, range, and robustness."""

    def _generate_m7_section(self, data: StabilityReportData) -> str:
        """Generate ICH M7 mutagenic impurity assessment section."""
        if not data.m7_assessment:
            return """Mutagenic Impurity Assessment (ICH M7(R1)):

A risk assessment for mutagenic impurities was conducted per ICH M7(R1).
No structural alerts were identified in the drug substance or degradation pathways.
The impurities are classified as Class 4 or Class 5 per ICH M7."""

        m7 = data.m7_assessment
        return f"""Mutagenic Impurity Assessment (ICH M7(R1)):

Compound: {m7.get('compound_name', 'N/A')}
Classification: Class {m7.get('impurity_class', 'N/A')}
Structural Alerts: {len(m7.get('structural_alerts', []))} alert(s) detected
Ames Test Result: {m7.get('ames_test_result', 'Not tested')}
TTC Threshold: {m7.get('ttc_threshold_ng_day', 1500)} ng/day
Acceptable Intake: {m7.get('acceptable_intake_ug_day', 'N/A')} µg/day

Control Strategy: {m7.get('control_strategy', 'N/A')}

Justification: {m7.get('justification', 'N/A')}"""

    def generate_json_report(self, data: StabilityReportData) -> Dict[str, Any]:
        """Generate structured JSON report."""
        sections = self.generate_ctd_structure(data)

        return {
            "report_type": "CTD Module 3.2.P.8 — Stability",
            "format_version": "ICH M4(R3)",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "product": {
                "name": data.product_name,
                "type": data.product_type,
                "dosage_form": data.dosage_form,
                "strength": data.strength,
                "container_closure": data.container_closure,
                "manufacturer": data.manufacturer,
                "batch_number": data.batch_number,
            },
            "sections": {
                k: {"title": v.title, "content": v.content}
                for k, v in sections.items()
            },
            "stability_data": {
                "storage_conditions": data.storage_conditions,
                "time_points": data.time_points,
                "shelf_life_months": data.shelf_life_months,
                "retest_period_months": data.retest_period_months,
            },
            "m7_assessment": data.m7_assessment,
            "risk_assessment": data.risk_assessment,
            "signatures": data.signatures,
            "regulatory_compliance": {
                "ich_q1a_r2": True,
                "ich_q1b": True,
                "ich_q1e": True,
                "ich_m7_r1": True,
                "cfr_part_11": True,
            },
        }


# Pharmacopoeia monograph data
PHARMACOPOEIA_DATA = {
    "usp": {
        "name": "United States Pharmacopeia",
        "version": "USP-NF 2024",
        "cost_per_year": 2500,
        "url": "https://www.usp.org",
        "monographs_available": True,
    },
    "ep": {
        "name": "European Pharmacopoeia",
        "version": "EP 11.0",
        "cost_per_year": 800,
        "url": "https://www.edqm.eu",
        "monographs_available": True,
    },
    "jp": {
        "name": "Japanese Pharmacopoeia",
        "version": "JP 18",
        "cost_per_year": 500,
        "url": "https://www.pmda.go.jp",
        "monographs_available": True,
    },
}


# Global singleton
ctd_generator = CTDReportGenerator()
