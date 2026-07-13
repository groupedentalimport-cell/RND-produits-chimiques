"""
Authentication API — JWT auth with GxP login tracking.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    verify_password, get_password_hash, validate_password_strength,
    create_access_token, create_refresh_token, decode_token,
    get_current_user,
)
from app.models.user import User
from app.models.organization import Organization
from app.services.gxp_audit import log_event

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None
    org_slug: Optional[str] = None  # If None, create new org


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Login with GxP-compliant tracking."""
    user = db.query(User).filter(User.username == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        # Track failed attempt
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                user.locked_until = datetime.utcnow() + timedelta(minutes=settings.LOCKOUT_MINUTES)
            db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    if user.is_locked:
        raise HTTPException(status_code=403, detail="Account locked")

    # Update login tracking
    user.last_login_at = datetime.utcnow()
    user.last_login_ip = request.client.host if request.client else "unknown"
    user.failed_login_attempts = 0
    db.commit()

    # Create tokens
    access_token = create_access_token({"sub": str(user.id), "org": user.org_id, "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    # Audit
    log_event(
        db=db, user_id=user.id, org_id=user.org_id,
        event_type="LOGIN", resource_type="User", resource_id=user.id,
        action="User logged in",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/register")
def register(
    reg: RegisterRequest,
    db: Session = Depends(get_db),
):
    """Register a new user and organization."""
    # Validate password
    valid, msg = validate_password_strength(reg.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    # Check username/email uniqueness
    if db.query(User).filter(User.username == reg.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")
    if db.query(User).filter(User.email == reg.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Get or create organization
    if reg.org_slug:
        org = db.query(Organization).filter(Organization.slug == reg.org_slug).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
    else:
        org = Organization(
            name=f"{reg.username}'s Organization",
            slug=reg.username.lower().replace(" ", "-"),
            license_type="starter",
        )
        db.add(org)
        db.flush()

    # Create user
    user = User(
        org_id=org.id,
        username=reg.username,
        email=reg.email,
        hashed_password=get_password_hash(reg.password),
        full_name=reg.full_name,
        role="org_admin" if not reg.org_slug else "analyst",
        is_active=True,
    )
    db.add(user)
    db.commit()

    return {"status": "registered", "user_id": user.id, "org_slug": org.slug}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db),
):
    """Refresh access token using refresh token."""
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    access_token = create_access_token({"sub": str(user.id), "org": user.org_id, "role": user.role})
    new_refresh = create_refresh_token({"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/change-password")
def change_password(
    req: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change password (requires current password)."""
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password incorrect")

    valid, msg = validate_password_strength(req.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    current_user.hashed_password = get_password_hash(req.new_password)
    current_user.password_changed_at = datetime.utcnow()
    current_user.must_change_password = False

    log_event(
        db=db, user_id=current_user.id, org_id=current_user.org_id,
        event_type="UPDATE", resource_type="User", resource_id=current_user.id,
        action="Password changed",
    )
    db.commit()

    return {"status": "password_changed"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "org_id": current_user.org_id,
        "is_active": current_user.is_active,
        "last_login_at": current_user.last_login_at,
    }
