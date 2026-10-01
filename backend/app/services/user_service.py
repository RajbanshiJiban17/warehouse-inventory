from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User, UserRole, UserStatus
from app.models.audit import AuditAction
from app.schemas.user import UserCreateAdminRequest
from app.services.audit_service import log_audit_event


def list_users(
    db: Session,
    role: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[List[User], int]:
    query = db.query(User)

    if role:
        query = query.filter(User.role == role)
    if status_filter:
        query = query.filter(User.status == status_filter)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (User.username.ilike(search_fmt)) | (User.email.ilike(search_fmt))
        )

    total = query.count()
    users = query.order_by(User.id.desc()).offset(offset).limit(limit).all()
    return users, total


def create_user_by_admin(
    db: Session,
    admin_id: int,
    request: UserCreateAdminRequest,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> User:
    if db.query(User).filter(User.username == request.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    new_user = User(
        username=request.username,
        email=request.email,
        passwordHash=hash_password(request.password),
        role=request.role,
        status=request.status,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit_event(
        db=db,
        action=AuditAction.CREATE,
        entity="USER",
        userId=admin_id,
        entityId=str(new_user.id),
        newValue={"username": new_user.username, "role": new_user.role, "status": new_user.status},
        ip=ip,
        userAgent=user_agent,
    )
    db.commit()
    return new_user


def approve_user(
    db: Session,
    admin_id: int,
    target_user_id: int,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> User:
    user = db.query(User).filter(User.id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    old_status = user.status
    user.status = UserStatus.ACTIVE
    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        action=AuditAction.APPROVE,
        entity="USER",
        userId=admin_id,
        entityId=str(user.id),
        oldValue={"status": old_status},
        newValue={"status": user.status},
        ip=ip,
        userAgent=user_agent,
    )
    db.commit()
    return user


def update_user_role(
    db: Session,
    admin_id: int,
    target_user_id: int,
    new_role: str,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> User:
    user = db.query(User).filter(User.id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent admin from accidentally demoting themselves if they are the only admin
    if user.id == admin_id and new_role != UserRole.ADMIN:
        admin_count = db.query(User).filter(User.role == UserRole.ADMIN, User.status == UserStatus.ACTIVE).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the only active Administrator",
            )

    old_role = user.role
    user.role = new_role
    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        action=AuditAction.ROLE_CHANGE,
        entity="USER",
        userId=admin_id,
        entityId=str(user.id),
        oldValue={"role": old_role},
        newValue={"role": user.role},
        ip=ip,
        userAgent=user_agent,
    )
    db.commit()
    return user


def update_user_status(
    db: Session,
    admin_id: int,
    target_user_id: int,
    new_status: str,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> User:
    user = db.query(User).filter(User.id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == admin_id and new_status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own active Administrator account",
        )

    old_status = user.status
    user.status = new_status
    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        action=AuditAction.UPDATE,
        entity="USER",
        userId=admin_id,
        entityId=str(user.id),
        oldValue={"status": old_status},
        newValue={"status": user.status},
        ip=ip,
        userAgent=user_agent,
    )
    db.commit()
    return user


def reset_user_password(
    db: Session,
    admin_id: int,
    target_user_id: int,
    new_password: str,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> User:
    user = db.query(User).filter(User.id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.passwordHash = hash_password(new_password)
    user.failedLogins = 0
    user.lockedUntil = None
    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        action=AuditAction.PASSWORD_RESET,
        entity="USER",
        userId=admin_id,
        entityId=str(user.id),
        ip=ip,
        userAgent=user_agent,
    )
    db.commit()
    return user
