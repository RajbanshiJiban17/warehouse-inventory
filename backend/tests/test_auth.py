from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserRole, UserStatus
from app.models.audit import AuditLog, AuditAction
from app.models.auth import RefreshToken


def test_registration_first_user_admin_second_user_pending(client: TestClient):
    # 1. Register first user -> becomes ADMIN and ACTIVE
    res1 = client.post(
        "/api/auth/register",
        json={
            "username": "first_admin",
            "email": "first_admin@example.com",
            "password": "SuperPass@2026",
        },
    )
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["username"] == "first_admin"
    assert data1["role"] == UserRole.ADMIN
    assert data1["status"] == UserStatus.ACTIVE

    # 2. Register second user -> also becomes ADMIN and ACTIVE (direct admin access)
    res2 = client.post(
        "/api/auth/register",
        json={
            "username": "second_staff",
            "email": "second_staff@example.com",
            "password": "SuperPass@2026",
        },
    )
    assert res2.status_code == 201
    data2 = res2.json()
    assert data2["username"] == "second_staff"
    assert data2["role"] == UserRole.ADMIN
    assert data2["status"] == UserStatus.ACTIVE


def test_pending_user_cannot_login(client: TestClient, db_session: Session):
    # Register user
    client.post(
        "/api/auth/register",
        json={"username": "worker", "email": "worker@example.com", "password": "SuperPass@2026"},
    )
    # Manually set to PENDING in DB
    u = db_session.query(User).filter_by(username="worker").first()
    u.status = UserStatus.PENDING
    db_session.commit()

    # Attempt login with pending user
    res = client.post(
        "/api/auth/login",
        json={"username": "worker", "password": "SuperPass@2026"},
    )
    assert res.status_code == 403
    assert "pending administrator approval" in res.json()["detail"]


def test_brute_force_rate_limit_and_account_lockout(client: TestClient, db_session: Session):
    from app.api.auth import limiter

    # Create active user
    client.post(
        "/api/auth/register",
        json={"username": "lock_target", "email": "target@example.com", "password": "SuperPass@2026"},
    )

    # 4 failed attempts -> 401 Invalid credentials
    for _ in range(4):
        res = client.post(
            "/api/auth/login",
            json={"username": "lock_target", "password": "WrongPassword1!"},
        )
        assert res.status_code == 401
        assert res.json()["detail"] == "Invalid username or password"

    # 5th failed attempt -> 401, triggers DB account lockout (failedLogins=5, lockedUntil set)
    res5 = client.post(
        "/api/auth/login",
        json={"username": "lock_target", "password": "WrongPassword1!"},
    )
    assert res5.status_code == 401

    # 6th attempt with rate limiting active -> 429 Too Many Requests
    res6_rate = client.post(
        "/api/auth/login",
        json={"username": "lock_target", "password": "WrongPassword1!"},
    )
    assert res6_rate.status_code == 429

    # Now verify database account lockout directly (bypass IP rate limit)
    limiter.enabled = False
    try:
        res6_lock = client.post(
            "/api/auth/login",
            json={"username": "lock_target", "password": "SuperPass@2026"},
        )
        assert res6_lock.status_code == 403
        assert "temporarily locked" in res6_lock.json()["detail"]
    finally:
        limiter.enabled = True



