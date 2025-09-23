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

# run app last
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
