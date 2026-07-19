"""
ChemStab Industrial v5.3 — FastAPI Application
Professional chemical stability assessment with QSPR/ML, multi-tenant, GxP audit.
Now with real experimental data from ChEMBL, PubChem, NIST, and MoleculeNet benchmarks.
NEW in v5.3: ICH Q1A-Q1F stability simulation module (time-dependent molecular degradation).
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
import time
import asyncio
from collections import defaultdict

from app.core.config import settings
from app.core.database import init_db
from app.core.metrics import metrics, metrics_endpoint

# API routers
from app.api.auth import router as auth_router
from app.api.analysis import router as analysis_router
from app.api.molecules import router as molecules_router
from app.api.reports import router as reports_router
from app.api.admin import router as admin_router
from app.api.experimental import router as experimental_router
from app.api.predictions import router as predictions_router
from app.api.advanced import router as advanced_router
from app.api.regulatory import router as regulatory_router
from app.api.stability_study import router as stability_study_router  # 🆕 v5.3

logger = logging.getLogger(__name__)


# ── Rate Limiter (Redis-backed with in-memory fallback) ──────────────

class RateLimiter:
    """
    Rate limiter using Redis for distributed counting.
    Falls back to in-memory if Redis is unavailable.
    """

    def __init__(self, requests_per_minute: int = 60, burst: int = 10):
        self.rpm = requests_per_minute
        self.burst = burst
        self.requests: dict[str, list[float]] = defaultdict(list)
        self._cleanup_interval = 60
        self._last_cleanup = time.time()
        self._redis = None
        self._try_connect_redis()

    def _try_connect_redis(self):
        """Try to connect to Redis for distributed rate limiting."""
        try:
            import redis
            self._redis = redis.from_url(settings.REDIS_URL, socket_timeout=2)
            self._redis.ping()
            logger.info("Rate limiter using Redis backend")
        except Exception:
            self._redis = None
            logger.info("Rate limiter using in-memory backend (Redis unavailable)")

    def is_allowed(self, client_ip: str) -> bool:
        if self._redis:
            return self._is_allowed_redis(client_ip)
        return self._is_allowed_memory(client_ip)

    def _is_allowed_redis(self, client_ip: str) -> bool:
        """Redis-based sliding window rate limiting."""
        try:
            key = f"rate_limit:{client_ip}"
            now = time.time()
            pipe = self._redis.pipeline()
            # Remove old entries
            pipe.zremrangebyscore(key, 0, now - 60)
            # Count current entries
            pipe.zcard(key)
            # Add current request
            pipe.zadd(key, {str(now): now})
            # Set expiry
            pipe.expire(key, 60)
            results = pipe.execute()
            count = results[1]
            return count < self.rpm
        except Exception:
            return self._is_allowed_memory(client_ip)

    def _is_allowed_memory(self, client_ip: str) -> bool:
        """In-memory sliding window rate limiting (fallback)."""
        now = time.time()
        if now - self._last_cleanup > self._cleanup_interval:
            self._cleanup(now)
            self._last_cleanup = now
        recent = [t for t in self.requests[client_ip] if now - t < 10]
        if len(recent) >= self.burst:
            return False
        window = [t for t in self.requests[client_ip] if now - t < 60]
        if len(window) >= self.rpm:
            return False
        self.requests[client_ip].append(now)
        return True

    def _cleanup(self, now: float):
        """Remove stale entries."""
        stale_ips = [
            ip for ip, times in self.requests.items()
            if not any(now - t < 120 for t in times)
        ]
        for ip in stale_ips:
            del self.requests[ip]


rate_limiter = RateLimiter(
    requests_per_minute=settings.RATE_LIMIT_PER_MINUTE,
    burst=settings.RATE_LIMIT_BURST,
)


# ── Lifespan ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    init_db()

    # Try to load QSPR models
    try:
        from app.ml.qspr_engine import qspr_pipeline
        if qspr_pipeline.load():
            logger.info("QSPR models loaded successfully")
        else:
            logger.info("No QSPR models found — train via /api/v1/admin/train-qspr")
    except Exception as e:
        logger.warning(f"QSPR model load skipped: {e}")

    yield
    logger.info("Shutting down")


# ── App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Industrial-grade chemical stability assessment platform. "
        "QSPR predictions with real experimental data from ChEMBL, PubChem, NIST, "
        "and MoleculeNet benchmarks. Multi-tenant, GxP audit trail, ICH/FDA/EMA reports. "
        "ICH Q1A-Q1F stability simulation with time-dependent molecular degradation."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


# ── Rate limiting middleware ──────────────────────────────────────────

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Apply rate limiting per client IP."""
    client_ip = request.client.host if request.client else "unknown"

    # Skip rate limiting for health checks
    if request.url.path in ("/health", "/version", "/"):
        return await call_next(request)

    if not rate_limiter.is_allowed(client_ip):
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Rate limit exceeded. Please wait before retrying.",
                "retry_after_seconds": 60,
            },
            headers={"Retry-After": "60"},
        )

    return await call_next(request)


