"""
ICH Stability Standards Module — Q1A-Q1F, Q8, Q9, Q1E, M7.
Implements regulatory-compliant stability protocols for pharmaceutical products.

ICH Q1A-Q1F: Stability testing of new drug substances and products
  - Zone I-IVb climate zones with specific temperature/humidity conditions
  - Long-term, accelerated, intermediate, stress testing protocols
  - Storage conditions per zone with ICH-compliant time points

ICH Q8: Pharmaceutical Development
  - Design of Experiments (DoE) framework
  - Design Space definition
  - Control Strategy

ICH Q9: Quality Risk Management
  - Formal risk assessment (FMEA, FTA, HACCP)
  - Risk scoring with documented justification
  - Risk communication and review

ICH M7: Mutagenic Impurities
  - TTC (Threshold of Toxicological Concern) thresholds
  - Class 1-5 impurity classification
  - Alerting structural fragments
"""

import math
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════
# ICH Q1A-Q1F: Climate Zones and Storage Conditions
# ═══════════════════════════════════════════════════════════════════════

class ClimateZone(str, Enum):
    """ICH climate zones for stability testing."""
    ZONE_I = "I"       # Temperate (e.g., Northern Europe, Canada)
    ZONE_II = "II"     # Mediterranean/Subtropical (e.g., Southern Europe, Japan)
    ZONE_III = "III"   # Hot/Dry (e.g., Middle East, North Africa)
    ZONE_IVA = "IVa"   # Hot/Humid (e.g., Southeast Asia, Central America)
    ZONE_IVB = "IVb"   # Hot/Very Humid (e.g., Equatorial Africa, Amazon)


@dataclass
class StorageCondition:
    """ICH storage condition with specifications."""
    name: str
    zone: Optional[ClimateZone]
    temperature_c: float
    humidity_percent: Optional[float]
    duration_months: List[int]  # required time points
    study_type: str  # "long_term", "accelerated", "intermediate", "stress"
    ich_reference: str
    description: str


# ICH Q1A(R2) storage conditions
ICH_STORAGE_CONDITIONS: Dict[str, StorageCondition] = {
    # Long-term conditions per zone
    "long_term_I": StorageCondition(
        name="Long-term Zone I",
        zone=ClimateZone.ZONE_I,
        temperature_c=21.0, humidity_percent=45.0,
        duration_months=[0, 3, 6, 9, 12, 18, 24, 36],
        study_type="long_term",
        ich_reference="ICH Q1A(R2) §2.1.1",
        description="21°C ± 2°C / 45% RH ± 5% RH",
    ),
    "long_term_II": StorageCondition(
        name="Long-term Zone II",
        zone=ClimateZone.ZONE_II,
        temperature_c=25.0, humidity_percent=60.0,
        duration_months=[0, 3, 6, 9, 12, 18, 24, 36],
        study_type="long_term",
        ich_reference="ICH Q1A(R2) §2.1.2",
        description="25°C ± 2°C / 60% RH ± 5% RH",
    ),
    "long_term_III": StorageCondition(
        name="Long-term Zone III",
        zone=ClimateZone.ZONE_III,
        temperature_c=30.0, humidity_percent=35.0,
        duration_months=[0, 3, 6, 9, 12, 18, 24, 36],
        study_type="long_term",
        ich_reference="ICH Q1A(R2) §2.1.3",
        description="30°C ± 2°C / 35% RH ± 5% RH",
    ),
    "long_term_IVa": StorageCondition(
        name="Long-term Zone IVa",
        zone=ClimateZone.ZONE_IVA,
        temperature_c=30.0, humidity_percent=65.0,
        duration_months=[0, 3, 6, 9, 12, 18, 24, 36],
        study_type="long_term",
        ich_reference="ICH Q1A(R2) §2.1.4",
        description="30°C ± 2°C / 65% RH ± 5% RH",
    ),
    "long_term_IVb": StorageCondition(
        name="Long-term Zone IVb",
        zone=ClimateZone.ZONE_IVB,
        temperature_c=30.0, humidity_percent=75.0,
        duration_months=[0, 3, 6, 9, 12, 18, 24, 36],
        study_type="long_term",
        ich_reference="ICH Q1A(R2) §2.1.5",
        description="30°C ± 2°C / 75% RH ± 5% RH",
    ),

    # Accelerated conditions
    "accelerated": StorageCondition(
        name="Accelerated",
        zone=None,
        temperature_c=40.0, humidity_percent=75.0,
        duration_months=[0, 1, 2, 3, 6],
        study_type="accelerated",
        ich_reference="ICH Q1A(R2) §2.2",
        description="40°C ± 2°C / 75% RH ± 5% RH",
    ),

    # Intermediate conditions
    "intermediate": StorageCondition(
        name="Intermediate",
        zone=None,
        temperature_c=30.0, humidity_percent=65.0,
        duration_months=[0, 3, 6, 9, 12],
        study_type="intermediate",
        ich_reference="ICH Q1A(R2) §2.3",
        description="30°C ± 2°C / 65% RH ± 5% RH",
    ),

    # Stress conditions (ICH Q1A §2.4)
    "stress_thermal": StorageCondition(
        name="Thermal Stress",
        zone=None,
        temperature_c=50.0, humidity_percent=None,
        duration_months=[0, 1],
        study_type="stress",
        ich_reference="ICH Q1A(R2) §2.4",
        description="50°C — thermal degradation study",
    ),
    "stress_humidity": StorageCondition(
        name="Humidity Stress",
        zone=None,
        temperature_c=25.0, humidity_percent=90.0,
        duration_months=[0, 1],
        study_type="stress",
        ich_reference="ICH Q1A(R2) §2.4",
        description="25°C / 90% RH — humidity stress",
    ),
    "stress_photolytic": StorageCondition(
        name="Photolytic Stress",
        zone=None,
        temperature_c=25.0, humidity_percent=None,
        duration_months=[0, 1],
        study_type="stress",
        ich_reference="ICH Q1B §2",
        description="ICH Q1B photostability — Option 2 (≥1.2M lux·h, ≥200 W·h/m² UV)",
    ),
    "stress_oxidative": StorageCondition(
        name="Oxidative Stress",
        zone=None,
        temperature_c=25.0, humidity_percent=None,
        duration_months=[0, 1],
        study_type="stress",
        ich_reference="ICH Q1A(R2) §2.4",
        description="H₂O₂ exposure — oxidative degradation study",
    ),
}


