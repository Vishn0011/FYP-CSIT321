from flask import Blueprint, request, jsonify
from psycopg2.extras import RealDictCursor
from db import get_conn

users_bp = Blueprint("users_bp", __name__, url_prefix="/api/users")

ALLOWED_PAGE_SIZES = {10, 20, 50, 100}

@users_bp.get("")
def list_users():

    # --- pagination ---
    def clamp(n, lo, hi): return max(lo, min(hi, n))
    try: page = int(request.args.get("page", "1"))
    except ValueError: page = 1
    try: page_size = int(request.args.get("page_size", "20"))
    except ValueError: page_size = 20
    page = max(1, page)
    page_size = clamp(page_size, 1, 100)
    offset = (page - 1) * page_size

    # --- filters / search ---
    query = request.args.get("query") or None
    role = request.args.get("role") or "all"          # admin|agent|client|all
    status = request.args.get("status") or "all"      # active|inactive|all

    # --- sorting ---
    sort = (request.args.get("sort") or "created_at").lower()
    order = (request.args.get("order") or "desc").lower()
    SORT_WHITELIST = {"name", "email", "role", "created_at", "updated_at"}
    if sort not in SORT_WHITELIST: sort = "created_at"
    if order not in {"asc", "desc"}: order = "desc"
    order_sql = "ASC" if order == "asc" else "DESC"

    # --- dynamic WHERE ---
    wheres = ["1=1"]           # base true
    params = []

    # hide deleted if you ever add it (future-proofing)
    # wheres.append("COALESCE(status, 'active') <> 'deleted'")

    if status in ("active", "inactive"):
        wheres.append("is_active = %s")
        params.append(True if status == "active" else False)

    if role in ("admin", "agent", "client"):
        wheres.append("role = %s")
        params.append(role)

    if query:
        wheres.append("(name ILIKE %s OR email ILIKE %s)")
        like = f"%{query.strip()}%"
        params.extend([like, like])

    where_sql = " AND ".join(wheres)

    q_count = f"SELECT COUNT(*)::int AS total FROM users WHERE {where_sql};"
    q_rows = f"""
        SELECT id, email, name, role, is_active, phone, created_at, updated_at
        FROM users
        WHERE {where_sql}
        ORDER BY {sort} {order_sql} NULLS LAST
        LIMIT %s OFFSET %s;
    """

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(q_count, params)
            total = cur.fetchone()["total"]
            cur.execute(q_rows, [*params, page_size, offset])
            rows = cur.fetchall()

    return jsonify({"data": rows, "page": page, "page_size": page_size, "total": total})

@users_bp.put("/<int:user_id>")
def update_user(user_id):

    body = request.get_json(silent=True) or {}
    allowed = {"name", "role", "is_active", "phone"}  # expand later
    updates = []
    params = []

    for k, v in body.items():
        if k in allowed:
            updates.append(f"{k} = %s")
            params.append(v)

    if not updates:
        return jsonify({"error": {"code": "NO_CHANGES", "message": "Nothing to update"}}), 400

    params.append(user_id)

    sql = f"""
      UPDATE users
      SET {", ".join(updates)}, updated_at = now()
      WHERE id = %s
      RETURNING id, email, name, role, is_active, phone, created_at, updated_at
    """

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            if not row:
                return jsonify({"error": {"code": "NOT_FOUND", "message": "User not found"}}), 404
            conn.commit()

    return jsonify(row)

@users_bp.delete("/<int:user_id>")
def delete_user(user_id):

    sql = """
      UPDATE users
      SET is_active = FALSE, updated_at = now()
      WHERE id = %s
      RETURNING id
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, (user_id,))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": {"code": "NOT_FOUND", "message": "User not found"}}), 404
            conn.commit()
    return ("", 204)
