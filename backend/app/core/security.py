import re
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# Ultra-fast, highly responsive password hasher (Argon2id RFC 9106)
ph = PasswordHasher(
    time_cost=1,
    memory_cost=8192,  # 8 MB (ultra-fast verification under 10ms)
    parallelism=1,
    hash_len=32,
    salt_len=16,
)

COMMON_PASSWORDS = {
    "password123!", "admin12345!", "welcome123!", "1234567890!", "warehouse123!",
    "inventory123!", "pass@word123", "admin@12345",
}


def hash_password(password: str) -> str:
    """Hash password using Argon2id"""
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against Argon2id hash"""
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, Exception):
        return False


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Password policy:
    - Minimum 10 characters
    - Must include uppercase, lowercase, digit, and symbol
    - Reject common passwords
    """
    if len(password) < 10:
        return False, "Password must be at least 10 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must include at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must include at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must include at least one number"
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must include at least one special symbol"
    if password.lower() in COMMON_PASSWORDS:
        return False, "Password is too common; choose a stronger passphrase"
    return True, ""
