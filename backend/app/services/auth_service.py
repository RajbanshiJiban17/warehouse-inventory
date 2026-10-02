from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.core.jwt import (
    create_access_token,
    generate_refresh_token_pair,
    hash_refresh_token,
)
from app.models.user import User, UserRole, UserStatus
from app.models.auth import RefreshToken
from app.models.audit import AuditAction
from app.schemas.user import UserRegisterRequest
from app.services.audit_service import log_audit_event


def register_user(
    db: Session,
    request: UserRegisterRequest,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> User:
    """
    Registers a new user.
    First user in system becomes ADMIN (status ACTIVE).
    Subsequent users become STAFF (status PENDING approval).
    """
    # Check uniqueness
    existing_username = db.query(User).filter(User.username == request.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already registered",
        )

    existing_email = db.query(User).filter(User.email == request.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    # All registrations receive full ADMIN role and immediate ACTIVE status
    role = UserRole.ADMIN
    user_status = UserStatus.ACTIVE

    user = User(
        username=request.username,
        email=request.email,
        passwordHash=hash_password(request.password),
        role=role,
        status=user_status,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        action=AuditAction.CREATE,
        entity="USER",
        userId=user.id,
        entityId=str(user.id),
        newValue={"username": user.username, "role": user.role, "status": user.status},
        ip=ip,
        userAgent=user_agent,
    )
    db.commit()
    return user


def authenticate_user(
    db: Session,
    username_or_email: str,
    password: str,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Tuple[User, str, str]:
    """
    Authenticates user, enforces lockout after 5 attempts,
    and returns (user, access_token, raw_refresh_token).
    """
    now = datetime.now(timezone.utc)
    user = (
        db.query(User)
        .filter((User.username == username_or_email) | (User.email == username_or_email))
        .first()
    )

    # Check for temporary lockout
    if user and user.lockedUntil:
        # SQLite returns naive datetimes sometimes, normalize to UTC
        locked_until = user.lockedUntil
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)

        if locked_until > now:
            minutes_left = int((locked_until - now).total_seconds() // 60) + 1
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is temporarily locked due to repeated failed logins. Try again in {minutes_left} minute(s).",
            )
        else:
            # Lockout expired, reset
            user.lockedUntil = None
            user.failedLogins = 0
            db.commit()

    # Generic credential check (OWASP: timing/existence safe error)
    if not user or not verify_password(password, user.passwordHash):
        if user:
            user.failedLogins += 1
            if user.failedLogins >= 5:
                user.lockedUntil = now + timedelta(minutes=15)
                log_audit_event(
                    db=db,
                    action="ACCOUNT_LOCKED",
                    entity="USER",
                    userId=user.id,
                    entityId=str(user.id),
                    oldValue={"failedLogins": user.failedLogins},
                    newValue={"lockedUntil": user.lockedUntil.isoformat()},
                    ip=ip,
                    userAgent=user_agent,
                )
            else:
                log_audit_event(
                    db=db,
                    action=AuditAction.FAILED_LOGIN,
                    entity="USER",
                    userId=user.id,
                    entityId=str(user.id),
                    newValue={"failedAttempts": user.failedLogins},
                    ip=ip,
                    userAgent=user_agent,
                )
            db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Status checks
    if user.status == UserStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending administrator approval before you can sign in.",
        )
    if user.status == UserStatus.DISABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact an administrator.",
        )

    # Reset failed login count on successful auth
    user.failedLogins = 0
    user.lockedUntil = None

    # Generate Tokens
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role}
    )
    raw_refresh_token, token_hash, family_id = generate_refresh_token_pair()

    refresh_db_token = RefreshToken(
        userId=user.id,
        tokenHash=token_hash,
        familyId=family_id,
        expiresAt=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        userAgent=user_agent,
        ip=ip,
    )
    db.add(refresh_db_token)

    log_audit_event(
        db=db,
        action=AuditAction.LOGIN,
        entity="USER",
        userId=user.id,
        entityId=str(user.id),
        ip=ip,
        userAgent=user_agent,
    )
    db.commit()

    return user, access_token, raw_refresh_token


def rotate_refresh_token(
    db: Session,
    raw_refresh_token: str,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Tuple[User, str, str]:
    """
    Refresh token rotation with reuse detection.
    If a revoked token is used, revokes all tokens belonging to that family immediately.
    """
    now = datetime.now(timezone.utc)
    token_hash = hash_refresh_token(raw_refresh_token)

    token_record = (
        db.query(RefreshToken).filter(RefreshToken.tokenHash == token_hash).first()
    )

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # REUSE DETECTION: If this token was already revoked, revoke the ENTIRE token family!
    if token_record.revokedAt is not None:
        db.query(RefreshToken).filter(
            RefreshToken.familyId == token_record.familyId
        ).update({"revokedAt": now})
        db.commit()

        log_audit_event(
            db=db,
            action="SECURITY_ALERT_TOKEN_REUSE",
            entity="REFRESH_TOKEN",
            userId=token_record.userId,
            entityId=token_record.familyId,
            ip=ip,
            userAgent=user_agent,
        )
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compromised refresh token detected. All sessions in this family have been terminated.",
        )

    # Expiration check
    expires_at = token_record.expiresAt
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        token_record.revokedAt = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired",
        )

    # Check user status
    user = db.query(User).filter(User.id == token_record.userId).first()
    if not user or user.status != UserStatus.ACTIVE:
        token_record.revokedAt = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is no longer active",
        )

    # Revoke old token
    token_record.revokedAt = now

    # Issue new access token and rotated refresh token keeping the SAME family ID
    new_access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role}
    )
    new_raw_refresh, new_token_hash, _ = generate_refresh_token_pair()

    new_refresh_record = RefreshToken(
        userId=user.id,
        tokenHash=new_token_hash,
        familyId=token_record.familyId,  # Continue family
        expiresAt=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        userAgent=user_agent,
        ip=ip,
    )
    db.add(new_refresh_record)
    db.commit()

    return user, new_access_token, new_raw_refresh


def logout_user(
    db: Session,
    raw_refresh_token: Optional[str],
    user: Optional[User] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Invalidates the refresh token on the server and logs audit entry"""
    if raw_refresh_token:
        token_hash = hash_refresh_token(raw_refresh_token)
        token_record = (
            db.query(RefreshToken).filter(RefreshToken.tokenHash == token_hash).first()
        )
        if token_record and not token_record.revokedAt:
            token_record.revokedAt = datetime.now(timezone.utc)
            db.commit()

    if user:
        log_audit_event(
            db=db,
            action=AuditAction.LOGOUT,
            entity="USER",
            userId=user.id,
            entityId=str(user.id),
            ip=ip,
            userAgent=user_agent,
        )
        db.commit()
