"""
ChemStab Industrial — Configuration
Multi-tenant, GxP-compliant chemical stability platform.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os
import json


class Settings(BaseSettings):
    APP_NAME: str = "ChemStab Industrial"
    APP_VERSION: str = "5.2.0"
    APP_CODENAME: str = "StabilityLab Industrial"
    DEBUG: bool = False

    # ── Database ───────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://chemstab:chemstab@localhost:5432/chemstab_industrial"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 3600

    # ── Redis / Celery ─────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ── Security ───────────────────────────────────────────────────────
    SECRET_KEY: str = "CHANGE-ME-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8h for GxP sessions
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 30
    PASSWORD_MIN_LENGTH: int = 12
    REQUIRE_MFA: bool = False

    # ── Rate limiting (per-IP, in-memory) ─────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_BURST: int = 10

    # ── Experimental data sources ─────────────────────────────────────
    ENABLE_EXPERIMENTAL_ENRICHMENT: bool = True
    BENCHMARK_DATA_CACHE_DIR: str = "./data_cache/benchmarks"
    NIST_REFERENCE_DB: str = "./data_cache/nist_reference.json"

    # ── CORS ───────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = '["http://localhost:3000","http://localhost:5173"]'

    # ── File storage ───────────────────────────────────────────────────
    UPLOAD_DIR: str = "./uploads"
    EXPORT_DIR: str = "./exports"
    MAX_UPLOAD_SIZE_MB: int = 50

    # ── ChEMBL / PubChem ──────────────────────────────────────────────
    CHEMBL_API_BASE: str = "https://www.ebi.ac.uk/chembl/api/data"
    PUBCHEM_API_BASE: str = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
    CHEMBL_CACHE_TTL_HOURS: int = 72
    MOLECULE_FETCH_BATCH_SIZE: int = 100

    # ── ML Models ─────────────────────────────────────────────────────
    ML_MODELS_DIR: str = "./ml_models"
    QSPR_MODEL_PATH: str = "./ml_models/qspr_stability.joblib"
    DESCRIPTOR_SCALER_PATH: str = "./ml_models/descriptor_scaler.joblib"
    ML_CONFIDENCE_THRESHOLD: float = 0.6

    # ── GxP / Audit ───────────────────────────────────────────────────
    AUDIT_RETENTION_DAYS: int = 2555  # ~7 years (ICH requirement)
    AUDIT_LOG_TO_DB: bool = True
    ENABLE_ELECTRONIC_SIGNATURES: bool = True
    SIGNATURE_MEANING: str = "Reviewed and Approved"

    # ── Report ────────────────────────────────────────────────────────
    REPORT_TEMPLATE_DIR: str = "./templates/reports"
    REPORT_COMPANY_NAME: str = "ChemStab Industrial"
    REPORT_LOGO_PATH: Optional[str] = None

    # ── Rate limiting ─────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_BURST: int = 10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def allowed_origins_list(self) -> List[str]:
        try:
            return json.loads(self.ALLOWED_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return ["http://localhost:3000", "http://localhost:5173"]

    @property
    def is_production(self) -> bool:
        return not self.DEBUG


settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.EXPORT_DIR, exist_ok=True)
os.makedirs(settings.ML_MODELS_DIR, exist_ok=True)
os.makedirs(settings.BENCHMARK_DATA_CACHE_DIR, exist_ok=True)


# ── Production safety: warn if SECRET_KEY is default ──────────────────
def _check_secret_key():
    if settings.SECRET_KEY == "CHANGE-ME-in-production-use-openssl-rand-hex-32":
        import sys
        if not settings.DEBUG:
            print(
                "\n" + "=" * 70 +
                "\n⚠️  WARNING: SECRET_KEY is set to the default value!\n"
                "   Generate a secure key with: openssl rand -hex 32\n"
                "   Set it via SECRET_KEY environment variable or .env file\n" +
                "=" * 70 + "\n",
                file=sys.stderr,
            )

_check_secret_key()
