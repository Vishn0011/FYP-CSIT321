# backend/otp.py
from datetime import datetime, timedelta, timezone
import secrets
from db import query_all, execute

def _now():
    return datetime.now(timezone.utc)

def _random_code():
    # 6-digit numeric code, zero-padded
    return f"{secrets.randbelow(1_000_000):06d}"

def create_otp(user_id: int, purpose: str = "login", ttl_minutes: int = 10) -> str:
    """
    Remove any active OTPs for this user/purpose, then create a fresh one.
    Returns the OTP string.
    """
    execute(
        """
        DELETE FROM otp_codes
        WHERE user_id = %s AND purpose = %s AND consumed_at IS NULL;
        """,
        [user_id, purpose],
    )

    code = _random_code()
    execute(
        """
        INSERT INTO otp_codes(user_id, code, purpose, created_at, expires_at)
        VALUES (%s, %s, %s, %s, %s);
        """,
        [user_id, code, purpose, _now(), _now() + timedelta(minutes=ttl_minutes)],
    )
    return code

def verify_otp_code(user_id: int, code: str, purpose: str = "login") -> bool:
    """
    Validate OTP for the user/purpose. On success, mark it consumed and return True.
    """
    rows = query_all(
        """
        SELECT id
        FROM otp_codes
        WHERE user_id = %s
          AND code = %s
          AND purpose = %s
          AND consumed_at IS NULL
          AND expires_at > NOW()
        LIMIT 1;
        """,
        [user_id, code, purpose],
    )
    if not rows:
        return False

    execute(
        """
        UPDATE otp_codes
        SET consumed_at = NOW()
        WHERE id = %s;
        """,
        [rows[0]["id"]],
    )
    return True
