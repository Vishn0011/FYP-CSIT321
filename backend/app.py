import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from db import query_all, execute

load_dotenv()
app = Flask(__name__)

# Allow frontend (Vite dev server) to call this API in dev
CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
)


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

@app.post("/api/update-phone")
def update_phone():
    data = request.get_json(force=True)
    user_id = data.get("user_id")
    new_phone = data.get("phone")

    if not user_id or not new_phone:
        return jsonify({"error": "user_id and phone are required"}), 400

    row = execute(
        "UPDATE users SET phone=%s, updated_at=NOW() WHERE id=%s RETURNING id, email, phone;",
        [new_phone, user_id],
        return_row=True
    )

    if not row:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"success": True, "user": row})

# ---------- HOMEOWNER PROPERTIES CRUD ----------

@app.post("/api/homeowner/properties")
def create_homeowner_property():
    data = request.get_json(force=True)
    required = ["owner_id", "title", "address", "price"]
    if any(not data.get(k) for k in required):
        return jsonify({"success": False, "error": "owner_id, title, address, price required"}), 400

    row = execute(
        """INSERT INTO homeowner_properties
           (owner_id, title, address, district, postal_code, price, bedrooms, description)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
           RETURNING id, owner_id, title, price, created_at;""",
        [data["owner_id"], data["title"], data["address"], data.get("district"),
         data.get("postal_code"), data["price"], data.get("bedrooms"), data.get("description")],
        return_row=True
    )
    return jsonify({"success": True, "property": row}), 201

@app.get("/api/homeowner/properties")
def list_homeowner_properties():
    owner_id = request.args.get("owner_id")
    if not owner_id:
        return jsonify({"success": False, "error": "owner_id required"}), 400

    rows = query_all(
        """SELECT id, title, price, created_at
           FROM homeowner_properties
           WHERE owner_id=%s
           ORDER BY created_at DESC LIMIT 20;""",
        [owner_id]
    )
    return jsonify({"success": True, "items": rows})

@app.get("/api/homeowner/properties/<int:prop_id>")
def detail_homeowner_property(prop_id):
    rows = query_all(
        """SELECT id, owner_id, title, address, district, postal_code,
                  price, bedrooms, description, created_at
           FROM homeowner_properties
           WHERE id=%s;""",
        [prop_id]
    )
    if not rows:
        return jsonify({"success": False, "error": "not found"}), 404
    return jsonify({"success": True, "property": rows[0]})

@app.put("/api/homeowner/properties/<int:prop_id>")
def update_homeowner_property(prop_id):
    data = request.get_json(force=True)
    price = data.get("price")
    bedrooms = data.get("bedrooms")

    row = execute(
        """UPDATE homeowner_properties
           SET price = %s, bedrooms = %s
           WHERE id = %s
           RETURNING id, title, price, bedrooms;""",   # removed updated_at (column doesn't exist)
        [price, bedrooms, prop_id],
        return_row=True
    )
    if not row:
        return jsonify({"success": False, "error": "not found"}), 404
    return jsonify({"success": True, "property": row})

@app.delete("/api/homeowner/properties/<int:prop_id>")
def delete_homeowner_property(prop_id):
    row = execute(
        """DELETE FROM homeowner_properties
           WHERE id=%s RETURNING id;""",
        [prop_id],
        return_row=True
    )
    if not row:
        return jsonify({"success": False, "error": "not found"}), 404
    return jsonify({"success": True, "message": f"Property {prop_id} deleted"})

# <-- keep this at the very bottom -->
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
