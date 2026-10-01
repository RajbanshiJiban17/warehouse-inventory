from typing import Optional
from fastapi import APIRouter, Cookie, Depends, Header, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, get_client_ip
from app.models.user import User
from app.schemas.user import UserRegisterRequest, UserLoginRequest, UserResponse
from app.services.auth_service import (
    register_user,
    authenticate_user,
    rotate_refresh_token,
    logout_user,
)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    is_prod = settings.ENVIRONMENT == "production"
    
    # Access token cookie (15 mins)
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        path="/",
    )
    
    # Refresh token cookie (7 days)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    request_data: UserRegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> UserResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    user = register_user(db=db, request=request_data, ip=ip, user_agent=user_agent)
    return user


@router.post("/login")
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def login(
    request_data: UserLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    user, access_token, raw_refresh_token = authenticate_user(
        db=db,
        username_or_email=request_data.username,
        password=request_data.password,
        ip=ip,
        user_agent=user_agent,
    )

    set_auth_cookies(response, access_token, raw_refresh_token)

    return {
        "message": "Login successful",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "status": user.status,
        },
        "accessToken": access_token,
        "refreshToken": raw_refresh_token,
    }


@router.post("/refresh")
def refresh(
    request: Request,
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    x_refresh_token: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> dict:
    token = x_refresh_token or refresh_token
    if not token:
        return Response(status_code=status.HTTP_401_UNAUTHORIZED, content="Refresh token required")

    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    user, new_access, new_refresh = rotate_refresh_token(
        db=db,
        raw_refresh_token=token,
        ip=ip,
        user_agent=user_agent,
    )

    set_auth_cookies(response, new_access, new_refresh)

    return {
        "accessToken": new_access,
        "refreshToken": new_refresh,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
        },
    }


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    x_refresh_token: Optional[str] = Header(None),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    token = x_refresh_token or refresh_token
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    logout_user(db=db, raw_refresh_token=token, user=current_user, ip=ip, user_agent=user_agent)
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
