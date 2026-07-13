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
    """Set PostgreSQL session variables for RLS and audit."""
    db.execute(text(f"SET app.current_org_id = '{org_id}'"))
    db.execute(text(f"SET app.current_user_id = '{user_id}'"))


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

            admin = User(
                org_id=org.id,
                username="admin",
                email="admin@chemstab.local",
                hashed_password=get_password_hash("Admin@ChemStab1!"),
                full_name="System Administrator",
                role="super_admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            logger.info("Seeded default admin user (admin / Admin@ChemStab1!)")
    except Exception as e:
        db.rollback()
        logger.warning(f"Seed skipped: {e}")
    finally:
        db.close()
