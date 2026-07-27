"""
ChemStab Industrial — Security module.
JWT auth, password hashing, RBAC, electronic signatures (21 CFR Part 11).
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import secrets
import hashlib

from app.core.config import settings
from app.core.database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security_scheme = HTTPBearer()

# Role hierarchy
ROLE_HIERARCHY = {
    "viewer": 0,
    "analyst": 1,
    "project_manager": 2,
    "org_admin": 3,
    "super_admin": 4,
}

ROLE_PERMISSIONS = {
    "viewer": ["read:own_projects", "read:molecules", "read:reports"],
    "analyst": ["read:own_projects", "write:own_projects", "read:molecules", "write:molecules",
                "read:reports", "write:reports", "execute:analysis", "execute:predictions"],
    "project_manager": ["read:org_projects", "write:own_projects", "read:molecules", "write:molecules",
                        "read:reports", "write:reports", "execute:analysis", "execute:predictions",
                        "manage:projects", "approve:reports"],
    "org_admin": ["read:org_projects", "write:org_projects", "read:molecules", "write:molecules",
                  "read:reports", "write:reports", "execute:analysis", "execute:predictions",
                  "manage:projects", "approve:reports", "manage:users", "manage:org_settings",
                  "read:audit_log"],
    "super_admin": ["*"],  # All permissions
}


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def validate_password_strength(password: str) -> tuple[bool, str]:
    """Enforce password policy for GxP compliance."""
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in password):
        return False, "Password must contain at least one special character"
    return True, "OK"


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: Dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh", "jti": secrets.token_hex(16)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def has_permission(user_role: str, permission: str) -> bool:
    """Check if a role has a specific permission."""
    perms = ROLE_PERMISSIONS.get(user_role, [])
    if "*" in perms:
        return True
    return permission in perms


def require_permission(permission: str):
    """Dependency factory: require a specific permission."""
    def _check(current_user=Depends(get_current_user)):
        if not has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: requires '{permission}'",
            )
        return current_user
    return _check


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
):
    """FastAPI dependency: extract and validate current user from JWT."""
    from app.models.user import User

    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")
    if user.is_locked:
        raise HTTPException(status_code=403, detail="Account locked due to failed login attempts")

    return user


def get_current_active_user(current_user=Depends(get_current_user)):
    """Require active user."""
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return current_user


def compute_electronic_signature(data: str, user_id: int, meaning: str = "Approved") -> Dict[str, str]:
    """
    Compute electronic signature per 21 CFR Part 11.
    Returns signature hash and metadata.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    payload = f"{data}|{user_id}|{meaning}|{timestamp}"
    sig_hash = hashlib.sha256(payload.encode()).hexdigest()
    return {
        "signature_hash": sig_hash,
        "signed_by": str(user_id),
        "meaning": meaning,
        "timestamp": timestamp,
        "algorithm": "SHA-256",
    }