# ── Request timing middleware ─────────────────────────────────────────

@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    response.headers["X-Response-Time"] = f"{elapsed:.3f}s"
    metrics.record_request(request.method, request.url.path, response.status_code, elapsed)
    return response


# ── Global exception handler ─────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )


# ── Register routers ──────────────────────────────────────────────────

app.include_router(auth_router, prefix="/api/v1")
app.include_router(analysis_router, prefix="/api/v1")
app.include_router(molecules_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(experimental_router, prefix="/api/v1")
app.include_router(predictions_router, prefix="/api/v1")
app.include_router(advanced_router, prefix="/api/v1")
app.include_router(regulatory_router, prefix="/api/v1")
app.include_router(stability_study_router, prefix="/api/v1")  # 🆕 v5.3


# ── Root endpoints ────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "codename": settings.APP_CODENAME,
        "docs": "/docs",
        "status": "running",
        "features": [
            "QSPR molecular property prediction (trained on real experimental data)",
            "Multi-tenant with RBAC",
            "GxP audit trail (21 CFR Part 11)",
            "ICH/FDA/EMA regulatory reports",
            "ChEMBL/PubChem/NIST integration",
            "Kinetic degradation modeling",
            "MoleculeNet benchmark datasets (ESOL, FreeSolv, Lipophilicity)",
            "200+ SMARTS patterns for instability detection",
            "Thermodynamic computation (NIST, CoolProp, Joback)",
            "Morgan fingerprints + Tanimoto similarity",
            "Ersilia Hub integration (200+ QSPR models)",
            "Cross-validated QSPR with R²/RMSE reporting",
            "DFT quantum chemistry (Psi4/ORCA/Gaussian)",
            "Molecular dynamics (OpenMM/GROMACS)",
            "Cloud HPC orchestration (AWS/GCP/Azure)",
            "ChemBERTa transformer embeddings",
            "LLM-based literature mining for stability data",
            "ICH Q1A-Q1F climate zone stability protocols",
            "ICH Q8 Design of Experiments (DoE)",
            "ICH Q9 Quality Risk Management (FMEA)",
            "ICH M7 mutagenic impurity assessment (14 SMARTS alerts)",
            "21 CFR Part 11 electronic signatures & audit trail",
            "CTD Module 3.2.P.8 regulatory reports",
            "IQ/OQ/PQ validation protocols",
            "ICH Q1A-Q1F stability simulation (time-dependent degradation)",  # 🆕 v5.3
            "Monte Carlo uncertainty propagation for shelf-life prediction",  # 🆕 v5.3
            "Molecular structure-based degradation risk assessment (SMARTS)",  # 🆕 v5.3
        ],
    }


@app.get("/metrics")
def prometheus_metrics():
    """Prometheus metrics endpoint."""
    return metrics_endpoint()


@app.get("/health")
def health():
    return {"status": "healthy", "version": settings.APP_VERSION}


@app.get("/version")
def version():
    return {
        "version": settings.APP_VERSION,
        "codename": settings.APP_CODENAME,
        "features": {
            "qspr_ml": True,
            "multi_tenant": True,
            "gxp_audit": True,
            "regulatory_reports": True,
            "chembl_integration": True,
            "pubchem_integration": True,
            "nist_webbook": True,
            "benchmark_datasets": True,
            "experimental_data_enrichment": True,
            "stability_simulation": True,  # 🆕 v5.3
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
