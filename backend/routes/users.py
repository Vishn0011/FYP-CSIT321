from flask import Blueprint, request, jsonify
from psycopg2.extras import RealDictCursor
from db import get_conn

users_bp = Blueprint("users_bp", __name__, url_prefix="/api/users")

ALLOWED_PAGE_SIZES = {10, 20, 50, 100}

@users_bp.get("")
def list_users():
    from psycopg2.extras import RealDictCursor
    from flask import request, jsonify

    # --- Parse + clamp pagination ---
    try:
        page = int(request.args.get("page", "1"))
    except ValueError:
        page = 1
    try:
        page_size = int(request.args.get("page_size", "20"))
    except ValueError:
        page_size = 20

    if page < 1:
        page = 1
    # allow small sizes (like 2) but cap to avoid abuse
    if page_size < 1:
        page_size = 1
    if page_size > 100:
        page_size = 100

    offset = (page - 1) * page_size

    # Debug so you can SEE this handler ran and with what params
    print(f"[list_users] page={page} page_size={page_size} offset={offset}")

    # --- Queries ---
    q_count = """
        SELECT COUNT(*)::int AS total
        FROM users
        WHERE COALESCE(is_active, TRUE) IS NOT NULL
    """
    q_rows = """
        SELECT
            id, email, name, role, is_active, phone, created_at, updated_at
        FROM users
        WHERE COALESCE(is_active, TRUE) IS NOT NULL
        ORDER BY created_at DESC NULLS LAST
        LIMIT %s OFFSET %s
    """

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(q_count)
            total = cur.fetchone()["total"]
            cur.execute(q_rows, (page_size, offset))
            rows = cur.fetchall()

    return jsonify({
        "data": rows,
        "page": page,
        "page_size": page_size,
        "total": total
    })
