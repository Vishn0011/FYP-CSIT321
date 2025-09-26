import os, re, json, secrets
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from db import query_all, execute, get_cursor, get_conn
from auth import make_token, expires_at, auth_required, create_session
from config import PORT, ALLOW_ORIGIN, SESSION_TTL_MIN, DEBUG
from datetime import datetime, timedelta

load_dotenv()
app = Flask(__name__)

# Allow frontend (Vite dev server) to call this API in dev
CORS(app, supports_credentials=True,
     origins=["http://localhost:5173", "http://localhost:3000"])
# CORS(app, supports_credentials=True, origins=[ALLOW_ORIGIN],
#      methods=["GET", "POST", "OPTIONS"],
#      allow_headers=["Content-Type", "Authorization"], )

def get_current_user():
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.id, u.email, u.role
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = %s
              AND s.expires_at > now()
        """, [request.token])
        return cur.fetchone()

@app.get("/health")
def health():
    return jsonify({"status": "ok"})

# ---------- AUTH ----------
@app.post("/auth/login")
def login():
    body = request.get_json(force=True) or {}
    email = (body.get("email") or "").strip()
    password = (body.get("password") or "").strip()
    role = (body.get("role") or "").strip().lower()
    if not email or not password:
        return jsonify({"error": "email and password required"}), 400
    
    if role not in ("agent", "homeowner", "homebuyer", "admin"):
        return jsonify({"error": "invalid role"}), 400

    with get_cursor() as cur:
        cur.execute("""
            SELECT id, email, name, role
            FROM users
            WHERE email = %s
              AND crypt(%s, password_hash) = password_hash
              AND COALESCE(is_active, TRUE)
              AND role = %s
        """, [email, password, role])
        user = cur.fetchone()

    if not user:
        return jsonify({"error": "invalid credentials or role"}), 401

    token = make_token()
    exp = expires_at(SESSION_TTL_MIN)
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO sessions(user_id, token, expires_at)
            VALUES (%s, %s, %s)
        """, [user["id"], token, exp])

    return jsonify({
        "token": token,
        "expires_at": exp.isoformat(),
        "user": {"id": user["id"], "email": user["email"],
                 "name": user.get("name"), "role": user.get("role")}
    })

