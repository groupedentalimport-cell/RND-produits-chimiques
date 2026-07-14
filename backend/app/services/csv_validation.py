"""
Computer System Validation (CSV) — IQ/OQ/PQ Protocols
ChemStab Industrial v5.3 — GxP Qualification

Implements:
  - IQ: Installation Qualification
  - OQ: Operational Qualification
  - PQ: Performance Qualification
  - Traceability Matrix
  - Deviation Management
  - Validation Summary Report

Reference: GAMP 5, 21 CFR Part 11, EU Annex 11
"""

import json
import logging
import platform
import sys
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════
# Types
# ═══════════════════════════════════════════════════════════════════════

class TestStatus(str, Enum):
    NOT_RUN = "not_run"
    PASSED = "passed"
    FAILED = "failed"
    BLOCKED = "blocked"
    DEVIATION = "deviation"


class Severity(str, Enum):
    CRITICAL = "critical"    # Blocks qualification
    MAJOR = "major"          # Requires CAPA
    MINOR = "minor"          # Document only


@dataclass
class TestCase:
    """A single qualification test case."""
    id: str
    protocol: str  # "IQ", "OQ", "PQ"
    category: str
    description: str
    expected_result: str
    actual_result: str = ""
    status: TestStatus = TestStatus.NOT_RUN
    evidence: str = ""
    tester: str = ""
    tested_at: str = ""
    notes: str = ""


@dataclass
class Deviation:
    """A deviation found during qualification."""
    id: str
    test_id: str
    severity: Severity
    description: str
    impact: str
    root_cause: str = ""
    capa: str = ""
    status: str = "open"  # open, investigated, capa_implemented, closed
    raised_by: str = ""
    raised_at: str = ""
    closed_by: str = ""
    closed_at: str = ""


@dataclass
class ValidationProtocol:
    """A complete IQ/OQ/PQ validation protocol."""
    id: str
    protocol_type: str  # "IQ", "OQ", "PQ"
    system_name: str
    version: str
    scope: str
    test_cases: List[TestCase] = field(default_factory=list)
    deviations: List[Deviation] = field(default_factory=list)
    created_at: str = ""
    executed_by: str = ""
    reviewed_by: str = ""
    approved_by: str = ""
    status: str = "draft"  # draft, executing, completed, approved


# ═══════════════════════════════════════════════════════════════════════
# IQ — Installation Qualification
# ═══════════════════════════════════════════════════════════════════════

