"""
Tests for security hardening module.

Run: cd backend && python -m pytest tests/test_security.py -v
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.security_hardening import (
    validate_secret_key,
    sanitize_smiles,
    sanitize_filename,
    compute_audit_hash,
    CircuitBreaker,
    generate_request_id,
    JSONFormatter,
)


class TestSecretKeyValidation:

    def test_valid_key_passes(self):
        """A strong key should pass validation."""
        validate_secret_key("a" * 64, is_production=True)  # Should not raise

    def test_short_key_fails_in_production(self):
        """A short key should fail in production."""
        with pytest.raises(ValueError, match="at least 32 characters"):
            validate_secret_key("short", is_production=True)

    def test_default_key_fails_in_production(self):
        """Default key should fail in production."""
        with pytest.raises(ValueError, match="default value"):
            validate_secret_key("CHANGE-ME-in-production-use-openssl-rand-hex-32", is_production=True)

    def test_short_key_ok_in_dev(self):
        """A short key should be allowed in development."""
        validate_secret_key("dev", is_production=False)  # Should not raise


class TestSanitization:

    def test_sanitize_smiles_valid(self):
        """Valid SMILES should pass through."""
        result = sanitize_smiles("CC(=O)Oc1ccccc1C(=O)O")
        assert result == "CC(=O)Oc1ccccc1C(=O)O"

    def test_sanitize_smiles_removes_dangerous(self):
        """Shell injection attempts should be removed."""
        result = sanitize_smiles("CC;rm -rf /")
        assert ";" not in result
        assert "rm" not in result  # letters are allowed but ; is removed

    def test_sanitize_smiles_too_long(self):
        """Very long SMILES should be rejected."""
        with pytest.raises(ValueError, match="too long"):
            sanitize_smiles("C" * 10001)

    def test_sanitize_filename_path_traversal(self):
        """Path traversal should be removed."""
        result = sanitize_filename("../../etc/passwd")
        assert "/" not in result
        assert ".." not in result

    def test_sanitize_filename_null_bytes(self):
        """Null bytes should be removed."""
        result = sanitize_filename("test\x00.txt")
        assert "\x00" not in result


class TestAuditHash:

    def test_hash_chain(self):
        """Hash chain should produce different hashes for different data."""
        hash1 = compute_audit_hash("0" * 64, "CREATE", "studies", "1", "user1", "2025-01-01T00:00:00", "{}")
        hash2 = compute_audit_hash(hash1, "UPDATE", "studies", "1", "user1", "2025-01-01T00:01:00", '{"status":"approved"}')
        assert hash1 != hash2
        assert len(hash1) == 64  # SHA-256 hex
        assert len(hash2) == 64

    def test_tamper_detection(self):
        """Changing any field should produce a different hash."""
        hash_original = compute_audit_hash("0", "CREATE", "studies", "1", "user1", "t1", "{}")
        hash_tampered = compute_audit_hash("0", "DELETE", "studies", "1", "user1", "t1", "{}")
        assert hash_original != hash_tampered


class TestCircuitBreaker:

    def test_initial_state_closed(self):
        """Circuit breaker should start in CLOSED state."""
        cb = CircuitBreaker("test_service")
        assert cb.state == "CLOSED"
        assert cb.can_execute() is True

    def test_opens_after_threshold(self):
        """Circuit should OPEN after failure_threshold failures."""
        cb = CircuitBreaker("test", failure_threshold=3)
        for _ in range(3):
            cb.record_failure()
        assert cb.state == "OPEN"
        assert cb.can_execute() is False

    def test_recovers_after_timeout(self):
        """Circuit should move to HALF_OPEN after recovery_timeout."""
        cb = CircuitBreaker("test", failure_threshold=2, recovery_timeout=0)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "OPEN"
        # With recovery_timeout=0, should immediately allow
        assert cb.can_execute() is True
        assert cb.state == "HALF_OPEN"

    def test_success_resets(self):
        """Success should reset failure count."""
        cb = CircuitBreaker("test", failure_threshold=5)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        assert cb.failure_count == 0
        assert cb.state == "CLOSED"


class TestRequestId:

    def test_generate_request_id(self):
        """Request ID should be a valid UUID."""
        rid = generate_request_id()
        assert len(rid) == 36  # UUID format
        assert rid.count("-") == 4


class TestJSONFormatter:

    def test_format_produces_json(self):
        """JSONFormatter should produce valid JSON."""
        import logging
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="test.py",
            lineno=1, msg="Test message", args=(), exc_info=None,
        )
        output = formatter.format(record)
        import json
        parsed = json.loads(output)
        assert parsed["message"] == "Test message"
        assert parsed["level"] == "INFO"
        assert "timestamp" in parsed
