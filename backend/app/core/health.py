"""
Production Health Check — Deep system status for monitoring.

Provides:
  - /health/live  — Liveness probe (is the process alive?)
  - /health/ready — Readiness probe (can it serve traffic?)
  - /health/deep  — Deep check (DB, Redis, disk, memory, external services)
"""

import time
import logging
import psutil
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class HealthStatus:
    """Health check result."""
    service: str
    status: str  # "healthy", "degraded", "unhealthy"
    latency_ms: float
    details: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


def check_database(db_session_factory) -> HealthStatus:
    """Check PostgreSQL/Supabase connectivity."""
    start = time.time()
    try:
        session = db_session_factory()
        session.execute("SELECT 1")
        session.close()
        latency = (time.time() - start) * 1000
        return HealthStatus(
            service="database",
            status="healthy",
            latency_ms=round(latency, 2),
            details={"type": "PostgreSQL/Supabase"},
        )
    except Exception as e:
        latency = (time.time() - start) * 1000
        return HealthStatus(
            service="database",
            status="unhealthy",
            latency_ms=round(latency, 2),
            error=str(e),
        )


def check_redis(redis_url: Optional[str]) -> HealthStatus:
    """Check Redis connectivity."""
    if not redis_url:
        return HealthStatus(service="redis", status="healthy", latency_ms=0,
                          details={"note": "Redis not configured"})

    start = time.time()
    try:
        import redis
        r = redis.from_url(redis_url, socket_timeout=2)
        r.ping()
        latency = (time.time() - start) * 1000
        info = r.info("memory")
        return HealthStatus(
            service="redis",
            status="healthy",
            latency_ms=round(latency, 2),
            details={"used_memory_mb": round(info.get("used_memory", 0) / 1024 / 1024, 1)},
        )
    except Exception as e:
        latency = (time.time() - start) * 1000
        return HealthStatus(
            service="redis",
            status="unhealthy",
            latency_ms=round(latency, 2),
            error=str(e),
        )


def check_disk(threshold_percent: float = 90.0) -> HealthStatus:
    """Check disk usage."""
    try:
        usage = psutil.disk_usage("/")
        status = "healthy" if usage.percent < threshold_percent else "degraded"
        if usage.percent > 95:
            status = "unhealthy"
        return HealthStatus(
            service="disk",
            status=status,
            latency_ms=0,
            details={
                "total_gb": round(usage.total / (1024**3), 1),
                "used_gb": round(usage.used / (1024**3), 1),
                "free_gb": round(usage.free / (1024**3), 1),
                "percent": usage.percent,
            },
        )
    except Exception as e:
        return HealthStatus(service="disk", status="unknown", latency_ms=0, error=str(e))


def check_memory(threshold_percent: float = 85.0) -> HealthStatus:
    """Check memory usage."""
    try:
        mem = psutil.virtual_memory()
        status = "healthy" if mem.percent < threshold_percent else "degraded"
        if mem.percent > 95:
            status = "unhealthy"
        return HealthStatus(
            service="memory",
            status=status,
            latency_ms=0,
            details={
                "total_gb": round(mem.total / (1024**3), 1),
                "available_gb": round(mem.available / (1024**3), 1),
                "percent": mem.percent,
            },
        )
    except Exception as e:
        return HealthStatus(service="memory", status="unknown", latency_ms=0, error=str(e))


def check_external_services() -> Dict[str, HealthStatus]:
    """Check external service connectivity."""
    import urllib.request

    services = {
        "chembl": "https://www.ebi.ac.uk/chembl/api/data/status.json",
        "pubchem": "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/cids/JSON",
    }

    results = {}
    for name, url in services.items():
        start = time.time()
        try:
            req = urllib.request.Request(url, method="GET")
            req.add_header("User-Agent", "ChemStab-HealthCheck/1.0")
            with urllib.request.urlopen(req, timeout=5) as resp:
                latency = (time.time() - start) * 1000
                results[name] = HealthStatus(
                    service=name,
                    status="healthy" if resp.status == 200 else "degraded",
                    latency_ms=round(latency, 2),
                    details={"status_code": resp.status},
                )
        except Exception as e:
            latency = (time.time() - start) * 1000
            results[name] = HealthStatus(
                service=name,
                status="degraded",
                latency_ms=round(latency, 2),
                error=str(e),
            )

    return results


def full_health_check(
    db_session_factory=None,
    redis_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Comprehensive health check.
    Returns overall status and individual service checks.
    """
    checks = {}
    overall = "healthy"

    # Database
    if db_session_factory:
        db_check = check_database(db_session_factory)
        checks["database"] = db_check.__dict__
        if db_check.status == "unhealthy":
            overall = "unhealthy"

    # Redis
    redis_check = check_redis(redis_url)
    checks["redis"] = redis_check.__dict__
    if redis_check.status == "unhealthy":
        overall = "degraded"  # Redis failure is not critical

    # System resources
    disk_check = check_disk()
    checks["disk"] = disk_check.__dict__
    if disk_check.status == "unhealthy":
        overall = "unhealthy"
    elif disk_check.status == "degraded" and overall == "healthy":
        overall = "degraded"

    memory_check = check_memory()
    checks["memory"] = memory_check.__dict__
    if memory_check.status == "unhealthy":
        overall = "unhealthy"
    elif memory_check.status == "degraded" and overall == "healthy":
        overall = "degraded"

    # Process info
    try:
        proc = psutil.Process()
        checks["process"] = {
            "pid": proc.pid,
            "uptime_seconds": round(time.time() - proc.create_time()),
            "cpu_percent": proc.cpu_percent(interval=0.1),
            "memory_mb": round(proc.memory_info().rss / 1024 / 1024, 1),
            "threads": proc.num_threads(),
        }
    except Exception:
        pass

    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }
