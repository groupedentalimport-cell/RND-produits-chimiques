"""
Security Hardening — ChemStab Industrial v5.3

Improvements:
  1. SECRET_KEY validation (no defaults in production)
  2. Structured JSON logging (ELK/Splunk compatible)
  3. Security headers middleware
  4. Request ID tracking
  5. Input sanitization helpers
  6. Circuit breaker for external services
"""

import hashlib
import logging
import json
import time
import uuid
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from functools import wraps
from contextvars import ContextVar

# ── Context variable for request ID ───────────────────────────────────

request_id_var: ContextVar[str] = ContextVar("request_id", default="")


# ═══════════════════════════════════════════════════════════════════════
# 1. Structured JSON Logging
# ═══════════════════════════════════════════════════════════════════════

class JSONFormatter(logging.Formatter):
    """
    Structured JSON log formatter for ELK/Splunk/Grafana Loki.
    Each log line is a valid JSON object.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "request_id": request_id_var.get(""),
        }

        # Add exception info if present
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = {
                "type": type(record.exc_info[1]).__name__,
                "message": str(record.exc_info[1]),
            }

        # Add extra fields
        for key in ("user_id", "action", "resource", "duration_ms", "status_code", "ip"):
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)

        return json.dumps(log_entry, default=str)


def setup_structured_logging(level: str = "INFO", json_format: bool = True):
    """
    Configure application-wide structured logging.
    In production, use json_format=True for log aggregation.
    In development, use json_format=False for readable output.
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers
    root_logger.handlers.clear()

    handler = logging.StreamHandler()
    if json_format:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        ))

    root_logger.addHandler(handler)

    # Suppress noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    return root_logger


# ═══════════════════════════════════════════════════════════════════════
# 2. Security Headers Middleware
# ═══════════════════════════════════════════════════════════════════════

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


# ═══════════════════════════════════════════════════════════════════════
# 3. Circuit Breaker for External Services
# ═══════════════════════════════════════════════════════════════════════

class CircuitBreaker:
    """
    Simple circuit breaker pattern for external API calls.
    States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)
    """

    def __init__(
        self,
        service_name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
    ):
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self.logger = logging.getLogger(f"circuit_breaker.{service_name}")

    def can_execute(self) -> bool:
        """Check if the circuit allows execution."""
        if self.state == "CLOSED":
            return True
        if self.state == "OPEN":
            if self.last_failure_time and (time.time() - self.last_failure_time) > self.recovery_timeout:
                self.state = "HALF_OPEN"
                self.logger.info(f"Circuit {self.service_name} → HALF_OPEN (testing)")
                return True
            return False
        if self.state == "HALF_OPEN":
            return True
        return False

    def record_success(self):
        """Record a successful call."""
        if self.state == "HALF_OPEN":
            self.logger.info(f"Circuit {self.service_name} → CLOSED (recovered)")
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self):
        """Record a failed call."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            self.logger.warning(
                f"Circuit {self.service_name} → OPEN "
                f"(failures={self.failure_count}, timeout={self.recovery_timeout}s)"
            )


# Global circuit breakers for external services
circuit_breakers: Dict[str, CircuitBreaker] = {}


def get_circuit_breaker(service_name: str) -> CircuitBreaker:
    """Get or create a circuit breaker for a service."""
    if service_name not in circuit_breakers:
        circuit_breakers[service_name] = CircuitBreaker(service_name)
    return circuit_breakers[service_name]


# ═══════════════════════════════════════════════════════════════════════
# 4. Input Sanitization
# ═══════════════════════════════════════════════════════════════════════

def sanitize_smiles(smiles: str) -> str:
    """
    Basic SMILES sanitization.
    Removes potentially dangerous characters while preserving valid SMILES.
    """
    if not smiles:
        return ""
    # Allow only valid SMILES characters
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789()=-#@+[]/\\.:")
    sanitized = "".join(c for c in smiles if c in allowed)
    if len(sanitized) > 10000:
        raise ValueError("SMILES string too long (max 10000 characters)")
    return sanitized


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal."""
    import os
    # Remove path components
    filename = os.path.basename(filename)
    # Remove null bytes
    filename = filename.replace("\x00", "")
    # Allow only safe characters
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-")
    sanitized = "".join(c for c in filename if c in allowed)
    return sanitized[:255]  # Max filename length