@dataclass
class StabilityProtocol:
    """ICH-compliant stability testing protocol."""
    protocol_id: str
    product_name: str
    product_type: str  # "drug_substance", "drug_product"
    climate_zone: ClimateZone
    study_type: str  # "long_term", "accelerated", "intermediate"

    # Storage conditions
    storage_condition: StorageCondition
    packaging_configuration: str
    container_closure: str

    # Test schedule
    time_points_months: List[int]
    test_parameters: List[str]  # e.g., ["assay", "impurities", "dissolution", "appearance"]

    # Acceptance criteria
    acceptance_criteria: Dict[str, Dict[str, float]]  # param → {lower, upper, units}

    # Regulatory
    ich_reference: str
    regulatory_market: List[str]  # ["FDA", "EMA", "NMPA", "PMDA"]

    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class StabilityTimePoint:
    """A single stability test time point result."""
    time_months: float
    temperature_c: float
    humidity_percent: Optional[float]
    parameters: Dict[str, Any]  # param → {"value": float, "unit": str, "pass": bool}
    tested_at: str
    analyst: str
    method_reference: str
    out_of_spec: bool = False
    oos_results: List[str] = field(default_factory=list)


@dataclass
class StabilityStudyResult:
    """Complete stability study result."""
    protocol: StabilityProtocol
    time_points: List[StabilityTimePoint]
    shelf_life_months: Optional[float] = None
    retest_period_months: Optional[float] = None
    conclusion: str = ""
    regulatory_compliant: bool = False


# ═══════════════════════════════════════════════════════════════════════
# ICH Q8: Design of Experiments (DoE)
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class DoEFactor:
    """A factor in a Design of Experiments."""
    name: str
    unit: str
    low_level: float
    high_level: float
    center_point: float
    type: str  # "continuous", "categorical"


@dataclass
class DoEResponse:
    """A response variable in DoE."""
    name: str
    unit: str
    target: float
    lower_limit: float
    upper_limit: float
    optimization: str  # "maximize", "minimize", "target"


@dataclass
class DesignSpace:
    """ICH Q8 Design Space — proven acceptable ranges."""
    factors: List[DoEFactor]
    responses: List[DoEResponse]
    proven_acceptable_ranges: Dict[str, Tuple[float, float]]
    control_strategy: Dict[str, Any]
    design_type: str  # "full_factorial", "fractional_factorial", "central_composite", "box_behnken"
    n_experiments: int
    ich_reference: str = "ICH Q8(R2)"


