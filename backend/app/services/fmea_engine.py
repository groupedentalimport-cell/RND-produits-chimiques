"""
FMEA Risk Assessment Engine — ICH Q9 Compliant

Implements Failure Mode and Effects Analysis (FMEA) for:
  - Pharmaceutical stability studies
  - Chemical product formulation
  - Manufacturing processes
  - Computer system validation

Risk Priority Number (RPN) = Severity × Occurrence × Detection
  - Severity:   1 (negligible) → 10 (catastrophic)
  - Occurrence: 1 (extremely unlikely) → 10 (almost certain)
  - Detection:  1 (almost certain detection) → 10 (undetectable)

RPN Scale:
  1-50    → Low risk (acceptable)
  51-100  → Medium risk (monitor)
  101-200 → High risk (mitigation required)
  201-1000 → Critical risk (immediate action)
"""

import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════
# Types
# ═══════════════════════════════════════════════════════════════════════

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskStatus(str, Enum):
    IDENTIFIED = "identified"
    ANALYZED = "analyzed"
    MITIGATED = "mitigated"
    ACCEPTED = "accepted"
    CLOSED = "closed"


@dataclass
class FailureMode:
    """A single failure mode in the FMEA."""
    id: str
    component: str
    failure_mode: str
    effect: str
    cause: str

    # Scores (1-10)
    severity: int
    occurrence: int
    detection: int

    # Computed
    rpn: int = 0
    risk_level: RiskLevel = RiskLevel.LOW

    # Mitigation
    current_controls: List[str] = field(default_factory=list)
    recommended_actions: List[str] = field(default_factory=list)
    responsible: str = ""
    target_date: str = ""
    status: RiskStatus = RiskStatus.IDENTIFIED

    # Post-mitigation scores
    severity_post: Optional[int] = None
    occurrence_post: Optional[int] = None
    detection_post: Optional[int] = None
    rpn_post: Optional[int] = None

    def compute_rpn(self):
        """Compute Risk Priority Number."""
        self.rpn = self.severity * self.occurrence * self.detection
        if self.rpn <= 50:
            self.risk_level = RiskLevel.LOW
        elif self.rpn <= 100:
            self.risk_level = RiskLevel.MEDIUM
        elif self.rpn <= 200:
            self.risk_level = RiskLevel.HIGH
        else:
            self.risk_level = RiskLevel.CRITICAL

    def compute_post_rpn(self):
        """Compute post-mitigation RPN."""
        if all(v is not None for v in [self.severity_post, self.occurrence_post, self.detection_post]):
            self.rpn_post = self.severity_post * self.occurrence_post * self.detection_post


@dataclass
class FMEAStudy:
    """A complete FMEA study."""
    id: str
    title: str
    scope: str
    study_type: str  # "process", "design", "system", "stability"
    team: List[str]
    failure_modes: List[FailureMode] = field(default_factory=list)
    created_at: str = ""
    status: str = "draft"

    def summary(self) -> Dict[str, Any]:
        """Generate FMEA summary statistics."""
        if not self.failure_modes:
            return {"total": 0}

        rpns = [fm.rpn for fm in self.failure_modes]
        return {
            "total_failure_modes": len(self.failure_modes),
            "mean_rpn": round(sum(rpns) / len(rpns), 1),
            "max_rpn": max(rpns),
            "min_rpn": min(rpns),
            "critical_count": sum(1 for fm in self.failure_modes if fm.risk_level == RiskLevel.CRITICAL),
            "high_count": sum(1 for fm in self.failure_modes if fm.risk_level == RiskLevel.HIGH),
            "medium_count": sum(1 for fm in self.failure_modes if fm.risk_level == RiskLevel.MEDIUM),
            "low_count": sum(1 for fm in self.failure_modes if fm.risk_level == RiskLevel.LOW),
            "mitigated_count": sum(1 for fm in self.failure_modes if fm.status == RiskStatus.MITIGATED),
        }


# ═══════════════════════════════════════════════════════════════════════
# Pre-built FMEA Templates
# ═══════════════════════════════════════════════════════════════════════

