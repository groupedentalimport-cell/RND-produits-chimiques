"""
Tests for Phase 2 compliance modules:
  - GxP Audit Trail (hash chain, electronic signatures)
  - FMEA Risk Assessment (ICH Q9)
  - Model Validation (ICH Q2)

Run: cd backend && python -m pytest tests/test_compliance.py -v
"""

import pytest
import sys
import os
import hashlib

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.fmea_engine import (
    create_stability_fmea,
    create_system_validation_fmea,
    generate_fmea_report,
    RiskLevel,
    RiskStatus,
    FailureMode,
    FMEAStudy,
)

from app.services.model_validation import (
    compute_regression_metrics,
    check_applicability_domain,
    compute_prediction_confidence,
    generate_validation_report,
    ValidationMetrics,
)

from app.services.gxp_audit_trail import (
    compute_entry_hash,
    hash_data,
)


# ═══════════════════════════════════════════════════════════════════════
# FMEA Engine Tests
# ═══════════════════════════════════════════════════════════════════════

class TestFMEAEngine:

    def test_create_stability_fmea(self):
        """Stability FMEA should pre-populate failure modes."""
        fmea = create_stability_fmea("STB-001", "Aspirin", 25.0, 60.0)
        assert fmea.study_type == "stability"
        assert len(fmea.failure_modes) > 0
        assert "Aspirin" in fmea.scope

    def test_create_system_validation_fmea(self):
        """System validation FMEA should have IT-related failure modes."""
        fmea = create_system_validation_fmea("ChemStab")
        assert fmea.study_type == "system"
        assert len(fmea.failure_modes) > 0
        components = [fm.component for fm in fmea.failure_modes]
        assert "Authentication" in components
        assert "Audit Trail" in components

    def test_rpn_computation(self):
        """RPN should be S × O × D."""
        fm = FailureMode(
            id="TEST-001",
            component="Test",
            failure_mode="Test failure",
            effect="Test effect",
            cause="Test cause",
            severity=8, occurrence=4, detection=3,
        )
        fm.compute_rpn()
        assert fm.rpn == 8 * 4 * 3  # 96

    def test_risk_level_classification(self):
        """RPN should map to correct risk level."""
        test_cases = [
            (10, RiskLevel.LOW),      # RPN = 10
            (50, RiskLevel.LOW),      # RPN = 50
            (51, RiskLevel.MEDIUM),   # RPN = 51
            (100, RiskLevel.MEDIUM),  # RPN = 100
            (101, RiskLevel.HIGH),    # RPN = 101
            (200, RiskLevel.HIGH),    # RPN = 200
            (201, RiskLevel.CRITICAL), # RPN = 201
        ]
        for target_rpn, expected_level in test_cases:
            fm = FailureMode(
                id="T", component="C", failure_mode="F",
                effect="E", cause="Ca",
                severity=target_rpn, occurrence=1, detection=1,
            )
            fm.compute_rpn()
            assert fm.risk_level == expected_level, (
                f"RPN={target_rpn} should be {expected_level}, got {fm.risk_level}"
            )

    def test_fmea_summary(self):
        """Summary should count risk levels correctly."""
        fmea = FMEAStudy(
            id="TEST", title="Test", scope="Test",
            study_type="test", team=["QA"],
        )
        # Add failure modes with known RPNs
        for s, o, d in [(10, 1, 1), (5, 5, 3), (8, 8, 8)]:
            fm = FailureMode(
                id="T", component="C", failure_mode="F",
                effect="E", cause="Ca", severity=s, occurrence=o, detection=d,
            )
            fm.compute_rpn()
            fmea.failure_modes.append(fm)

        summary = fmea.summary()
        assert summary["total_failure_modes"] == 3
        assert summary["max_rpn"] == 8 * 8 * 8  # 512
        assert summary["critical_count"] == 1     # RPN=512

    def test_fmea_report_generation(self):
        """Report should be JSON-serializable."""
        fmea = create_stability_fmea("STB-001", "Aspirin", 25.0, 60.0)
        report = generate_fmea_report(fmea)

        assert "header" in report
        assert "summary" in report
        assert "failure_modes" in report
        assert "conclusion" in report
        assert report["header"]["study_type"] == "stability"


# ═══════════════════════════════════════════════════════════════════════
# Model Validation Tests
# ═══════════════════════════════════════════════════════════════════════