def create_iq_protocol(system_name: str, version: str) -> ValidationProtocol:
    """
    Create an Installation Qualification protocol.
    Verifies that the system is installed correctly per specifications.
    """
    protocol = ValidationProtocol(
        id=f"IQ-{system_name}-{version}",
        protocol_type="IQ",
        system_name=system_name,
        version=version,
        scope="Verify correct installation of software, database, and dependencies",
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    test_cases = [
        # ── Software Installation ──────────────────────────────────────
        TestCase(
            id="IQ-001", protocol="IQ", category="Software",
            description="Verify Python version >= 3.11",
            expected_result="Python 3.11.x or higher",
        ),
        TestCase(
            id="IQ-002", protocol="IQ", category="Software",
            description="Verify all Python dependencies installed (requirements.txt)",
            expected_result="pip check returns no broken dependencies",
        ),
        TestCase(
            id="IQ-003", protocol="IQ", category="Software",
            description="Verify FastAPI application starts without errors",
            expected_result="uvicorn starts, /health returns 200",
        ),
        TestCase(
            id="IQ-004", protocol="IQ", category="Software",
            description="Verify Node.js version >= 20 for frontend build",
            expected_result="Node.js 20.x or higher",
        ),
        TestCase(
            id="IQ-005", protocol="IQ", category="Software",
            description="Verify frontend builds without errors",
            expected_result="npm run build succeeds with exit code 0",
        ),

        # ── Database ───────────────────────────────────────────────────
        TestCase(
            id="IQ-010", protocol="IQ", category="Database",
            description="Verify PostgreSQL/Supabase connection",
            expected_result="Database connection successful, version returned",
        ),
        TestCase(
            id="IQ-011", protocol="IQ", category="Database",
            description="Verify all required tables exist",
            expected_result="All tables present per schema definition",
        ),
        TestCase(
            id="IQ-012", protocol="IQ", category="Database",
            description="Verify enum types created",
            expected_result="All enum types (study_type, study_status, etc.) exist",
        ),
        TestCase(
            id="IQ-013", protocol="IQ", category="Database",
            description="Verify indexes created",
            expected_result="All performance indexes exist",
        ),
        TestCase(
            id="IQ-014", protocol="IQ", category="Database",
            description="Verify RLS policies enabled",
            expected_result="Row Level Security active on all GxP tables",
        ),
        TestCase(
            id="IQ-015", protocol="IQ", category="Database",
            description="Verify audit triggers installed",
            expected_result="update_updated_at and log_audit triggers active",
        ),

        # ── Configuration ──────────────────────────────────────────────
        TestCase(
            id="IQ-020", protocol="IQ", category="Configuration",
            description="Verify SECRET_KEY is not default value",
            expected_result="SECRET_KEY != 'CHANGE-ME-in-production-use-openssl-rand-hex-32'",
        ),
        TestCase(
            id="IQ-021", protocol="IQ", category="Configuration",
            description="Verify CORS origins configured correctly",
            expected_result="ALLOWED_ORIGINS contains only production domains",
        ),
        TestCase(
            id="IQ-022", protocol="IQ", category="Configuration",
            description="Verify DEBUG=false in production",
            expected_result="DEBUG environment variable set to false",
        ),
        TestCase(
            id="IQ-023", protocol="IQ", category="Configuration",
            description="Verify SSL enabled for database connection",
            expected_result="sslmode=require in DATABASE_URL",
        ),

        # ── Security ───────────────────────────────────────────────────
        TestCase(
            id="IQ-030", protocol="IQ", category="Security",
            description="Verify security headers present in HTTP responses",
            expected_result="X-Content-Type-Options, X-Frame-Options, HSTS headers",
        ),
        TestCase(
            id="IQ-031", protocol="IQ", category="Security",
            description="Verify rate limiting configured",
            expected_result="429 returned after exceeding rate limit",
        ),
        TestCase(
            id="IQ-032", protocol="IQ", category="Security",
            description="Verify password policy enforced",
            expected_result="Passwords < 12 chars rejected",
        ),
    ]

    protocol.test_cases = test_cases
    return protocol


# ═══════════════════════════════════════════════════════════════════════
# OQ — Operational Qualification
# ═══════════════════════════════════════════════════════════════════════

def create_oq_protocol(system_name: str, version: str) -> ValidationProtocol:
    """
    Create an Operational Qualification protocol.
    Verifies that the system functions correctly under normal operating conditions.
    """
    protocol = ValidationProtocol(
        id=f"OQ-{system_name}-{version}",
        protocol_type="OQ",
        system_name=system_name,
        version=version,
        scope="Verify all system functions operate per specification",
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    test_cases = [
        # ── Authentication ─────────────────────────────────────────────
        TestCase(
            id="OQ-001", protocol="OQ", category="Authentication",
            description="User can register with valid credentials",
            expected_result="User created, confirmation returned",
        ),
        TestCase(
            id="OQ-002", protocol="OQ", category="Authentication",
            description="User can login with correct credentials",
            expected_result="JWT access token returned",
        ),
        TestCase(
            id="OQ-003", protocol="OQ", category="Authentication",
            description="Login fails with wrong password",
            expected_result="401 Unauthorized returned",
        ),
        TestCase(
            id="OQ-004", protocol="OQ", category="Authentication",
            description="Account locks after 5 failed attempts",
            expected_result="Account locked for 30 minutes",
        ),
        TestCase(
            id="OQ-005", protocol="OQ", category="Authentication",
            description="Expired token is rejected",
            expected_result="401 with 'Invalid token' message",
        ),

        # ── Stability Simulation ───────────────────────────────────────
        TestCase(
            id="OQ-010", protocol="OQ", category="Stability Simulation",
            description="Single-condition simulation returns valid results",
            expected_result="Shelf life, time points, regression stats returned",
        ),
        TestCase(
            id="OQ-011", protocol="OQ", category="Stability Simulation",
            description="ICH protocol simulation returns all conditions",
            expected_result="Long-term, accelerated, intermediate conditions returned",
        ),
        TestCase(
            id="OQ-012", protocol="OQ", category="Stability Simulation",
            description="Accelerated condition gives shorter shelf life than long-term",
            expected_result="shelf_life(accelerated) < shelf_life(long_term)",
        ),
        TestCase(
            id="OQ-013", protocol="OQ", category="Stability Simulation",
            description="Monte Carlo returns confidence intervals",
            expected_result="CI lower < mean < CI upper",
        ),
        TestCase(
            id="OQ-014", protocol="OQ", category="Stability Simulation",
            description="Molecular risk assessment detects functional groups",
            expected_result="Ester detected for Aspirin SMILES",
        ),
        TestCase(
            id="OQ-015", protocol="OQ", category="Stability Simulation",
            description="Arrhenius extrapolation from accelerated to storage",
            expected_result="Extrapolated shelf life > accelerated shelf life",
        ),
        TestCase(
            id="OQ-016", protocol="OQ", category="Stability Simulation",
            description="Ea derivation from two temperatures",
            expected_result="Derived Ea matches input Ea within 1%",
        ),

        # ── Study Management ───────────────────────────────────────────
        TestCase(
            id="OQ-020", protocol="OQ", category="Study Management",
            description="Create stability study with auto-simulation",
            expected_result="Study created with study_code, simulation results attached",
        ),
        TestCase(
            id="OQ-021", protocol="OQ", category="Study Management",
            description="Add time point to study",
            expected_result="Time point recorded, OOS auto-detected if below spec",
        ),
        TestCase(
            id="OQ-022", protocol="OQ", category="Study Management",
            description="Study status workflow: draft -> in_progress -> completed -> approved",
            expected_result="Status transitions succeed in correct order",
        ),
        TestCase(
            id="OQ-023", protocol="OQ", category="Study Management",
            description="Invalid status transition is rejected",
            expected_result="400 returned for invalid transition (e.g., draft to approved)",
        ),
        TestCase(
            id="OQ-024", protocol="OQ", category="Study Management",
            description="Electronic signature on approved study",
            expected_result="Signature hash computed and stored",
        ),

        # ── Audit Trail ────────────────────────────────────────────────
        TestCase(
            id="OQ-030", protocol="OQ", category="Audit Trail",
            description="Audit log records all CREATE operations",
            expected_result="INSERT triggers create audit_log entry",
        ),
        TestCase(
            id="OQ-031", protocol="OQ", category="Audit Trail",
            description="Audit log records all UPDATE operations",
            expected_result="UPDATE triggers create audit_log entry with old/new values",
        ),
        TestCase(
            id="OQ-032", protocol="OQ", category="Audit Trail",
            description="Audit trail hash chain is verifiable",
            expected_result="verify_audit_chain returns valid=True",
        ),
        TestCase(
            id="OQ-033", protocol="OQ", category="Audit Trail",
            description="Audit log is immutable (no UPDATE/DELETE allowed)",
            expected_result="Direct UPDATE/DELETE on audit_log is denied by RLS",
        ),

        # ── RBAC ───────────────────────────────────────────────────────
        TestCase(
            id="OQ-040", protocol="OQ", category="RBAC",
            description="Viewer cannot create studies",
            expected_result="403 Forbidden returned",
        ),
        TestCase(
            id="OQ-041", protocol="OQ", category="RBAC",
            description="Analyst can create and run simulations",
            expected_result="Study created, simulation executed",
        ),
        TestCase(
            id="OQ-042", protocol="OQ", category="RBAC",
            description="Only org_admin can approve studies",
            expected_result="Non-admin gets 403, admin succeeds",
        ),

        # ── ICH Conditions ─────────────────────────────────────────────
        TestCase(
            id="OQ-050", protocol="OQ", category="ICH Reference",
            description="ICH conditions endpoint returns all zones",
            expected_result="5 zones + accelerated + intermediate + stress returned",
        ),
        TestCase(
            id="OQ-051", protocol="OQ", category="ICH Reference",
            description="Zone II long-term is 25°C/60% RH",
            expected_result="temperature=25, humidity=60 for long_term_II",
        ),
    ]

    protocol.test_cases = test_cases
    return protocol


# ═══════════════════════════════════════════════════════════════════════
# PQ — Performance Qualification
# ═══════════════════════════════════════════════════════════════════════

def create_pq_protocol(system_name: str, version: str) -> ValidationProtocol:
    """
    Create a Performance Qualification protocol.
    Verifies system performs correctly under load and stress conditions.
    """
    protocol = ValidationProtocol(
        id=f"PQ-{system_name}-{version}",
        protocol_type="PQ",
        system_name=system_name,
        version=version,
        scope="Verify system performance under load, stress, and real-world conditions",
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    test_cases = [
        # ── Load Testing ───────────────────────────────────────────────
        TestCase(
            id="PQ-001", protocol="PQ", category="Load",
            description="API responds within 2 seconds for single simulation",
            expected_result="Response time < 2000ms",
        ),
        TestCase(
            id="PQ-002", protocol="PQ", category="Load",
            description="API handles 10 concurrent simulation requests",
            expected_result="All 10 requests complete successfully within 10s",
        ),
        TestCase(
            id="PQ-003", protocol="PQ", category="Load",
            description="API handles 50 concurrent read requests",
            expected_result="All 50 requests complete within 5s, no 500 errors",
        ),
        TestCase(
            id="PQ-004", protocol="PQ", category="Load",
            description="Monte Carlo with 10,000 simulations completes within 30s",
            expected_result="Response within 30 seconds",
        ),

        # ── Stress Testing ─────────────────────────────────────────────
        TestCase(
            id="PQ-010", protocol="PQ", category="Stress",
            description="Rate limiter blocks excessive requests (429)",
            expected_result="429 returned after exceeding RPM limit",
        ),
        TestCase(
            id="PQ-011", protocol="PQ", category="Stress",
            description="System recovers after rate limit period",
            expected_result="Requests succeed after waiting 60s",
        ),
        TestCase(
            id="PQ-012", protocol="PQ", category="Stress",
            description="Database connection pool handles concurrent requests",
            expected_result="No connection pool exhaustion errors",
        ),

        # ── Data Integrity ─────────────────────────────────────────────
        TestCase(
            id="PQ-020", protocol="PQ", category="Data Integrity",
            description="Simulation results are deterministic (same input -> same output)",
            expected_result="Two identical requests return identical results",
        ),
        TestCase(
            id="PQ-021", protocol="PQ", category="Data Integrity",
            description="Time points are ordered chronologically",
            expected_result="time_days in ascending order",
        ),
        TestCase(
            id="PQ-022", protocol="PQ", category="Data Integrity",
            description="Shelf life is between adjacent time points",
            expected_result="t90 is between the two time points that bracket 90%",
        ),

        # ── Accuracy ───────────────────────────────────────────────────
        TestCase(
            id="PQ-030", protocol="PQ", category="Accuracy",
            description="First-order half-life matches ln(2)/k",
            expected_result="t½ within 0.1% of theoretical value",
        ),
        TestCase(
            id="PQ-031", protocol="PQ", category="Accuracy",
            description="Q10 factor matches Arrhenius-based calculation",
            expected_result="Q10 within 0.01 of exp(10*Ea/(R*T*(T+10)))",
        ),
        TestCase(
            id="PQ-032", protocol="PQ", category="Accuracy",
            description="Arrhenius extrapolation matches direct calculation",
            expected_result="Extrapolated k within 0.001% of direct Arrhenius",
        ),
        TestCase(
            id="PQ-033", protocol="PQ", category="Accuracy",
            description="Regression R² matches manual calculation",
            expected_result="R² within 0.0001 of manual computation",
        ),

        # ── Endurance ──────────────────────────────────────────────────
        TestCase(
            id="PQ-040", protocol="PQ", category="Endurance",
            description="System runs continuously for 24 hours without degradation",
            expected_result="No memory leaks, response time stable",
        ),
        TestCase(
            id="PQ-041", protocol="PQ", category="Endurance",
            description="Audit trail integrity after 1000 operations",
            expected_result="Hash chain verification passes",
        ),
    ]

    protocol.test_cases = test_cases
    return protocol


# ═══════════════════════════════════════════════════════════════════════
# Traceability Matrix
# ═══════════════════════════════════════════════════════════════════════

def generate_traceability_matrix() -> List[Dict[str, str]]:
    """
    Generate Requirements Traceability Matrix (RTM).
    Maps user requirements -> functional specifications -> test cases.
    """
    return [
        # ── Authentication Requirements ────────────────────────────────
        {
            "req_id": "UR-001",
            "requirement": "Users must authenticate with email/password",
            "specification": "JWT-based authentication with bcrypt password hashing",
            "test_iq": "IQ-030, IQ-031, IQ-032",
            "test_oq": "OQ-001, OQ-002, OQ-003, OQ-004, OQ-005",
            "test_pq": "PQ-010",
            "regulatory": "21 CFR Part 11 §11.10",
        },
        {
            "req_id": "UR-002",
            "requirement": "Role-based access control (5 levels)",
            "specification": "RBAC with viewer/analyst/PM/org_admin/super_admin",
            "test_iq": "",
            "test_oq": "OQ-040, OQ-041, OQ-042",
            "test_pq": "",
            "regulatory": "21 CFR Part 11 §11.10(d)",
        },

        # ── Stability Study Requirements ───────────────────────────────
        {
            "req_id": "UR-010",
            "requirement": "ICH Q1A-Q1F compliant stability simulation",
            "specification": "Arrhenius kinetics with 5 climate zones",
            "test_iq": "",
            "test_oq": "OQ-010, OQ-011, OQ-012, OQ-015, OQ-016",
            "test_pq": "PQ-030, PQ-031, PQ-032, PQ-033",
            "regulatory": "ICH Q1A(R2)",
        },
        {
            "req_id": "UR-011",
            "requirement": "Shelf life prediction with confidence intervals",
            "specification": "Monte Carlo uncertainty propagation",
            "test_iq": "",
            "test_oq": "OQ-013",
            "test_pq": "PQ-004",
            "regulatory": "ICH Q1E",
        },
        {
            "req_id": "UR-012",
            "requirement": "Molecular degradation risk assessment",
            "specification": "SMARTS pattern matching for functional groups",
            "test_iq": "",
            "test_oq": "OQ-014",
            "test_pq": "",
            "regulatory": "ICH Q1A(R2) §2.5",
        },

        # ── Data Integrity Requirements ────────────────────────────────
        {
            "req_id": "UR-020",
            "requirement": "Immutable audit trail with hash chain",
            "specification": "SHA-256 chained hashing, append-only log",
            "test_iq": "IQ-015",
            "test_oq": "OQ-030, OQ-031, OQ-032, OQ-033",
            "test_pq": "PQ-041",
            "regulatory": "21 CFR Part 11 §11.10(e), ALCOA+",
        },
        {
            "req_id": "UR-021",
            "requirement": "Electronic signatures",
            "specification": "SHA-256 signature with meaning, timestamp, user ID",
            "test_iq": "",
            "test_oq": "OQ-024",
            "test_pq": "",
            "regulatory": "21 CFR Part 11 §11.50, §11.70",
        },
        {
            "req_id": "UR-022",
            "requirement": "OOS (Out of Specification) auto-detection",
            "specification": "Database trigger compares assay to spec_lower",
            "test_iq": "",
            "test_oq": "OQ-021",
            "test_pq": "PQ-020, PQ-021",
            "regulatory": "ICH Q1E",
        },

        # ── Performance Requirements ───────────────────────────────────
        {
            "req_id": "UR-030",
            "requirement": "API response time < 2s for single simulation",
            "specification": "Arrhenius computation optimized",
            "test_iq": "",
            "test_oq": "",
            "test_pq": "PQ-001",
            "regulatory": "GAMP 5",
        },
        {
            "req_id": "UR-031",
            "requirement": "Handle 10 concurrent simulation requests",
            "specification": "FastAPI async, connection pooling",
            "test_iq": "",
            "test_oq": "",
            "test_pq": "PQ-002, PQ-003",
            "regulatory": "GAMP 5",
        },

        # ── Security Requirements ──────────────────────────────────────
        {
            "req_id": "UR-040",
            "requirement": "Production-grade secret key",
            "specification": "32+ character key, validated on startup",
            "test_iq": "IQ-020",
            "test_oq": "",
            "test_pq": "",
            "regulatory": "21 CFR Part 11 §11.10(a)",
        },
        {
            "req_id": "UR-041",
            "requirement": "Rate limiting per IP",
            "specification": "Sliding window, 60 RPM default",
            "test_iq": "IQ-031",
            "test_oq": "",
            "test_pq": "PQ-010, PQ-011",
            "regulatory": "OWASP",
        },
    ]


# ═══════════════════════════════════════════════════════════════════════
# Validation Summary Report
# ═══════════════════════════════════════════════════════════════════════

def generate_validation_summary(
    system_name: str,
    version: str,
    iq: ValidationProtocol,
    oq: ValidationProtocol,
    pq: ValidationProtocol,
) -> Dict[str, Any]:
    """Generate the final Validation Summary Report."""

    def count_status(protocol: ValidationProtocol) -> Dict[str, int]:
        counts = {}
        for tc in protocol.test_cases:
            counts[tc.status.value] = counts.get(tc.status.value, 0) + 1
        return counts

    iq_counts = count_status(iq)
    oq_counts = count_status(oq)
    pq_counts = count_status(pq)

    total_tests = len(iq.test_cases) + len(oq.test_cases) + len(pq.test_cases)
    total_passed = iq_counts.get("passed", 0) + oq_counts.get("passed", 0) + pq_counts.get("passed", 0)
    total_failed = iq_counts.get("failed", 0) + oq_counts.get("failed", 0) + pq_counts.get("failed", 0)

    all_passed = total_failed == 0
    validation_status = "QUALIFIED" if all_passed else "NOT_QUALIFIED"

    return {
        "header": {
            "system_name": system_name,
            "version": version,
            "report_date": datetime.now(timezone.utc).isoformat(),
            "validation_status": validation_status,
        },
        "summary": {
            "total_test_cases": total_tests,
            "passed": total_passed,
            "failed": total_failed,
            "not_run": total_tests - total_passed - total_failed,
            "pass_rate": f"{(total_passed / total_tests * 100):.1f}%" if total_tests > 0 else "N/A",
        },
        "protocols": {
            "IQ": {
                "status": iq.status,
                "test_counts": iq_counts,
                "deviations": len(iq.deviations),
            },
            "OQ": {
                "status": oq.status,
                "test_counts": oq_counts,
                "deviations": len(oq.deviations),
            },
            "PQ": {
                "status": pq.status,
                "test_counts": pq_counts,
                "deviations": len(pq.deviations),
            },
        },
        "traceability_matrix": generate_traceability_matrix(),
        "conclusion": (
            f"ChemStab Industrial v{version} has been validated through IQ, OQ, and PQ protocols. "
            f"{total_passed}/{total_tests} tests passed. "
            f"System is {'QUALIFIED' if all_passed else 'NOT QUALIFIED — deviations must be resolved'} "
            f"for GxP use."
        ),
    }
