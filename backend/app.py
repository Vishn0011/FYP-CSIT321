import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from db import query_all, execute

load_dotenv()
app = Flask(__name__)

# Allow frontend (Vite dev server) to call this API in dev
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://localhost:3000"])

@app.get("/health")
def health():
    return jsonify({"status": "ok"})

@app.get("/api/users")
def list_users():
    rows = query_all("SELECT id, email, created_at FROM users ORDER BY id DESC;")
    return jsonify(rows)

@app.post("/api/users")
def add_user():
    data = request.get_json(force=True)
    email = data.get("email")
    password_hash = data.get("password_hash")
    if not email or not password_hash:
        return jsonify({"error": "email and password_hash required"}), 400

    row = execute(
        "INSERT INTO users(email, password_hash) VALUES(%s, %s) RETURNING id, email, created_at;",
        [email, password_hash],
        return_row=True
    )
    return jsonify(row), 201

# ---------- HOMEBUYER ROUTES ----------
@app.get("/api/homebuyer/properties")
def hb_search_properties():
    q         = (request.args.get("q") or "").strip().lower()
    min_price = request.args.get("min_price")
    max_price = request.args.get("max_price")
    bedrooms  = request.args.get("bedrooms")
    location  = (request.args.get("location") or "").strip().lower()

    where = []
    params = []

    if q:
        where.append("(LOWER(title) LIKE %s OR LOWER(location) LIKE %s)")
        like = f"%{q}%"
        params.extend([like, like])

    if location:
        where.append("LOWER(location) = %s")
        params.append(location)

    if min_price:
        where.append("price >= %s")
        params.append(min_price)

    if max_price:
        where.append("price <= %s")
        params.append(max_price)

    if bedrooms:
        where.append("bedrooms = %s")
        params.append(bedrooms)

    sql = """
      SELECT id, title, location, price, bedrooms, created_at
      FROM properties
    """
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC LIMIT 50;"

    rows = query_all(sql, params)
    return jsonify({"success": True, "items": rows})

@app.get("/api/homebuyer/properties/<int:prop_id>")
def hb_property_detail(prop_id):
    rows = query_all(
        """
        SELECT id, agent_id, title, property_type, description,
               price, bedrooms, bathrooms, size, location,
               photos, status, created_at, updated_at
        FROM properties
        WHERE id = %s;
        """,
        [prop_id]
    )
    if not rows:
        return jsonify({"success": False, "error": "not found"}), 404
    return jsonify({"success": True, "property": rows[0]})

@app.get("/api/homebuyer/favorites")
def hb_list_favorites():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400

    rows = query_all(
        """
        SELECT f.property_id AS id,
               p.title, p.location, p.price, p.bedrooms, p.created_at
        FROM homebuyer_favorites f
        JOIN properties p ON p.id = f.property_id
        WHERE f.user_id = %s
        ORDER BY f.created_at DESC
        LIMIT 50;
        """,
        [user_id]
    )
    return jsonify({"success": True, "items": rows})

@app.post("/api/homebuyer/favorites")
def hb_add_favorite():
    data = request.get_json(force=True)
    user_id = data.get("user_id")
    property_id = data.get("property_id")
    if not user_id or not property_id:
        return jsonify({"success": False, "error": "user_id and property_id required"}), 400

    exists = query_all("SELECT 1 FROM properties WHERE id=%s LIMIT 1;", [property_id])
    if not exists:
        return jsonify({"success": False, "error": "property not found"}), 404

    row = execute(
        """
        INSERT INTO homebuyer_favorites(user_id, property_id)
        VALUES (%s, %s)
        ON CONFLICT (user_id, property_id) DO NOTHING
        RETURNING id, user_id, property_id, created_at;
        """,
        [user_id, property_id],
        return_row=True
    )
    return jsonify({"success": True, "favorite": row})

@app.delete("/api/homebuyer/favorites/<int:property_id>")
def hb_remove_favorite(property_id):
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400

    row = execute(
        """
        DELETE FROM homebuyer_favorites
        WHERE user_id = %s AND property_id = %s
        RETURNING property_id;
        """,
        [user_id, property_id],
        return_row=True
    )
    if not row:
        return jsonify({"success": False, "error": "not found"}), 404
    return jsonify({"success": True, "removed": row})

# quick sanity
@app.get("/api/homebuyer/ping")
def hb_ping():
    return jsonify({"ok": True})

# ---------- AUTH ----------
from datetime import datetime, timedelta
import secrets

def _current_user_from_header():
    """Reads Bearer token and returns user row or None."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    rows = query_all(
        """
        SELECT u.id, u.email, u.name, u.role
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = %s AND s.expires_at > NOW()
        LIMIT 1
        """,
        [token],
    )
    return rows[0] if rows else None

@app.route("/auth/login", methods=["POST", "OPTIONS"])
def auth_login():
    # CORS preflight
    if request.method == "OPTIONS":
        return ("", 200)

    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "").strip().lower()  # "homeowner" (homebuyer) or "agent"

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    # Build SQL with optional role filter.
    # Use Postgres pgcrypto `crypt()` to verify bcrypt hash.
    params = [email, password]
    role_sql = ""
    if role:
        role_sql = " AND u.role = %s "
        params.append(role)

    rows = query_all(
        f"""
        SELECT u.id, u.email, u.name, u.role
        FROM users u
        WHERE u.email = %s
          AND u.password_hash = crypt(%s, u.password_hash)
          AND COALESCE(u.is_active, TRUE) = TRUE
          {role_sql}
        LIMIT 1
        """,
        params,
    )
    if not rows:
        return jsonify({"error": "invalid credentials"}), 401

    user = rows[0]

    # Create a session token (valid 7 days)
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=7)
    execute(
        "INSERT INTO sessions(user_id, token, expires_at) VALUES(%s, %s, %s);",
        [user["id"], token, expires_at],
    )

    return jsonify({"token": token, "user": user})

@app.get("/me")
def me():
    user = _current_user_from_header()
    if not user:
        return jsonify({"error": "unauthorized"}), 401
    return jsonify({"user": user})

# put in last
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
