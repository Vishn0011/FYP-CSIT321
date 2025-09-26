import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify
from config import SESSION_TTL_MIN
from db import get_cursor  # we'll add this helper in db.py

def make_token() -> str:
    # URL-safe opaque token (~43 chars)
    return secrets.token_urlsafe(32)

def expires_at(minutes: int):
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)

def _extract_bearer(req) -> str | None:
    h = req.headers.get("Authorization", "")
    if not h.lower().startswith("bearer "):
        return None
    return h.split(" ", 1)[1].strip()

def auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _extract_bearer(request)
        if not token:
            return jsonify({"error": "missing bearer token"}), 401
        with get_cursor() as cur:
            cur.execute("""
                SELECT u.id, u.email, u.name, u.role
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token = %s AND s.expires_at > NOW()
            """, [token])
            user = cur.fetchone()
        if not user:
            return jsonify({"error": "invalid or expired token"}), 401
        request.user = user  # attach for downstream
        request.token = token
        return fn(*args, **kwargs)
    return wrapper

def create_session(user_id: int, minutes: int | None = None):
    """Create a session row and return (token, expires_at)."""
    ttl = minutes if minutes is not None else SESSION_TTL_MIN
    token = make_token()
    exp = expires_at(ttl)
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO sessions (user_id, token, expires_at) VALUES (%s, %s, %s)",
            [user_id, token, exp],
        )
    return token, exp