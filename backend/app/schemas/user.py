from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.models.user import UserRole, UserStatus
from app.core.security import validate_password_strength


class UserBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    email: EmailStr


class UserRegisterRequest(UserBase):
    password: str = Field(..., min_length=10, max_length=128)

    @field_validator("password")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        valid, msg = validate_password_strength(v)
        if not valid:
            raise ValueError(msg)
        return v


class UserLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class UserCreateAdminRequest(UserBase):
    password: str = Field(..., min_length=10, max_length=128)
    role: str = Field(default=UserRole.STAFF)
    status: str = Field(default=UserStatus.ACTIVE)

    @field_validator("role")
    @classmethod
    def check_role(cls, v: str) -> str:
        if v not in (UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER):
            raise ValueError(f"Invalid role '{v}'")
        return v

    @field_validator("status")
    @classmethod
    def check_status(cls, v: str) -> str:
        if v not in (UserStatus.PENDING, UserStatus.ACTIVE, UserStatus.DISABLED):
            raise ValueError(f"Invalid status '{v}'")
        return v

    @field_validator("password")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        valid, msg = validate_password_strength(v)
        if not valid:
            raise ValueError(msg)
        return v


class UserUpdateRoleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str = Field(...)

    @field_validator("role")
    @classmethod
    def check_role(cls, v: str) -> str:
        if v not in (UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER):
            raise ValueError(f"Invalid role '{v}'")
        return v


class UserUpdateStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(...)

    @field_validator("status")
    @classmethod
    def check_status(cls, v: str) -> str:
        if v not in (UserStatus.PENDING, UserStatus.ACTIVE, UserStatus.DISABLED):
            raise ValueError(f"Invalid status '{v}'")
        return v


class UserResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    newPassword: str = Field(..., min_length=10, max_length=128)

    @field_validator("newPassword")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        valid, msg = validate_password_strength(v)
        if not valid:
            raise ValueError(msg)
        return v


class UserChangePasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currentPassword: str = Field(..., min_length=1, max_length=128)
    newPassword: str = Field(..., min_length=10, max_length=128)

    @field_validator("newPassword")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        valid, msg = validate_password_strength(v)
        if not valid:
            raise ValueError(msg)
        return v


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    role: str
    status: str
    failedLogins: int
    lockedUntil: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime
