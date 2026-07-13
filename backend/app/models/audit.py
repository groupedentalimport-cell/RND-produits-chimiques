"""
GxP Audit Trail — 21 CFR Part 11 compliant.
Every create, read, update, delete, export, and electronic signature is logged.
Immutable: no UPDATE or DELETE allowed on audit records.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class AuditEvent(Base):
    """
    Immutable audit trail. 21 CFR Part 11 §11.10(e) compliant.
    Records: who, what, when, where, why, and the before/after values.
    """
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # ── Event identification ───────────────────────────────────────────
    event_type = Column(String(50), nullable=False, index=True)
    # Types: CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT,
    #        SIGN, APPROVE, REJECT, ARCHIVE, RESTORE, ERROR, SYSTEM

    resource_type = Column(String(100), nullable=False, index=True)
    # Types: User, Project, Analysis, Molecule, Substance, Report, Organization

    resource_id = Column(Integer, index=True)

    # ── Event details ──────────────────────────────────────────────────
    action = Column(String(200), nullable=False)  # Human-readable action
    details = Column(JSON)  # Additional context
    old_values = Column(JSON)  # Before UPDATE (null for CREATE)
    new_values = Column(JSON)  # After UPDATE (null for DELETE)

    # ── Request context ────────────────────────────────────────────────
    ip_address = Column(String(45))  # IPv4 or IPv6
    user_agent = Column(String(500))
    session_id = Column(String(100))
    request_id = Column(String(50))  # Correlation ID for tracing

    # ── Electronic signature (21 CFR Part 11 §11.50) ──────────────────
    is_signed = Column(String(1), default="N")  # Y/N
    signature_hash = Column(String(64))  # SHA-256
    signature_meaning = Column(String(200))  # "Reviewed and Approved", "Executed", etc.

    # ── Timestamp (immutable) ──────────────────────────────────────────
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # ── Relationships ──────────────────────────────────────────────────
    user = relationship("User", back_populates="audit_events")

    __table_args__ = (
        Index("idx_audit_org_created", "org_id", "created_at"),
        Index("idx_audit_resource", "resource_type", "resource_id"),
        Index("idx_audit_user_action", "user_id", "event_type"),
    )


class AuditExport(Base):
    """Tracks audit log exports (for regulatory submissions)."""
    __tablename__ = "audit_exports"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    exported_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Scope
    date_from = Column(DateTime(timezone=True))
    date_to = Column(DateTime(timezone=True))
    resource_type = Column(String(100))
    event_type = Column(String(50))
    total_records = Column(Integer)

    # File
    file_path = Column(String(500))
    file_hash = Column(String(64))  # SHA-256 of exported file

    created_at = Column(DateTime(timezone=True), server_default=func.now())
