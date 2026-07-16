"""
ChemStab Industrial — Database engine with multi-tenant support.
PostgreSQL with connection pooling, row-level security ready.
"""

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
from typing import Generator
import logging
import secrets

from app.core.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=settings.DB_POOL_RECYCLE,
    pool_pre_ping=True,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yield a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """Context manager for non-FastAPI usage (scripts, tasks)."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def set_tenant_context(db: Session, org_id: int, user_id: int):
    """
    Set PostgreSQL session variables for RLS and audit.

    FIX #3: Use parameterized queries instead of f-string interpolation.
    Previously: db.execute(text(f"SET app.current_org_id = '{org_id}'"))
    This was vulnerable to SQL injection if org_id or user_id were ever
    non-integer (e.g., from a compromised upstream).
    """
    db.execute(text("SET app.current_org_id = :org_id"), {"org_id": str(org_id)})
    db.execute(text("SET app.current_user_id = :user_id"), {"user_id": str(user_id)})


def init_db():
    """Create all tables and seed default data."""
    from app.models import user, organization, project, molecule, audit  # noqa
    Base.metadata.create_all(bind=engine)

    # Seed default super-admin org + user
    db = SessionLocal()
    try:
        from app.models.user import User
        from app.models.organization import Organization
        from app.core.security import get_password_hash

        existing_org = db.query(Organization).filter(Organization.slug == "system").first()
        if not existing_org:
            org = Organization(
                name="System Administration",
                slug="system",
                license_type="enterprise",
                max_users=999,
                max_projects=999,
                is_active=True,
            )
            db.add(org)
            db.flush()

            # FIX #4: Generate a random admin password instead of hardcoding it.
            # The password is logged ONCE at startup — the operator must save it
            # and change it immediately via /api/v1/auth/change-password.
            admin_password = secret…_urlsafe(16) + "!A1"
            admin = User(
                org_id=org.id,
                username="admin",
                email="admin@chemstab.local",
                hashed_password=get_password_hash(admin_password),
                full_name="System Administrator",
                role="super_admin",
                is_active=True,
                must_change_password=True,  # Force password change on first login
            )
            db.add(admin)
            db.commit()
            logger.warning(
                "=" * 60 + "\n"
                "🔑 DEFAULT ADMIN CREATED — SAVE THIS PASSWORD NOW!\n"
                f"   Username: admin\n"
                f"   Password: {admin_password}\n"
                "   ⚠️  Change this password immediately after first login!\n"
                "   Endpoint: POST /api/v1/auth/change-password\n" +
                "=" * 60
            )
    except Exception as e:
        db.rollback()
        logger.warning(f"Seed skipped: {e}")
    finally:
        db.close()
