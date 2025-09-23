import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from db import query_all, execute, get_cursor
from auth import make_token, expires_at, auth_required, create_session
from config import PORT, ALLOW_ORIGIN, SESSION_TTL_MIN, DEBUG
import json
from routes.users import users_bp

load_dotenv()
app = Flask(__name__)

# Allow frontend (Vite dev server) to call this API in dev
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://localhost:3000"])
# CORS(app, supports_credentials=True, origins=[ALLOW_ORIGIN], methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type", "Authorization"], )

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

@app.post("/auth/admin/login")
def admin_login():
    body = request.get_json(force=True, silent=True) or {}
    email = (body.get("email") or "").strip()
    password = (body.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    with get_cursor() as cur:
        cur.execute("""
            SELECT id, email, name, role
            FROM users
            WHERE email = %s
              AND crypt(%s, password_hash) = password_hash
              AND COALESCE(is_active, TRUE)
              AND role = 'admin'
        """, [email, password])
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "invalid admin credentials"}), 401

    user = dict(row)
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


# --- PROPERTIES (CRUD for agent properties) ---
@app.get("/api/properties")
def list_properties():
    # read ?agent_id=2 from query string
    agent_id = request.args.get("agent_id", type=int)

    if not agent_id:
        return jsonify({"error": "agent_id required"}), 400

    rows = query_all(
        """
        SELECT id, agent_id, title, property_type, description, price, bedrooms, bathrooms,
               size, location, photos, status, created_at, updated_at
        FROM properties
        WHERE agent_id = %s
        ORDER BY created_at DESC;
        """,
        [agent_id]
    )
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

@app.post("/api/properties")
def add_property():
    data = request.get_json(force=True)
    
    agent_id = 44   # hardcoded to agent@example.com (id = 2 in your users table)

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

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