class ICHQ8DesignOfExperiments:
    """
    ICH Q8 Design of Experiments framework.
    Supports factorial, fractional factorial, central composite, and Box-Behnken designs.
    """

    def generate_full_factorial(self, factors: List[DoEFactor]) -> List[Dict[str, float]]:
        """Generate full factorial design matrix."""
        import itertools
        levels = [[f.low_level, f.high_level] for f in factors]
        combinations = list(itertools.product(*levels))
        design = []
        for combo in combinations:
            point = {f.name: v for f, v in zip(factors, combo)}
            design.append(point)
        return design

    def generate_center_composite(self, factors: List[DoEFactor]) -> List[Dict[str, float]]:
        """Generate central composite design (CCD)."""
        import itertools
        n = len(factors)
        alpha = math.sqrt(n)  # rotatable design

        # Factorial points
        factorial = self.generate_full_factorial(factors)

        # Axial points
        axial = []
        for i, f in enumerate(factors):
            center = f.center_point
            step = (f.high_level - f.low_level) / 2 * alpha
            axial.append({f.name: center - step, **{g.name: g.center_point for g in factors if g.name != f.name}})
            axial.append({f.name: center + step, **{g.name: g.center_point for g in factors if g.name != f.name}})

        # Center points (3-6 replicates)
        center_points = [{f.name: f.center_point for f in factors}] * 3

        return factorial + axial + center_points

    def generate_box_behnken(self, factors: List[DoEFactor]) -> List[Dict[str, float]]:
        """Generate Box-Behnken design (3 factors only)."""
        if len(factors) != 3:
            raise ValueError("Box-Behnken requires exactly 3 factors")

        f1, f2, f3 = factors
        design = []

        # 12 edge midpoints + 3 center points
        for combo in [(0, 0, 1), (0, 0, -1), (0, 1, 0), (0, -1, 0), (1, 0, 0), (-1, 0, 0)]:
            for sign in [1, -1]:
                point = {}
                for i, (f, level) in enumerate(zip(factors, combo)):
                    if level == 0:
                        point[f.name] = f.center_point
                    elif level == 1:
                        point[f.name] = f.high_level
                    else:
                        point[f.name] = f.low_level
                design.append(point)

        # Center points
        design.extend([{f.name: f.center_point for f in factors}] * 3)

        return design

    def define_design_space(
        self,
        factors: List[DoEFactor],
        responses: List[DoEResponse],
        design_type: str = "central_composite",
    ) -> DesignSpace:
        """Define an ICH Q8 Design Space."""
        if design_type == "full_factorial":
            design = self.generate_full_factorial(factors)
        elif design_type == "central_composite":
            design = self.generate_center_composite(factors)
        elif design_type == "box_behnken":
            design = self.generate_box_behnken(factors)
        else:
            design = self.generate_full_factorial(factors)

        # Proven acceptable ranges (from experimental data)
        proven_ranges = {}
        for f in factors:
            proven_ranges[f.name] = (f.low_level, f.high_level)

        return DesignSpace(
            factors=factors,
            responses=responses,
            proven_acceptable_ranges=proven_ranges,
            control_strategy={},
            design_type=design_type,
            n_experiments=len(design),
        )


# ═══════════════════════════════════════════════════════════════════════
# ICH Q9: Quality Risk Management
# ═══════════════════════════════════════════════════════════════════════

class RiskAssessmentMethod(str, Enum):
    FMEA = "fmea"          # Failure Mode and Effects Analysis
    FTA = "fta"            # Fault Tree Analysis
    HACCP = "haccp"        # Hazard Analysis and Critical Control Points
    HAZOP = "hazop"        # Hazard and Operability Study
    PHA = "pha"            # Preliminary Hazard Analysis
    RISK_MATRIX = "risk_matrix"  # Simple probability × severity


@dataclass
class Q9RiskItem:
    """A single risk item in ICH Q9 Quality Risk Management."""
    risk_id: str
    hazard: str
    harm: str
    severity: int       # 1-5 (1=negligible, 5=catastrophic)
    probability: int    # 1-5 (1=remote, 5=frequent)
    detectability: int  # 1-5 (1=always detected, 5=never detected)
    rpn: int            # Risk Priority Number = S × P × D
    risk_level: str     # "low", "medium", "high", "critical"
    control_measures: List[str]
    residual_risk: str
    responsible: str
    deadline: str
    status: str  # "open", "in_progress", "mitigated", "accepted"
    justification: str = ""
    ich_reference: str = "ICH Q9"


