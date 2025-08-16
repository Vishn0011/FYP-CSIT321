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

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
    