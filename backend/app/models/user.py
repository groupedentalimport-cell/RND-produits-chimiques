"""
User model — Multi-tenant with RBAC, GxP-compliant login tracking.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)

    # Identity
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200))
    title = Column(String(100))  # Job title (e.g., "Senior Chemist")
    department = Column(String(100))

    # RBAC
    role = Column(String(50), default="analyst")  # viewer, analyst, project_manager, org_admin, super_admin
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)

    # GxP: Login tracking
    last_login_at = Column(DateTime(timezone=True))
    last_login_ip = Column(String(45))
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True))
    password_changed_at = Column(DateTime(timezone=True), server_default=func.now())
    must_change_password = Column(Boolean, default=False)

    # GxP: Electronic signature consent
    signature_consent_at = Column(DateTime(timezone=True))
    signature_consent_ip = Column(String(45))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    organization = relationship("Organization", back_populates="users")
    projects = relationship("Project", back_populates="owner", lazy="dynamic")
    audit_events = relationship("AuditEvent", back_populates="user", lazy="dynamic")

    @property
    def is_locked(self) -> bool:
        if self.locked_until is None:
            return False
        from datetime import datetime
        return datetime.utcnow() < self.locked_until

    @property
    def is_superuser(self) -> bool:
        return self.role == "super_admin"