class TestModelValidation:

    def test_regression_metrics_perfect(self):
        """Perfect predictions should give R²=1, RMSE=0."""
        y_true = [1.0, 2.0, 3.0, 4.0, 5.0]
        y_pred = [1.0, 2.0, 3.0, 4.0, 5.0]
        metrics = compute_regression_metrics(y_true, y_pred)

        assert metrics.r_squared == pytest.approx(1.0, abs=1e-4)
        assert metrics.rmse == pytest.approx(0.0, abs=1e-4)
        assert metrics.mae == pytest.approx(0.0, abs=1e-4)

    def test_regression_metrics_imperfect(self):
        """Imperfect predictions should give R² < 1."""
        y_true = [1.0, 2.0, 3.0, 4.0, 5.0]
        y_pred = [1.1, 2.2, 2.8, 4.1, 4.9]
        metrics = compute_regression_metrics(y_true, y_pred)

        assert 0.9 < metrics.r_squared < 1.0
        assert metrics.rmse > 0
        assert metrics.mae > 0

    def test_regression_metrics_bias(self):
        """Systematically high predictions should show positive bias."""
        y_true = [1.0, 2.0, 3.0]
        y_pred = [2.0, 3.0, 4.0]  # All +1 too high
        metrics = compute_regression_metrics(y_true, y_pred)

        assert metrics.mean_error > 0  # Positive bias

    def test_applicability_domain_inside(self):
        """Point inside training range should be in AD."""
        training = [
            {"x1": 1.0, "x2": 10.0},
            {"x1": 5.0, "x2": 50.0},
            {"x1": 3.0, "x2": 30.0},
        ]
        prediction = {"x1": 3.0, "x2": 25.0}

        ad = check_applicability_domain(prediction, training, method="range")
        assert ad.is_inside is True

    def test_applicability_domain_outside(self):
        """Point outside training range should be outside AD."""
        training = [
            {"x1": 1.0, "x2": 10.0},
            {"x1": 5.0, "x2": 50.0},
        ]
        prediction = {"x1": 10.0, "x2": 100.0}  # Way outside

        ad = check_applicability_domain(prediction, training, method="range")
        assert ad.is_inside is False
        assert ad.warning is not None

    def test_confidence_score_high(self):
        """High R², inside AD, many samples → high confidence."""
        conf = compute_prediction_confidence(
            model_r_squared=0.95,
            is_in_ad=True,
            distance_from_ad_center=0.0,
            training_samples=500,
        )
        assert conf > 0.8

    def test_confidence_score_low(self):
        """Low R², outside AD → low confidence."""
        conf = compute_prediction_confidence(
            model_r_squared=0.5,
            is_in_ad=False,
            distance_from_ad_center=2.0,
            training_samples=20,
        )
        assert conf < 0.5

    def test_validation_report_generation(self):
        """Report should contain all required sections."""
        y_true = [1.0, 2.0, 3.0, 4.0, 5.0] * 20
        y_pred = [v + 0.1 for v in y_true]

        report = generate_validation_report(
            model_name="QSPR-Solubility",
            model_version="1.0",
            model_type="gradient_boosting",
            property_predicted="aqueous_solubility",
            training_dataset="ESOL",
            training_source="MoleculeNet",
            y_true=y_true,
            y_pred=y_pred,
            n_features=200,
        )

        assert "model" in report
        assert "training_metrics" in report
        assert "quality_assessment" in report
        assert report["training_metrics"]["r_squared"] > 0.9
        assert report["quality_assessment"]["status"] in [
            "QUALIFIED", "CONDITIONALLY_QUALIFIED", "NOT_QUALIFIED"
        ]


# ═══════════════════════════════════════════════════════════════════════
# Audit Trail Tests
# ═══════════════════════════════════════════════════════════════════════

class TestAuditTrail:

    def test_hash_data_deterministic(self):
        """Same data should always produce same hash."""
        data = {"key": "value", "number": 42}
        h1 = hash_data(data)
        h2 = hash_data(data)
        assert h1 == h2
        assert len(h1) == 64  # SHA-256 hex

    def test_hash_data_different(self):
        """Different data should produce different hashes."""
        h1 = hash_data({"key": "value1"})
        h2 = hash_data({"key": "value2"})
        assert h1 != h2

    def test_entry_hash_chain(self):
        """Each entry hash should depend on the previous."""
        hash1 = compute_entry_hash("0" * 64, "CREATE", "studies", "1", "user1", "t1", "d1")
        hash2 = compute_entry_hash(hash1, "UPDATE", "studies", "1", "user1", "t2", "d2")
        hash3 = compute_entry_hash(hash2, "SIGN", "studies", "1", "user1", "t3", "d3")

        assert hash1 != hash2 != hash3
        assert len(hash1) == 64

    def test_chain_tamper_detection(self):
        """Modifying an entry should break the chain."""
        # Original chain
        h0 = "0" * 64
        h1 = compute_entry_hash(h0, "CREATE", "studies", "1", "user1", "t1", "d1")
        h2 = compute_entry_hash(h1, "UPDATE", "studies", "1", "user1", "t2", "d2")

        # Tampered chain (different action at step 1)
        h1_tampered = compute_entry_hash(h0, "DELETE", "studies", "1", "user1", "t1", "d1")
        h2_tampered = compute_entry_hash(h1_tampered, "UPDATE", "studies", "1", "user1", "t2", "d2")

        # Original h2 should NOT match tampered h2
        assert h2 != h2_tampered


# ═══════════════════════════════════════════════════════════════════════
# Edge Cases
# ═══════════════════════════════════════════════════════════════════════

class TestComplianceEdgeCases:

    def test_fmea_post_mitigation_rpn(self):
        """Post-mitigation RPN should be lower than pre-mitigation."""
        fm = FailureMode(
            id="FM-001", component="Test", failure_mode="Test",
            effect="E", cause="C",
            severity=8, occurrence=6, detection=7,
        )
        fm.compute_rpn()
        pre_rpn = fm.rpn  # 336

        # Apply mitigation
        fm.severity_post = 8      # Same severity
        fm.occurrence_post = 3    # Reduced occurrence
        fm.detection_post = 2     # Improved detection
        fm.compute_post_rpn()

        assert fm.rpn_post < pre_rpn
        assert fm.rpn_post == 8 * 3 * 2  # 48

    def test_empty_arrays_metrics(self):
        """Empty arrays should raise error."""
        with pytest.raises(ValueError):
            compute_regression_metrics([], [])

    def test_mismatched_arrays_metrics(self):
        """Mismatched arrays should raise error."""
        with pytest.raises(ValueError):
            compute_regression_metrics([1, 2], [1])
