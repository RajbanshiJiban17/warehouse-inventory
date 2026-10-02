from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin, get_client_ip
from app.models.user import User
from app.schemas.user import (
    UserResponse,
    UserCreateAdminRequest,
    UserUpdateRoleRequest,
    UserUpdateStatusRequest,
    UserResetPasswordRequest,
)
from app.services.user_service import (
    list_users,
    create_user_by_admin,
    approve_user,
    update_user_role,
    update_user_status,
    reset_user_password,
)

router = APIRouter(prefix="/api/users", tags=["User Management"])


@router.get("", response_model=dict[str, Any])
def get_users(
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    users, total = list_users(
        db=db,
        role=role,
        status_filter=status,
        search=search,
        limit=limit,
        offset=offset,
    )
    return {
        "total": total,
        "items": [UserResponse.model_validate(u) for u in users],
        "limit": limit,
        "offset": offset,
    }


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    request_data: UserCreateAdminRequest,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    user = create_user_by_admin(
        db=db,
        admin_id=current_admin.id,
        request=request_data,
        ip=ip,
        user_agent=user_agent,
    )
    return user


@router.patch("/{user_id}/approve", response_model=UserResponse)
def approve_pending_user(
    user_id: int,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    user = approve_user(
        db=db,
        admin_id=current_admin.id,
        target_user_id=user_id,
        ip=ip,
        user_agent=user_agent,
    )
    return user


@router.patch("/{user_id}/role", response_model=UserResponse)
def change_role(
    user_id: int,
    request_data: UserUpdateRoleRequest,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    user = update_user_role(
        db=db,
        admin_id=current_admin.id,
        target_user_id=user_id,
        new_role=request_data.role,
        ip=ip,
        user_agent=user_agent,
    )
    return user


@router.patch("/{user_id}/status", response_model=UserResponse)
def change_status(
    user_id: int,
    request_data: UserUpdateStatusRequest,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    user = update_user_status(
        db=db,
        admin_id=current_admin.id,
        target_user_id=user_id,
        new_status=request_data.status,
        ip=ip,
        user_agent=user_agent,
    )
    return user


@router.post("/{user_id}/reset-password", response_model=dict[str, Any])
def admin_reset_password(
    user_id: int,
    request_data: UserResetPasswordRequest,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    reset_user_password(
        db=db,
        admin_id=current_admin.id,
        target_user_id=user_id,
        new_password=request_data.newPassword,
        ip=ip,
        user_agent=user_agent,
    )
    return {"message": "User password reset successfully"}
