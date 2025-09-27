import os, re
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from db import query_all, execute, get_cursor, get_conn
from auth import make_token, expires_at, auth_required, create_session
from config import PORT, ALLOW_ORIGIN, SESSION_TTL_MIN, DEBUG
import json
from routes.users import users_bp

load_dotenv()
app = Flask(__name__)

# Allow frontend (Vite dev server) to call this API in dev
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://localhost:3000"])
# CORS(app, supports_credentials=True, origins=[ALLOW_ORIGIN], methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type", "Authorization"], )

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

# Auth: Login, Session token
@app.post("/auth/login")
def login():
    body = request.get_json(force=True) or {}
    email = (body.get("email") or "").strip()
    password = (body.get("password") or "").strip()
    role = (body.get("role") or "").strip().lower()
    if not email or not password:
        return jsonify({"error": "email and password required"}), 400
    
    if role not in ("agent", "homeowner"):  # add other roles if you use them
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
        "user": {"id": user["id"], "email": user["email"], "name": user.get("name"), "role": user.get("role")}
    })

#Auth Admin Login
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

    # Success ,create session
    user = {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
    }
    token, exp = create_session(user["id"])

    return jsonify({
        "token": token,
        "expires_at": exp.isoformat(),
        "user": user
    })



# --- Who am I (protected) ---
@app.get("/me")
@auth_required
def me():
    return jsonify(request.user)

# --- Logout (protected) ---
@app.post("/auth/logout")
@auth_required
def logout():
    with get_cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE token = %s", [request.token])
    return jsonify({"ok": True})

# # (Optional) keep your existing simple user list if you still want it:
# @app.get("/api/users")
# def list_users():
#     rows = query_all("SELECT id, email, created_at FROM users ORDER BY id DESC;")
#     return jsonify(rows)

# @app.get("/api/users")
# def list_users():
#     rows = query_all("SELECT id, email, created_at FROM users ORDER BY id DESC;")
#     return jsonify(rows)

# @app.post("/api/users")
# def add_user():
#     data = request.get_json(force=True)
#     email = data.get("email")
#     password_hash = data.get("password_hash")
#     if not email or not password_hash:
#         return jsonify({"error": "email and password_hash required"}), 400

#     row = execute(
#         "INSERT INTO users(email, password_hash) VALUES(%s, %s) RETURNING id, email, created_at;",
#         [email, password_hash],
#         return_row=True
#     )
#     return jsonify(row), 201

# if __name__ == "__main__":
#     port = int(os.getenv("PORT", "8000"))
#     app.run(host="0.0.0.0", port=port, debug=True)

# List all active properties (public marketplace view)
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

# --- PROPERTIES (CRUD for agent properties) ---
#list properties by agent
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

    rows = query_all(query, params)
    return jsonify(rows)



#get individual property by id
@app.get("/api/properties/<int:prop_id>")
def get_property(prop_id):
    row = query_all(
        """
        SELECT id, agent_id, title, property_type, description, price, bedrooms, bathrooms,
               size, location, photos, status, created_at, updated_at
        FROM properties
        WHERE id = %s
        """,
        [prop_id]
    )
    if not row:
        return jsonify({"error": "Property not found"}), 404
    return jsonify(row[0])

#add property
@app.post("/api/properties")
@auth_required   # make sure only logged-in users can hit this
def add_property():
    data = request.get_json(force=True)

    # get the logged-in user
    user = get_current_user()
    if not user or user["role"] != "agent":
        return jsonify({"error": "Only agents can add properties"}), 403

    agent_id = user["id"]   # dynamic agent id from session

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

    row = execute(
        """
        INSERT INTO properties
        (agent_id, title, property_type, description, price, bedrooms, bathrooms,
         size, location, photos, status)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id, agent_id, title, property_type, description, price,
                  bedrooms, bathrooms, size, location, photos, status, created_at;
        """,
        [agent_id, title, ptype, description, price, bedrooms, bathrooms,
         size, location, photos, status],
        return_row=True
    )
    return jsonify(row), 201

#edit property
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
        RETURNING id, agent_id, title, property_type, description, price, bedrooms, bathrooms,
                  size, location, photos, status, created_at, updated_at
    """

    print("DEBUG SQL:", sql)
    print("DEBUG Values:", values)

    row = execute(sql, values, return_row=True)
    if not row:
        return jsonify({"error": "Property not found or not updated"}), 404
    return jsonify(row)

#delete property
@app.delete("/api/properties/<int:prop_id>")
def delete_property(prop_id):
    row = execute(
        "DELETE FROM properties WHERE id = %s RETURNING id;",
        [prop_id],
        return_row=True
    )
    if not row:
        return jsonify({"error": "Property not found"}), 404
    return jsonify({"deleted": row["id"]})

app.register_blueprint(users_bp)
#admin approve property
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

# ---User Registration---
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
            cur.execute(
                """
                INSERT INTO users
                  (email, password_hash, name, role, phone)
                VALUES (%s, crypt(%s, gen_salt('bf')), %s, %s, %s)
                ON CONFLICT (email) DO NOTHING
                RETURNING id, email, name, role, phone;
                """,
                (email, password, name, role, phone),
            )
            row = cur.fetchone()

        if not row:
            return jsonify({"ok": False, "error": "Email already exists"}), 409

        # Build user dict from row
        if isinstance(row, dict):
            user = row
        else:
            user = {
                "id": row[0],
                "email": row[1],
                "name": row[2],
                "role": row[3],
                "phone": row[4],
            }

        # TODO: generate real token here (JWT etc.)
        return jsonify({"ok": True, "user": user, "token": None}), 201

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

# --- Search properties for homebuyers (protected) ---
@app.get("/api/homeowner/properties")
@auth_required
def homebuyer_properties():
    q = request.args.get("q", "").strip()
    location = request.args.get("location", "").strip()
    min_price = request.args.get("min_price", type=int)
    max_price = request.args.get("max_price", type=int)
    bedrooms = request.args.get("bedrooms", type=int)

    query = """
        SELECT id, title, price, bedrooms, location
        FROM properties
        WHERE status = 'Active'
    """
    params = []

    if q:
        query += " AND (title ILIKE %s OR location ILIKE %s)"
        params += [f"%{q}%", f"%{q}%"]

    if location:
        query += " AND location = %s"
        params.append(location)

    if min_price is not None:
        query += " AND price >= %s"
        params.append(min_price)

    if max_price is not None:
        query += " AND price <= %s"
        params.append(max_price)

    if bedrooms is not None:
        query += " AND bedrooms = %s"
        params.append(bedrooms)

    query += " ORDER BY id DESC"

    rows = query_all(query, params)
    return jsonify({"success": True, "items": rows})



if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