@dataclass
class Q9RiskAssessment:
    """Complete ICH Q9 risk assessment."""
    assessment_id: str
    product_name: str
    process_name: str
    method: RiskAssessmentMethod
    risk_items: List[Q9RiskItem]
    overall_risk_level: str
    conducted_by: str
    reviewed_by: str
    approved_by: str
    date: str
    next_review_date: str
    conclusion: str


class ICHQ9RiskManager:
    """
    ICH Q9 Quality Risk Management — formalized risk assessment.
    """

    SEVERITY_LABELS = {1: "Negligible", 2: "Minor", 3: "Moderate", 4: "Major", 5: "Catastrophic"}
    PROBABILITY_LABELS = {1: "Remote", 2: "Unlikely", 3: "Possible", 4: "Likely", 5: "Frequent"}
    DETECTABILITY_LABELS = {1: "Always detected", 2: "Usually detected", 3: "Moderately detected", 4: "Rarely detected", 5: "Never detected"}

    def calculate_rpn(self, severity: int, probability: int, detectability: int) -> int:
        """Calculate Risk Priority Number: RPN = S × P × D"""
        return severity * probability * detectability

    def classify_risk(self, rpn: int) -> str:
        """Classify risk level from RPN."""
        if rpn <= 20:
            return "low"
        elif rpn <= 50:
            return "medium"
        elif rpn <= 100:
            return "high"
        else:
            return "critical"

    def assess_risk(
        self,
        risk_id: str,
        hazard: str,
        harm: str,
        severity: int,
        probability: int,
        detectability: int,
        control_measures: List[str],
        responsible: str,
    ) -> Q9RiskItem:
        """Perform a single risk assessment."""
        rpn = self.calculate_rpn(severity, probability, detectability)
        risk_level = self.classify_risk(rpn)

        # After controls, assume detectability improves
        residual_detectability = max(1, detectability - len(control_measures))
        residual_rpn = self.calculate_rpn(severity, probability, residual_detectability)
        residual_risk = self.classify_risk(residual_rpn)

        return Q9RiskItem(
            risk_id=risk_id,
            hazard=hazard,
            harm=harm,
            severity=severity,
            probability=probability,
            detectability=detectability,
            rpn=rpn,
            risk_level=risk_level,
            control_measures=control_measures,
            residual_risk=residual_risk,
            responsible=responsible,
            deadline="",
            status="open",
            justification=f"RPN={rpn} ({risk_level}). Controls reduce to {residual_rpn} ({residual_risk}).",
        )

    def create_assessment(
        self,
        product_name: str,
        process_name: str,
        risk_items: List[Q9RiskItem],
        conducted_by: str,
        reviewed_by: str,
        approved_by: str,
    ) -> Q9RiskAssessment:
        """Create a complete ICH Q9 risk assessment."""
        # Overall risk = highest individual risk
        risk_levels = ["low", "medium", "high", "critical"]
        max_risk_idx = max(risk_levels.index(r.risk_level) for r in risk_items)
        overall_risk = risk_levels[max_risk_idx]

        return Q9RiskAssessment(
            assessment_id=f"QRA-{datetime.now().strftime('%Y%m%d-%H%M')}",
            product_name=product_name,
            process_name=process_name,
            method=RiskAssessmentMethod.RISK_MATRIX,
            risk_items=risk_items,
            overall_risk_level=overall_risk,
            conducted_by=conducted_by,
            reviewed_by=reviewed_by,
            approved_by=approved_by,
            date=datetime.now(timezone.utc).isoformat(),
            next_review_date="",
            conclusion=f"Overall risk level: {overall_risk}. {len([r for r in risk_items if r.risk_level in ('high', 'critical')])} high/critical risks identified.",
        )


# ═══════════════════════════════════════════════════════════════════════
# ICH M7: Mutagenic Impurities
# ═══════════════════════════════════════════════════════════════════════