# ═══════════════════════════════════════════════════════════════════════
# 5. Hash Chain for Audit Trail
# ═══════════════════════════════════════════════════════════════════════

def compute_audit_hash(
    previous_hash: str,
    action: str,
    table_name: str,
    record_id: str,
    user_id: str,
    timestamp: str,
    data: str,
) -> str:
    """
    Compute SHA-256 hash for audit trail chain.
    Each entry includes the previous hash → tamper-evident chain.
    """
    payload = f"{previous_hash}|{action}|{table_name}|{record_id}|{user_id}|{timestamp}|{data}"
    return hashlib.sha256(payload.encode()).hexdigest()


# ═══════════════════════════════════════════════════════════════════════
# 6. SECRET_KEY Validation
# ═══════════════════════════════════════════════════════════════════════

DEFAULT_SECRET_KEYS = {
    "CHANGE-ME-in-production-use-openssl-rand-hex-32",
    "secret",
    "password",
    "changeme",
    "default",
    "test",
    "dev",
}


def validate_secret_key(secret_key: str, is_production: bool = True) -> None:
    """
    Validate that SECRET_KEY is not a default/weak value.
    Raises ValueError in production if key is weak.
    """
    if not secret_key or len(secret_key) < 32:
        if is_production:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters. "
                "Generate with: openssl rand -hex 32"
            )

    if secret_key.lower() in DEFAULT_SECRET_KEYS or secret_key in DEFAULT_SECRET_KEYS:
        if is_production:
            raise ValueError(
                "SECRET_KEY is set to a default value. "
                "Generate a secure key with: openssl rand -hex 32"
            )


# ═══════════════════════════════════════════════════════════════════════
# 7. Request ID Middleware Helper
# ═══════════════════════════════════════════════════════════════════════

def generate_request_id() -> str:
    """Generate a unique request ID for tracing."""
    return str(uuid.uuid4())


# ═══════════════════════════════════════════════════════════════════════
# 8. Rate Limiting (Redis-backed, production-ready)
# ═══════════════════════════════════════════════════════════════════════

class RedisRateLimiter:
    """
    Redis-backed rate limiter using sliding window.
    Replaces in-memory rate limiter for production.
    """

    def __init__(self, redis_url: str, requests_per_minute: int = 60):
        self.redis_url = redis_url
        self.rpm = requests_per_minute
        self._redis = None

    def _get_redis(self):
        if self._redis is None:
            try:
                import redis
                self._redis = redis.from_url(self.redis_url, decode_responses=True)
            except ImportError:
                logging.getLogger(__name__).warning("redis not installed, rate limiting disabled")
                return None
        return self._redis

    def is_allowed(self, client_ip: str) -> bool:
        """Check if request is allowed using sliding window."""
        r = self._get_redis()
        if r is None:
            return True  # Fail open if Redis unavailable

        key = f"rate_limit:{client_ip}"
        now = time.time()
        window_start = now - 60

        pipe = r.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, 60)
        results = pipe.execute()

        current_count = results[2]
        return current_count <= self.rpm


# ═══════════════════════════════════════════════════════════════════════
# Export
# ═══════════════════════════════════════════════════════════════════════

__all__ = [
    "JSONFormatter",
    "setup_structured_logging",
    "SECURITY_HEADERS",
    "CircuitBreaker",
    "get_circuit_breaker",
    "sanitize_smiles",
    "sanitize_filename",
    "compute_audit_hash",
    "validate_secret_key",
    "generate_request_id",
    "request_id_var",
    "RedisRateLimiter",
]
