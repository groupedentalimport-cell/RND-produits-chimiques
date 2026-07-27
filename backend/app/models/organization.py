"""
Organization model — Multi-tenant root entity.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text)

    # License / limits
    license_type = Column(String(50), default="starter")  # starter, professional, enterprise
    max_users = Column(Integer, default=10)
    max_projects = Column(Integer, default=50)
    max_molecules = Column(Integer, default=10000)

    # Contact
    contact_email = Column(String(200))
    contact_phone = Column(String(50))
    address = Column(Text)

    # GxP
    glp_certified = Column(Boolean, default=False)
    gmp_certified = Column(Boolean, default=False)
    iso_17025 = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    users = relationship("User", back_populates="organization", lazy="dynamic")
    projects = relationship("Project", back_populates="organization", lazy="dynamic")