class M7ImpurityClass(str, Enum):
    """ICH M7 impurity classification."""
    CLASS_1 = "1"  # Known mutagenic carcinogen
    CLASS_2 = "2"  # Known mutagen, unknown carcinogenicity
    CLASS_3 = "3"  # Structural alert, unknown mutagenicity
    CLASS_4 = "4"  # No structural alert, no mutagenicity data
    CLASS_5 = "5"  # Not mutagenic (negative Ames test)


@dataclass
class M7Alert:
    """ICH M7 structural alert for mutagenicity."""
    alert_name: str
    smarts_pattern: str
    description: str
    severity: str  # "high", "moderate", "low"
    reference: str
    ttc_threshold_ng_day: float  # Threshold of Toxicological Concern


@dataclass
class M7Assessment:
    """ICH M7 mutagenic impurity assessment."""
    compound_name: str
    smiles: str
    impurity_class: M7ImpurityClass
    structural_alerts: List[M7Alert]
    ames_test_result: Optional[str] = None  # "positive", "negative", "not_tested"
    ttc_threshold_ng_day: float = 1500.0  # default TTC
    acceptable_intake_ug_day: float = 0.0
    control_strategy: str = ""
    justification: str = ""
    ich_reference: str = "ICH M7(R1)"


# ICH M7 structural alerts (SMARTS patterns)
M7_STRUCTURAL_ALERTS = [
    M7Alert(
        alert_name="Aromatic amine",
        smarts="c1ccccc1[NX3H2]",
        description="Primary aromatic amine — known mutagenic alert",
        severity="high",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
    M7Alert(
        alert_name="Nitroaromatic",
        smarts="c1ccc(cc1)[N+](=O)[O-]",
        description="Nitroaromatic — reduction to aromatic amine",
        severity="high",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
    M7Alert(
        alert_name="Alkyl halide (primary)",
        smarts="[CX4H2][F,Cl,Br,I]",
        description="Primary alkyl halide — SN2 alkylating agent",
        severity="high",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
    M7Alert(
        alert_name="Epoxide",
        smarts="C1OC1",
        description="Epoxide — strained ring, electrophilic",
        severity="high",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
    M7Alert(
        alert_name="Aziridine",
        smarts="C1NC1",
        description="Aziridine — strained ring, alkylating agent",
        severity="high",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
    M7Alert(
        alert_name="Aldehyde",
        smarts="[CX3H1](=O)[#6]",
        description="Aldehyde — electrophilic, Schiff base formation",
        severity="moderate",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
    M7Alert(
        alert_name="Michael acceptor",
        smarts="C=CC(=O)[#6]",
        description="α,β-unsaturated carbonyl — Michael addition acceptor",
        severity="moderate",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
    M7Alert(
        alert_name="N-nitroso",
        smarts="[NX2][N+](=O)[O-]",
        description="N-nitroso compound — potent mutagen",
        severity="high",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=1.5,  # very low TTC
    ),
    M7Alert(
        alert_name="Sulfonate ester",
        smarts="[OX2][SX3](=O)(=O)[#6]",
        description="Sulfonate ester — alkylating agent",
        severity="high",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
    M7Alert(
        alert_name="Acyl halide",
        smarts="[CX3](=O)[F,Cl,Br,I]",
        description="Acyl halide — reactive acylating agent",
        severity="moderate",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
    M7Alert(
        alert_name="Hydrazine",
        smarts="[NX3H2][NX3H2]",
        description="Hydrazine — mutagenic metabolite formation",
        severity="high",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
    M7Alert(
        alert_name="Azo compound",
        smarts="[NX2]=[NX2]",
        description="Azo — reductive cleavage to aromatic amines",
        severity="moderate",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
    M7Alert(
        alert_name="Propiolactone/propiosultone",
        smarts="C1CC(=O)O1",
        description="Lactone/sultone — alkylating agent",
        severity="high",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=1.5,
    ),
    M7Alert(
        alert_name="Acrylate/Methacrylate",
        smarts="C=CC(=O)O",
        description="Acrylate — Michael acceptor",
        severity="moderate",
        reference="ICH M7(R1) Appendix 3",
        ttc_threshold_ng_day=18.0,
    ),
]


class ICHM7Assessor:
    """
    ICH M7 Mutagenic Impurity Assessment.
    Detects structural alerts and classifies impurities.
    """

    def __init__(self):
        self.alerts = M7_STRUCTURAL_ALERTS
        self._compiled_patterns = {}
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile SMARTS patterns."""
        try:
            from rdkit import Chem
            for alert in self.alerts:
                mol = Chem.MolFromSmarts(alert.smarts_pattern)
                if mol is not None:
                    self._compiled_patterns[alert.alert_name] = mol
                else:
                    logger.warning(f"Invalid SMARTS for {alert.alert_name}: {alert.smarts_pattern}")
        except ImportError:
            logger.warning("RDKit not available — M7 SMARTS detection disabled")

    def assess_compound(
        self,
        smiles: str,
        compound_name: str = "",
        ames_result: Optional[str] = None,
        daily_dose_mg: float = 100.0,
    ) -> M7Assessment:
        """
        Assess a compound for mutagenic impurity risk per ICH M7.
        """
        detected_alerts = []

        # Check structural alerts
        try:
            from rdkit import Chem
            mol = Chem.MolFromSmiles(smiles)
            if mol is not None:
                for alert in self.alerts:
                    pattern = self._compiled_patterns.get(alert.alert_name)
                    if pattern and mol.HasSubstructMatch(pattern):
                        detected_alerts.append(alert)
        except Exception as e:
            logger.warning(f"M7 SMARTS check failed: {e}")

        # Classify per ICH M7
        if ames_result == "negative":
            impurity_class = M7ImpurityClass.CLASS_5
            justification = "Negative Ames test → Class 5 (not mutagenic)"
        elif detected_alerts and ames_result == "positive":
            impurity_class = M7ImpurityClass.CLASS_1
            justification = "Structural alert + positive Ames → Class 1 (known mutagen)"
        elif detected_alerts and ames_result is None:
            impurity_class = M7ImpurityClass.CLASS_3
            justification = "Structural alert present, no Ames data → Class 3"
        elif not detected_alerts and ames_result is None:
            impurity_class = M7ImpurityClass.CLASS_4
            justification = "No structural alert, no Ames data → Class 4"
        else:
            impurity_class = M7ImpurityClass.CLASS_4
            justification = "Default Class 4"

        # TTC threshold
        if detected_alerts:
            ttc = min(a.ttc_threshold_ng_day for a in detected_alerts)
        else:
            ttc = 1500.0  # default Class 4 TTC

        # Acceptable intake (from TTC and daily dose)
        acceptable_intake = ttc / 1000.0  # µg/day

        # Control strategy
        control = self._generate_control_strategy(impurity_class, ttc, daily_dose_mg, detected_alerts)

        return M7Assessment(
            compound_name=compound_name,
            smiles=smiles,
            impurity_class=impurity_class,
            structural_alerts=detected_alerts,
            ames_test_result=ames_result,
            ttc_threshold_ng_day=ttc,
            acceptable_intake_ug_day=round(acceptable_intake, 3),
            control_strategy=control,
            justification=justification,
        )

    def _generate_control_strategy(
        self,
        impurity_class: M7ImpurityClass,
        ttc: float,
        daily_dose_mg: float,
        alerts: List[M7Alert],
    ) -> str:
        """Generate control strategy based on ICH M7 classification."""
        if impurity_class == M7ImpurityClass.CLASS_5:
            return "No specific mutagenic impurity control required (Class 5 — negative Ames)."
        elif impurity_class == M7ImpurityClass.CLASS_4:
            return "General impurity control per ICH Q3A/Q3B. No specific mutagenic control required."
        elif impurity_class == M7ImpurityClass.CLASS_3:
            return (
                f"Class 3: Structural alert detected. Recommended: "
                f"(1) Ames test to reclassify, OR "
                f"(2) Control to TTC = {ttc} ng/day. "
                f"Alerts: {', '.join(a.alert_name for a in alerts)}"
            )
        elif impurity_class == M7ImpurityClass.CLASS_2:
            return (
                f"Class 2: Known mutagen. Control to acceptable intake = "
                f"{ttc/1000:.1f} µg/day. "
                f"Requires validated analytical method with LOQ ≤ {ttc*0.1:.0f} ng/day."
            )
        else:  # Class 1
            return (
                f"Class 1: Known mutagenic carcinogen. "
                f"Control to acceptable intake = {ttc/1000:.1f} µg/day. "
                f"Requires: (1) validated method, (2) process capability, "
                f"(3) routine testing, (4) alert to regulatory authority."
            )


# Global singletons
ich_q8 = ICHQ8DesignOfExperiments()
ich_q9 = ICHQ9RiskManager()
ich_m7 = ICHM7Assessor()