def create_stability_fmea(
    study_id: str,
    substance_name: str,
    temperature_c: float,
    humidity_percent: float,
) -> FMEAStudy:
    """
    Create an FMEA study for a stability study.
    Pre-populates common failure modes for pharmaceutical stability testing.
    """
    fmea = FMEAStudy(
        id=f"FMEA-STB-{study_id}",
        title=f"Risk Assessment — Stability Study {study_id}",
        scope=f"Stability testing of {substance_name} at {temperature_c}°C / {humidity_percent}% RH",
        study_type="stability",
        team=["QA", "Analytical", "Formulation"],
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    # ── Common failure modes for stability studies ─────────────────────

    failure_modes = [
        FailureMode(
            id="FM-001",
            component="Storage Chamber",
            failure_mode="Temperature excursion beyond ±2°C",
            effect="Accelerated/degraded data, invalid shelf-life estimate",
            cause="Equipment malfunction, power failure, door left open",
            severity=8, occurrence=4, detection=3,
            current_controls=["Temperature alarm system", "24/7 monitoring", "Backup power"],
            recommended_actions=["Install redundant temperature sensors", "Add SMS/email alerts"],
            status=RiskStatus.IDENTIFIED,
        ),
        FailureMode(
            id="FM-002",
            component="Storage Chamber",
            failure_mode="Humidity excursion beyond ±5% RH",
            effect="Moisture-related degradation, inaccurate results",
            cause="Humidifier/dehumidifier failure, door seal degradation",
            severity=6, occurrence=3, detection=4,
            current_controls=["Humidity monitoring", "Calibrated sensors"],
            recommended_actions=["Quarterly sensor calibration", "Door seal inspection"],
            status=RiskStatus.IDENTIFIED,
        ),
        FailureMode(
            id="FM-003",
            component="Sampling",
            failure_mode="Incorrect sampling time point",
            effect="Missing data point, study timeline disruption",
            cause="Scheduling error, personnel oversight",
            severity=5, occurrence=3, detection=2,
            current_controls=["Study protocol with time points", "Calendar reminders"],
            recommended_actions=["Automated LIMS scheduling", "Double-check system"],
            status=RiskStatus.IDENTIFIED,
        ),
        FailureMode(
            id="FM-004",
            component="Analytical Method",
            failure_mode="Method validation failure / OOS result",
            effect="Unreliable assay data, potential product recall",
            cause="Method not stability-indicating, column degradation, reference standard issue",
            severity=9, occurrence=2, detection=3,
            current_controls=["Method validation report", "System suitability tests"],
            recommended_actions=["Periodic method revalidation", "Column lifetime tracking"],
            status=RiskStatus.IDENTIFIED,
        ),
        FailureMode(
            id="FM-005",
            component="Container Closure",
            failure_mode="Container-closure interaction",
            effect="Leaching, absorption, moisture ingress",
            cause="Incompatible packaging material, seal integrity failure",
            severity=7, occurrence=3, detection=5,
            current_controls=["Container compatibility studies", "Extractable/leachable testing"],
            recommended_actions=["Add container-closure integrity testing at each time point"],
            status=RiskStatus.IDENTIFIED,
        ),
        FailureMode(
            id="FM-006",
            component="Data Integrity",
            failure_mode="Data transcription error or loss",
            effect="Invalid study data, regulatory non-compliance",
            cause="Manual data entry, system failure, lack of backup",
            severity=8, occurrence=3, detection=2,
            current_controls=["Electronic data capture", "Audit trail", "Backup system"],
            recommended_actions=["Implement ALCOA+ checks", "Automated data transfer from instruments"],
            status=RiskStatus.IDENTIFIED,
        ),
        FailureMode(
            id="FM-007",
            component="Photostability",
            failure_mode="Uncontrolled light exposure during handling",
            effect="Photodegradation not accounted for in study",
            cause="Sample handling in non-controlled lighting",
            severity=5, occurrence=4, detection=6,
            current_controls=["Light-protective packaging", "Handling SOPs"],
            recommended_actions=["Yellow light handling areas", "Light exposure logging"],
            status=RiskStatus.IDENTIFIED,
        ),
        FailureMode(
            id="FM-008",
            component="Reference Standard",
            failure_mode="Degraded or expired reference standard",
            effect="Inaccurate assay results, systematic bias",
            cause="Improper storage, expired lot not replaced",
            severity=7, occurrence=2, detection=3,
            current_controls=["Reference standard log", "Expiry tracking"],
            recommended_actions=["Automated expiry alerts", "Certificate of analysis verification"],
            status=RiskStatus.IDENTIFIED,
        ),
    ]

    for fm in failure_modes:
        fm.compute_rpn()

    fmea.failure_modes = failure_modes
    return fmea


def create_system_validation_fmea(system_name: str) -> FMEAStudy:
    """
    Create an FMEA for computer system validation (CSV).
    Covers common IT system risks for GxP systems.
    """
    fmea = FMEAStudy(
        id=f"FMEA-SYS-{system_name}",
        title=f"Risk Assessment — Computer System Validation: {system_name}",
        scope=f"GxP computer system validation for {system_name}",
        study_type="system",
        team=["IT", "QA", "System Owner"],
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    failure_modes = [
        FailureMode(
            id="FM-SYS-001",
            component="Authentication",
            failure_mode="Unauthorized access to the system",
            effect="Data tampering, regulatory non-compliance",
            cause="Weak password policy, no MFA, shared accounts",
            severity=9, occurrence=3, detection=4,
            current_controls=["Password policy", "Account lockout", "Session timeout"],
            recommended_actions=["Implement MFA", "Role-based access review every 6 months"],
            status=RiskStatus.IDENTIFIED,
        ),
        FailureMode(
            id="FM-SYS-002",
            component="Audit Trail",
            failure_mode="Audit trail gaps or modification",
            effect="Loss of data integrity, 21 CFR Part 11 violation",
            cause="System bug, database corruption, admin override",
            severity=10, occurrence=2, detection=2,
            current_controls=["Append-only audit log", "Database replication"],
            recommended_actions=["Hash chain verification", "Automated integrity checks"],
            status=RiskStatus.IDENTIFIED,
        ),
        FailureMode(
            id="FM-SYS-003",
            component="Data Backup",
            failure_mode="Data loss due to backup failure",
            effect="Permanent loss of study data",
            cause="Backup job failure, storage corruption, ransomware",
            severity=10, occurrence=2, detection=5,
            current_controls=["Daily automated backup", "Offsite replication"],
            recommended_actions=["Monthly restore test", "Air-gapped backup"],
            status=RiskStatus.IDENTIFIED,
        ),
        FailureMode(
            id="FM-SYS-004",
            component="Electronic Signature",
            failure_mode="Signature not linked to signed record",
            effect="Invalid signature, regulatory rejection",
            cause="System bug, incorrect implementation",
            severity=9, occurrence=2, detection=3,
            current_controls=["Signature verification routine", "QA review"],
            recommended_actions=["Automated signature-record linkage verification"],
            status=RiskStatus.IDENTIFIED,
        ),
    ]

    for fm in failure_modes:
        fm.compute_rpn()

    fmea.failure_modes = failure_modes
    return fmea


# ═══════════════════════════════════════════════════════════════════════
# FMEA Report Generator
# ═══════════════════════════════════════════════════════════════════════

def generate_fmea_report(fmea: FMEAStudy) -> Dict[str, Any]:
    """Generate a structured FMEA report for regulatory submission."""
    summary = fmea.summary()

    return {
        "header": {
            "fmea_id": fmea.id,
            "title": fmea.title,
            "scope": fmea.scope,
            "study_type": fmea.study_type,
            "team": fmea.team,
            "created_at": fmea.created_at,
            "status": fmea.status,
        },
        "summary": summary,
        "failure_modes": [
            {
                "id": fm.id,
                "component": fm.component,
                "failure_mode": fm.failure_mode,
                "effect": fm.effect,
                "cause": fm.cause,
                "scores": {
                    "severity": fm.severity,
                    "occurrence": fm.occurrence,
                    "detection": fm.detection,
                    "rpn": fm.rpn,
                    "risk_level": fm.risk_level.value,
                },
                "controls": fm.current_controls,
                "recommended_actions": fm.recommended_actions,
                "responsible": fm.responsible,
                "status": fm.status.value,
                "post_mitigation": {
                    "severity": fm.severity_post,
                    "occurrence": fm.occurrence_post,
                    "detection": fm.detection_post,
                    "rpn": fm.rpn_post,
                } if fm.rpn_post is not None else None,
            }
            for fm in fmea.failure_modes
        ],
        "conclusion": _fmea_conclusion(summary),
    }


def _fmea_conclusion(summary: Dict) -> str:
    """Generate FMEA conclusion text."""
    critical = summary.get("critical_count", 0)
    high = summary.get("high_count", 0)
    total = summary.get("total_failure_modes", 0)

    if critical > 0:
        return (
            f"⚠️ {critical} critical risk(s) identified requiring immediate action. "
            f"Study cannot proceed until critical risks are mitigated to acceptable level."
        )
    elif high > 0:
        return (
            f"⚠️ {high} high-risk failure mode(s) identified. "
            f"Mitigation plans must be documented and tracked before study approval."
        )
    else:
        return (
            f"✅ All {total} identified risks are low to medium. "
            f"Standard controls are adequate. Study may proceed."
        )
