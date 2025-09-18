import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from db import query_all, execute, get_cursor
from auth import make_token, expires_at, auth_required
from config import PORT, ALLOW_ORIGIN, SESSION_TTL_MIN, DEBUG

load_dotenv()
app = Flask(__name__)

# Allow frontend (Vite dev server) to call this API in dev
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://localhost:3000"])
# CORS(app, supports_credentials=True, origins=[ALLOW_ORIGIN], methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type", "Authorization"], )
@app.get("/health")
def health():
    return jsonify({"status": "ok"})

# --- Auth: Login -> Session token ---
@app.post("/auth/login")
def login():
    body = request.get_json(force=True) or {}
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
            LIMIT 1
        """, [email, password])
        user = cur.fetchone()

    if not user:
        return jsonify({"error": "invalid credentials"}), 401

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

# (Optional) keep your existing simple user list if you still want it:
@app.get("/api/users")
def list_users():
    rows = query_all("SELECT id, email, created_at FROM users ORDER BY id DESC;")
    return jsonify(rows)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)


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
    