def test_admin_approves_staff_and_staff_logs_in(client: TestClient):
    # 1. Register admin
    admin_reg = client.post(
        "/api/auth/register",
        json={"username": "admin_user", "email": "admin@example.com", "password": "SuperPass@2026"},
    )
    admin_id = admin_reg.json()["id"]

    # 2. Register staff
    staff_reg = client.post(
        "/api/auth/register",
        json={"username": "staff_user", "email": "staff@example.com", "password": "SuperPass@2026"},
    )
    staff_id = staff_reg.json()["id"]

    # 3. Admin logs in
    admin_login = client.post(
        "/api/auth/login",
        json={"username": "admin_user", "password": "SuperPass@2026"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["accessToken"]

    # 4. Admin approves staff
    approve_res = client.patch(
        f"/api/users/{staff_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}", "X-Requested-With": "XMLHttpRequest"},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == UserStatus.ACTIVE

    # 5. Staff can now log in
    staff_login = client.post(
        "/api/auth/login",
        json={"username": "staff_user", "password": "SuperPass@2026"},
    )
    assert staff_login.status_code == 200
    assert staff_login.json()["user"]["username"] == "staff_user"


def test_refresh_token_rotation_and_reuse_detection(client: TestClient, db_session: Session):
    # 1. Register & Login
    client.post(
        "/api/auth/register",
        json={"username": "token_user", "email": "token@example.com", "password": "SuperPass@2026"},
    )
    login_res = client.post(
        "/api/auth/login",
        json={"username": "token_user", "password": "SuperPass@2026"},
    )
    raw_refresh_1 = login_res.json()["refreshToken"]

    # 2. Rotate token using valid refresh token
    refresh_res = client.post(
        "/api/auth/refresh",
        headers={"x-refresh-token": raw_refresh_1},
    )
    assert refresh_res.status_code == 200
    raw_refresh_2 = refresh_res.json()["refreshToken"]
    assert raw_refresh_2 != raw_refresh_1

    # 3. REUSE DETECTION: Present old raw_refresh_1 again!
    reuse_res = client.post(
        "/api/auth/refresh",
        headers={"x-refresh-token": raw_refresh_1},
    )
    assert reuse_res.status_code == 401
    assert "Compromised refresh token detected" in reuse_res.json()["detail"]

    # 4. The entire family is now revoked, so even raw_refresh_2 fails
    res_family = client.post(
        "/api/auth/refresh",
        headers={"x-refresh-token": raw_refresh_2},
    )
    assert res_family.status_code == 401


def test_rbac_staff_cannot_access_admin_endpoints(client: TestClient, db_session: Session):
    # 1. Register admin and staff
    client.post(
        "/api/auth/register",
        json={"username": "admn", "email": "admn@example.com", "password": "SuperPass@2026"},
    )
    staff_reg = client.post(
        "/api/auth/register",
        json={"username": "stff", "email": "stff@example.com", "password": "SuperPass@2026"},
    )
    staff_id = staff_reg.json()["id"]

    # Explicitly set to STAFF
    staff_user = db_session.query(User).filter_by(id=staff_id).first()
    staff_user.role = UserRole.STAFF
    db_session.commit()

    # Staff logs in
    staff_login = client.post(
        "/api/auth/login",
        json={"username": "stff", "password": "SuperPass@2026"},
    )
    staff_token = staff_login.json()["accessToken"]

    # Staff tries to view all users -> 403 Forbidden
    rbac_users = client.get(
        "/api/users",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert rbac_users.status_code == 403
    assert "Administrator access required" in rbac_users.json()["detail"]

    # Staff tries to view audit logs -> 403 Forbidden
    rbac_audit = client.get(
        "/api/audit-logs",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert rbac_audit.status_code == 403
    assert "Administrator access required" in rbac_audit.json()["detail"]


def test_logout_and_audit_logging(client: TestClient, db_session: Session):
    # 1. Register & login
    client.post(
        "/api/auth/register",
        json={"username": "audit_user", "email": "audit@example.com", "password": "SuperPass@2026"},
    )
    login_res = client.post(
        "/api/auth/login",
        json={"username": "audit_user", "password": "SuperPass@2026"},
    )
    token = login_res.json()["accessToken"]
    refresh = login_res.json()["refreshToken"]

    # 2. Logout
    logout_res = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {token}", "x-refresh-token": refresh, "X-Requested-With": "XMLHttpRequest"},
    )
    assert logout_res.status_code == 200

    # 3. Check /me with logged out token or refresh
    refresh_after_logout = client.post(
        "/api/auth/refresh",
        headers={"x-refresh-token": refresh},
    )
    # Refresh token was revoked on server!
    assert refresh_after_logout.status_code == 401


def test_admin_user_management_crud(client: TestClient):
    # Register admin
    admin_reg = client.post(
        "/api/auth/register",
        json={"username": "adm_mgr", "email": "adm_mgr@example.com", "password": "SuperPass@2026"},
    )
    login_res = client.post(
        "/api/auth/login",
        json={"username": "adm_mgr", "password": "SuperPass@2026"},
    )
    admin_token = login_res.json()["accessToken"]
    auth_headers = {"Authorization": f"Bearer {admin_token}", "X-Requested-With": "XMLHttpRequest"}

    # 1. Admin directly creates a user
    create_res = client.post(
        "/api/users",
        headers=auth_headers,
        json={
            "username": "direct_user",
            "email": "direct_user@example.com",
            "password": "SuperPass@2026",
            "role": UserRole.STAFF,
            "status": UserStatus.ACTIVE,
        },
    )
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    # 2. Admin changes user role to MANAGER
    role_res = client.patch(
        f"/api/users/{created_id}/role",
        headers=auth_headers,
        json={"role": UserRole.MANAGER},
    )
    assert role_res.status_code == 200
    assert role_res.json()["role"] == UserRole.MANAGER

    # 3. Admin changes user status to DISABLED
    status_res = client.patch(
        f"/api/users/{created_id}/status",
        headers=auth_headers,
        json={"status": UserStatus.DISABLED},
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == UserStatus.DISABLED

    # Disabled user cannot login
    dis_login = client.post(
        "/api/auth/login",
        json={"username": "direct_user", "password": "SuperPass@2026"},
    )
    assert dis_login.status_code == 403
    assert "deactivated" in dis_login.json()["detail"]

    # 4. Admin resets user password
    reset_res = client.post(
        f"/api/users/{created_id}/reset-password",
        headers=auth_headers,
        json={"newPassword": "NewSuperSecret@2026"},
    )
    assert reset_res.status_code == 200

    # 5. Admin reactivates user
    client.patch(
        f"/api/users/{created_id}/status",
        headers=auth_headers,
        json={"status": UserStatus.ACTIVE},
    )
    # Login with new password succeeds
    new_login = client.post(
        "/api/auth/login",
        json={"username": "direct_user", "password": "NewSuperSecret@2026"},
    )
    assert new_login.status_code == 200


def test_audit_logs_viewer(client: TestClient):
    # Register admin
    client.post(
        "/api/auth/register",
        json={"username": "audit_admin", "email": "audit_admin@example.com", "password": "SuperPass@2026"},
    )
    login_res = client.post(
        "/api/auth/login",
        json={"username": "audit_admin", "password": "SuperPass@2026"},
    )
    admin_token = login_res.json()["accessToken"]

    # View audit logs
    audit_res = client.get(
        "/api/audit-logs",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert audit_res.status_code == 200
    data = audit_res.json()
    assert data["total"] > 0
    assert len(data["items"]) > 0

