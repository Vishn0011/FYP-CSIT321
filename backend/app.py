import os
from datetime import datetime, timedelta, timezone
import secrets

from flask import Flask, jsonify, request
from flask_cors import CORS, cross_origin
from dotenv import load_dotenv

from db import query_all, execute


from otp import create_otp, verify_otp_code
from mailer import send_otp_email


load_dotenv()
app = Flask(__name__)

# -----------------------------------------------------------------------------
# CORS
# -----------------------------------------------------------------------------
# Global CORS for all /api/* routes (and auth) from your Vite dev origins.
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"]
        },
        r"/auth/*": {
            "origins": ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"]
        },
        r"/me": {
            "origins": ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"]
        },
    },
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)

# As a belt-and-suspenders, ensure CORS headers always present after request
@app.after_request
def _add_cors_headers(resp):
    # Only add if not already added by Flask-CORS (harmless if duplicated)
    resp.headers.setdefault("Access-Control-Allow-Origin", request.headers.get("Origin", "http://localhost:5173"))
    resp.headers.setdefault("Access-Control-Allow-Credentials", "true")
    resp.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
    resp.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    return resp

# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
@app.get("/health")
def health():
    return jsonify({"status": "ok"})

# -----------------------------------------------------------------------------
# Users (sample)
# -----------------------------------------------------------------------------
@app.get("/api/users")
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"])
def list_users():
    rows = query_all("SELECT id, email, created_at FROM users ORDER BY id DESC;")
    return jsonify(rows)

@app.post("/api/users")
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"])
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

# -----------------------------------------------------------------------------
# HOMEBUYER ROUTES
# -----------------------------------------------------------------------------
@app.get("/api/homebuyer/properties")
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173"])
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
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173"])
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

# ---------------------- FAVOURITES (token-based user) ------------------------
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

@app.route("/api/homebuyer/favorites", methods=["GET", "POST", "OPTIONS"])
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173"])
def hb_favorites_collection():
    # Preflight
    if request.method == "OPTIONS":
        return ("", 204)

    user = _current_user_from_header()
    if not user:
        return jsonify({"success": False, "error": "unauthorized"}), 401

    if request.method == "GET":
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
            [user["id"]],
        )
        return jsonify({"success": True, "items": rows})

    # POST (add favourite)
    try:
        data = request.get_json(force=True) or {}
    except Exception:
        return jsonify({"success": False, "error": "invalid json"}), 400

    property_id = data.get("property_id")
    if not property_id:
        return jsonify({"success": False, "error": "property_id required"}), 400

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
        [user["id"], property_id],
        return_row=True,
    )

    # If it already existed, fetch the existing record so the client always
    # receives a consistent payload shape.
    if not row:
        got = query_all(
            """
            SELECT id, user_id, property_id, created_at
            FROM homebuyer_favorites
            WHERE user_id = %s AND property_id = %s
            LIMIT 1;
            """,
            [user["id"], property_id],
        )
        row = got[0] if got else None

    return jsonify({"success": True, "favorite": row})

@app.route("/api/homebuyer/favorites/<int:property_id>", methods=["DELETE", "OPTIONS"])
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173"])
def hb_remove_favorite(property_id):
    if request.method == "OPTIONS":
        return ("", 204)

    user = _current_user_from_header()
    if not user:
        return jsonify({"success": False, "error": "unauthorized"}), 401

    row = execute(
        """
        DELETE FROM homebuyer_favorites
        WHERE user_id = %s AND property_id = %s
        RETURNING property_id;
        """,
        [user["id"], property_id],
        return_row=True,
    )
    if not row:
        return jsonify({"success": False, "error": "not found"}), 404
    return jsonify({"success": True, "removed": row})

@app.get("/api/homebuyer/ping")
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173"])
def hb_ping():
    return jsonify({"ok": True})

# -----------------------------------------------------------------------------
# AUTH
# -----------------------------------------------------------------------------


# --- Step 1: verify password, send OTP (no session yet) ---
@app.route("/auth/login-step1", methods=["POST", "OPTIONS"])
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"])
def auth_login_step1():
    if request.method == "OPTIONS":
        return ("", 200)

    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "").strip().lower()  # optional

    # 🔹 normalize: accept "homebuyer" from UI, use "homeowner" in DB
    if role == "homebuyer":
        role = "homeowner"

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    # credential check (same as your /auth/login)
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

    # create & send OTP (10 min)
    code = create_otp(user_id=user["id"], purpose="login", ttl_minutes=10)
    send_otp_email(user["email"], code)

    # hint for UI; DO NOT expose the code
    masked = user["email"][0:2] + "•••@" + user["email"].split("@")[-1]
    return jsonify({"otp_sent": True, "user": {"id": user["id"], "email_hint": masked, "role": user["role"]}})


# --- Step 2: verify OTP, then issue the normal session token ---
@app.route("/auth/login-step2", methods=["POST", "OPTIONS"])
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"])
def auth_login_step2():
    if request.method == "OPTIONS":
        return ("", 200)

    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    role = (data.get("role") or "").strip().lower()  # optional

    # 🔹 normalize: accept "homebuyer" from UI, use "homeowner" in DB
    if role == "homebuyer":
        role = "homeowner"

    if not email or not code:
        return jsonify({"error": "email and code required"}), 400

    # find user (optionally role-constrained)
    params = [email]
    role_sql = ""
    if role:
        role_sql = " AND u.role = %s "
        params.append(role)

    rows = query_all(
        f"""
        SELECT u.id, u.email, u.name, u.role
        FROM users u
        WHERE u.email = %s
          AND COALESCE(u.is_active, TRUE) = TRUE
          {role_sql}
        LIMIT 1
        """,
        params,
    )
    if not rows:
        return jsonify({"error": "user not found"}), 404

    user = rows[0]

    # verify OTP
    ok = verify_otp_code(user_id=user["id"], code=code, purpose="login")
    if not ok:
        return jsonify({"error": "invalid or expired code"}), 401

    # create the normal session (same as your /auth/login)
     
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    execute(
             "INSERT INTO sessions(user_id, token, expires_at) VALUES(%s, %s, %s);",
            [user["id"], token, expires_at],
      )

    return jsonify({"token": token, "user": user})





@app.route("/auth/login", methods=["POST", "OPTIONS"])
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"])
def auth_login():
    # CORS preflight
    if request.method == "OPTIONS":
        return ("", 200)

    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "").strip().lower()

    # Accept both “homebuyer” and “homeowner”
    if role == "homebuyer":
        role = "homeowner"

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    # Build SQL with optional role filter; if no role is supplied we don't filter by role
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
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    execute(
              "INSERT INTO sessions(user_id, token, expires_at) VALUES(%s, %s, %s);",
               [user["id"], token, expires_at],
    )

    return jsonify({"token": token, "user": user})

   


@app.get("/me")
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"])
def me():
    user = _current_user_from_header()
    if not user:
        return jsonify({"error": "unauthorized"}), 401
    return jsonify({"user": user})

# -----------------------------------------------------------------------------
# Run
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
