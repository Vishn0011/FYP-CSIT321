from flask import Flask, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)

# Allow frontend (Vite dev server) to call this API in dev
CORS(app, supports_credentials=True, origins=["http://localhost:5173","http://localhost:3000"])

@app.get("/health")
def health():
    return jsonify(status="ok")

if __name__ == "__main__":
    # Port 8000 to match VITE_API_URL
    app.run(host="0.0.0.0", port=8000, debug=True)