@app.post("/auth/admin/login")
def admin_login():
    body = request.get_json(force=True, silent=True) or {}
    email = (body.get("email") or "").strip()
    password = (body.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    with get_cursor() as cur:
        cur.execute("""
            SELECT id, email, name, role, is_active,
                   (crypt(%s, password_hash) = password_hash) AS pw_match
            FROM users
            WHERE LOWER(email) = LOWER(%s)
              AND role = 'admin'
        """, [password, email])
        row = cur.fetchone()

    if not row:
        return jsonify({"error": "admin account not found"}), 404
    if not row["pw_match"]:
        return jsonify({"error": "invalid password"}), 401
    if row["is_active"] is not None and not row["is_active"]:
        return jsonify({"error": "account inactive"}), 403

    user = {"id": row["id"], "email": row["email"],
            "name": row["name"], "role": row["role"]}
    token, exp = create_session(user["id"])

    return jsonify({"token": token, "expires_at": exp.isoformat(), "user": user})

@app.get("/me")
@auth_required
def me():
    return jsonify(request.user)

@app.post("/auth/logout")
@auth_required
def logout():
    with get_cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE token = %s", [request.token])
    return jsonify({"ok": True})

# ---------- USERS ----------
@app.get("/api/users")
def list_users():
    rows = query_all("SELECT id, email, created_at FROM users ORDER BY id DESC;")
    return jsonify(rows)

# ---------- PROPERTIES ----------
@app.get("/api/properties/all")
def list_all_properties():
    rows = query_all("""
        SELECT id, agent_id, title, property_type, description, price, bedrooms, bathrooms,
               size, location, photos, status, created_at, updated_at
        FROM properties
        WHERE status = 'Active'
        ORDER BY created_at DESC
    """)
    return jsonify(rows)

@app.get("/api/properties")
def list_properties():
    agent_id = request.args.get("agent_id", type=int)
    status = request.args.get("status")
    query = """
        SELECT id, agent_id, title, property_type, description, price, bedrooms, bathrooms,
               size, location, photos, status, created_at, updated_at
        FROM properties
        WHERE 1=1
    """
    params = []
    if agent_id:
        query += " AND agent_id = %s"
        params.append(agent_id)
    if status:
        query += " AND status = %s"
        params.append(status)
    query += " ORDER BY created_at DESC"
    return jsonify(query_all(query, params))

@app.get("/api/properties/<int:prop_id>")
def get_property(prop_id):
    row = query_all("""
        SELECT id, agent_id, title, property_type, description, price, bedrooms, bathrooms,
               size, location, photos, status, created_at, updated_at
        FROM properties WHERE id = %s
    """, [prop_id])
    if not row:
        return jsonify({"error": "Property not found"}), 404
    return jsonify(row[0])

@app.post("/api/properties")
@auth_required
def add_property():
    data = request.get_json(force=True)
    user = get_current_user()
    if not user or user["role"] != "agent":
        return jsonify({"error": "Only agents can add properties"}), 403

    agent_id = user["id"]
    title = data.get("title")
    ptype = data.get("property_type")
    price = data.get("price")
    size = data.get("size")
    location = data.get("location")
    if not title or not ptype or not price or not size or not location:
        return jsonify({"error": "Missing required fields"}), 400

    description = data.get("description")
    bedrooms = data.get("bedrooms", 0)
    bathrooms = data.get("bathrooms", 0)
    photos = data.get("photos")
    status = data.get("status", "Active")

    row = execute("""
        INSERT INTO properties
        (agent_id, title, property_type, description, price, bedrooms, bathrooms,
         size, location, photos, status)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id, agent_id, title, property_type, description, price,
                  bedrooms, bathrooms, size, location, photos, status, created_at;
    """, [agent_id, title, ptype, description, price, bedrooms, bathrooms,
          size, location, photos, status], return_row=True)
    return jsonify(row), 201

@app.patch("/api/properties/edit/<int:prop_id>")
def update_property(prop_id):
    data = request.get_json(force=True)
    fields, values = [], []
    for key in ["title", "property_type", "description", "price",
                "bedrooms", "bathrooms", "size", "location", "photos", "status"]:
        if key in data:
            if key == "photos" and isinstance(data[key], list):
                fields.append(f"{key} = %s")
                values.append(json.dumps(data[key]))
            else:
                fields.append(f"{key} = %s")
                values.append(data[key])
    if not fields:
        return jsonify({"error": "No fields to update"}), 400
    values.append(prop_id)
    sql = f"""
        UPDATE properties
        SET {', '.join(fields)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING id, agent_id, title, property_type, description, price, bedrooms,
                  bathrooms, size, location, photos, status, created_at, updated_at
    """
    row = execute(sql, values, return_row=True)
    if not row:
        return jsonify({"error": "Property not found or not updated"}), 404
    return jsonify(row)

@app.delete("/api/properties/<int:prop_id>")
def delete_property(prop_id):
    row = execute("DELETE FROM properties WHERE id = %s RETURNING id;",
                  [prop_id], return_row=True)
    if not row:
        return jsonify({"error": "Property not found"}), 404
    return jsonify({"deleted": row["id"]})

@app.patch("/api/properties/<int:prop_id>/approve")
def approve_property(prop_id):
    with get_cursor() as cur:
        cur.execute("""
            UPDATE properties
            SET status = 'Active'
            WHERE id = %s
            RETURNING id, status
        """, [prop_id])
        row = cur.fetchone()
    if not row:
        return jsonify({"error": "Property not found"}), 404
    return jsonify({"message": "Property approved", "property": dict(row)})

# ---------- HOMEBUYER ROUTES ----------
@app.get("/api/homebuyer/properties")
def hb_search_properties():
    q = (request.args.get("q") or "").strip().lower()
    min_price = request.args.get("min_price")
    max_price = request.args.get("max_price")
    bedrooms = request.args.get("bedrooms")
    location = (request.args.get("location") or "").strip().lower()
    where, params = [], []
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
    sql = "SELECT id, title, location, price, bedrooms, created_at FROM properties"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC LIMIT 50;"
    rows = query_all(sql, params)
    return jsonify({"success": True, "items": rows})

@app.get("/api/homebuyer/properties/<int:prop_id>")
def hb_property_detail(prop_id):
    rows = query_all("""
        SELECT id, agent_id, title, property_type, description,
               price, bedrooms, bathrooms, size, location,
               photos, status, created_at, updated_at
        FROM properties WHERE id = %s;
    """, [prop_id])
    if not rows:
        return jsonify({"success": False, "error": "not found"}), 404
    return jsonify({"success": True, "property": rows[0]})

@app.get("/api/homebuyer/favorites")
def hb_list_favorites():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    rows = query_all("""
        SELECT f.property_id AS id,
               p.title, p.location, p.price, p.bedrooms, p.created_at
        FROM homebuyer_favorites f
        JOIN properties p ON p.id = f.property_id
        WHERE f.user_id = %s
        ORDER BY f.created_at DESC
        LIMIT 50;
    """, [user_id])
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
    row = execute("""
        INSERT INTO homebuyer_favorites(user_id, property_id)
        VALUES (%s, %s)
        ON CONFLICT (user_id, property_id) DO NOTHING
        RETURNING id, user_id, property_id, created_at;
    """, [user_id, property_id], return_row=True)
    return jsonify({"success": True, "favorite": row})

@app.delete("/api/homebuyer/favorites/<int:property_id>")
def hb_remove_favorite(property_id):
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400
    row = execute("""
        DELETE FROM homebuyer_favorites
        WHERE user_id = %s AND property_id = %s
        RETURNING property_id;
    """, [user_id, property_id], return_row=True)
    if not row:
        return jsonify({"success": False, "error": "not found"}), 404
    return jsonify({"success": True, "removed": row})

@app.get("/api/homebuyer/ping")
def hb_ping():
    return jsonify({"ok": True})

@app.post("/api/register_user")
def register_user():
    body = request.get_json(force=True) or {}
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    phone = (body.get("phone") or "").strip()
    role = (body.get("role") or "").strip().lower()
    password = body.get("password") or ""
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (email, password_hash, name, role, phone)
                VALUES (%s, crypt(%s, gen_salt('bf')), %s, %s, %s)
                ON CONFLICT (email) DO NOTHING
                RETURNING id;
            """, (email, password, name, role, phone))
            row = cur.fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Email already exists"}), 409
        new_id = row["id"] if isinstance(row, dict) else row[0]
        return jsonify({"ok": True, "id": new_id}), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
