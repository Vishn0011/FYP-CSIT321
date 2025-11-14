import os, re
from pathlib import Path
from flask import Flask, jsonify, request, Blueprint
from flask_cors import CORS
from dotenv import load_dotenv
from db import query_all, execute, get_cursor_cm, get_conn, query_one
from auth import make_token, expires_at, auth_required, create_session
from config import PORT, ALLOW_ORIGIN, SESSION_TTL_MIN, DEBUG
import json
from routes.users import users_bp
import psycopg2
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from datetime import timezone, timedelta, datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from psycopg2.extras import RealDictCursor
import joblib
import pandas as pd
import numpy as np  
from lightgbm import LGBMRegressor
from sklearn.preprocessing import LabelEncoder
from datetime import datetime
from math import radians, cos, sin, asin, sqrt
import requests
from psycopg2 import OperationalError
import stripe
from decimal import Decimal
import requests, time

from pathlib import Path

load_dotenv()
app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
geo_bp = Blueprint("geo", __name__)
GOOGLE_API_KEY = "AIzaSyDy__k7VDO7MsNhVovVpcKWHxQM14byQyw"
CLIENT_ID = "98981474983-d5h2shgl18u6oovn378q3ovao61jtbm0.apps.googleusercontent.com"  # same as frontend

# Ensure saved_properties table exists for environments that have not run latest migration yet.
with get_cursor_cm() as cur:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS saved_properties (
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, property_id)
        )
        """
    )
with get_cursor_cm() as cur:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS agent_applications (
            user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            cea_reg_no TEXT NOT NULL,
            agency_name TEXT NOT NULL,
            agency_license_no TEXT NOT NULL,
            years_experience INT,
            id_last4 TEXT,
            supporting_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

with get_cursor_cm() as cur:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS homeowner_preferences (
            user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

PREFERENCE_PRICE_MIN = 0
PREFERENCE_PRICE_MAX = 5_000_000


def _clean_text(value, max_len=120):
    if not value:
        return ""
    return str(value).strip()[:max_len]


def _clean_string_list(items, max_items=5, max_len=80):
    cleaned = []
    if not items:
        return cleaned
    for item in items:
        text = _clean_text(item, max_len)
        if text and text not in cleaned:
            cleaned.append(text)
        if len(cleaned) >= max_items:
            break
    return cleaned


def _to_int(value):
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def normalize_homeowner_preferences(payload):
    payload = payload or {}
    budget = payload.get("budget") or {}
    budget_min = _to_int(budget.get("min"))
    budget_max = _to_int(budget.get("max"))

    def clamp_budget(val):
        if val is None:
            return None
        return max(PREFERENCE_PRICE_MIN, min(PREFERENCE_PRICE_MAX, val))

    budget_min = clamp_budget(budget_min)
    budget_max = clamp_budget(budget_max)
    if (
        budget_min is not None
        and budget_max is not None
        and budget_min > budget_max
    ):
        budget_min, budget_max = budget_max, budget_min

    bedrooms_value = _clean_text(payload.get("bedrooms"), 8)
    amenities = _clean_string_list(payload.get("amenities"), max_items=6)
    locations = _clean_string_list(payload.get("locations"), max_items=5)

    return {
        "intent": _clean_text(payload.get("intent"), 60),
        "budget": {
            "label": _clean_text(budget.get("label"), 40),
            "min": budget_min,
            "max": budget_max,
        },
        "bedrooms": bedrooms_value,
        "locations": locations,
        "amenities": amenities,
        "notes": _clean_text(payload.get("notes"), 280),
    }

# # For current market price predictions
# current_model = joblib.load("joblib/lgbm_model.joblib")

# ----------------------------------------------------
# 1. CONFIGURATION & GLOBAL MODEL LOADING (Runs once)
# ----------------------------------------------------
import os
import joblib
import json
import pandas as pd
import numpy as np
from datetime import datetime
import traceback # Ensure this is imported for error handling

# --- ✅ v12: Point to your folder and the ONE pipeline file ---
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "joblib"
PIPELINE_PATH = MODEL_DIR / "lgbm_property_pipeline_v12.joblib"

# --- Data Paths (Update as needed) ---
DATA_PATH = BASE_DIR / "excel" / "Cleaned_Merged_Property_Transactions_v2.xlsx"
CACHE_FILE = BASE_DIR / "cache" / "growth_rates.json"

PRIME_HDB_LOCATIONS = ['CENTRAL', 'QUEENSTOWN', 'BUKIT MERAH', 'TOA PAYOH', 'BISHAN', 'KALLANG/WHAMPOA']


# === Growth Rate Loading Logic (Unchanged) ===
def load_growth_rates(file_path: str):
    """
    Loads or caches region-level annualized growth rates (CAGR) per region-property_type combination.
    """
    # 1. Use cache if available
    # NOTE: CACHE_FILE must be defined globally for this function to work.
    
    # --- 1. Use cache if available ---
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                growth_dict = json.load(f)
            print("Loaded growth rates from cache.")
            for k, v in growth_dict.items():
                 print(f"   {k}: {v:.4f}")
            return growth_dict
        except Exception as e:
            print(f"Failed to read cache ({e}), recomputing...")

    # 2. Compute fresh if cache not found
    print("Computing growth rates from dataset...")
    use_cols = ["region", "transaction_date", "price", "floor_area_sqm"]
    df = pd.read_excel(file_path, usecols=use_cols)

    # --- 2. Compute fresh if cache not found ---
    print("📊 Computing growth rates from dataset...")
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        print(f"Fatal error loading data: {e}")
        # Return a robust default dictionary on failure
        return {"HDB_Central": 0.045, "Condominium_Central": 0.045, 
                "HDB_East": 0.045, "Condominium_East": 0.045} 

    df.columns = df.columns.str.strip()
    
    # Helper for normalizing property type (must match training script's growth logic)
    def normalize_prop_type_growth(row_value):
        row_value = str(row_value).upper()
        if "CONDO" in row_value or "APARTMENT" in row_value:
            return "Condominium"
        if "ROOM" in row_value or "HDB" in row_value or "FLAT" in row_value or "EXECUTIVE" in row_value:
            return "HDB"
        return "Other" # Group Landed/Other

    df['property_category'] = df['property_type_final'].apply(normalize_prop_type_growth)
    # Exclude property types that skew residential growth (e.g., commercial/industrial)
    df = df[df['property_category'].isin(['HDB', 'Condominium'])] 

    # Prepare data for calculation
    df["price_per_sqm"] = df["price"] / df["floor_area_sqm"]
    df["transaction_year"] = pd.to_datetime(df["transaction_date"], errors="coerce").dt.year
    df = df.dropna(subset=["region", "transaction_year", "price_per_sqm"])
    
    growth_dict = {}
    
    # --- Compute CAGR per region-property_type combo ---
    for (region, prop_type), group in df.groupby(["region", "property_category"]):
        group = group.groupby("transaction_year")["price_per_sqm"].median().sort_index()
        if len(group) >= 2:
            first, last = group.iloc[0], group.iloc[-1]
            years = group.index[-1] - group.index[0]
            if first > 0 and years > 0:
                cagr = (last / first) ** (1 / years) - 1
                # Smooth to realistic range (2% to 6%)
                cagr_smoothed = min(max(cagr, 0.02), 0.06) 
                growth_dict[f"{prop_type}_{region.title()}"] = round(cagr_smoothed, 4)

    # Fill in any missing region-prop_type combinations with the default
    all_regions = df['region'].unique()
    all_props = ["HDB", "Condominium"]
    for r in all_regions:
        for p in all_props:
            key = f"{p}_{r.title()}"
            if key not in growth_dict:
                growth_dict[key] = 0.045 # Default 4.5%

    # --- 3. Save to cache for next startup ---
    os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(growth_dict, f, indent=4)
    
    print("✅ Cached region-level growth rates:")
    for k, v in growth_dict.items():
        print(f"   {k}: {v:.4f}")

    return growth_dict


# === Global Load Once ===
GROWTH_RATES = load_growth_rates(DATA_PATH)
print(f"✅ Loaded growth rates: {GROWTH_RATES}")

# --- ✅ v12: Load the single pipeline ---
pipeline = None
try:
    print(f"Loading v12 pipeline from {PIPELINE_PATH}...")
    pipeline = joblib.load(PIPELINE_PATH)
    print("✅ v12 Pipeline (Model+Scaler+OHE) loaded successfully.")

except Exception as e:
    print(f"!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print(f"ERROR: Could not load v12 pipeline. Check path: {PIPELINE_PATH}")
    print(f"Loading Error: {e}")
    print(f"!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    pipeline = None


# --- ✅ v12: Feature lists MUST match your training script (train_lgbm_price_forecaster_v12.py) ---
NUMERIC_FEATURES = [
    "floor_area_sqm", "remaining_lease_adj", "property_age",
    "nearest_mrt_km", "nearest_mall_km", "nearest_school_km",
    "nearest_hospital_km", "nearest_park_km", "amenity_score",
    "transaction_year", "transaction_month", "year_sin", "year_cos",
    "amenity_density", "mrt_x_area", "mall_x_school"
]
CATEGORICAL_FEATURES = [
    "region", 
    "property_category", 
    "tenure_clean",      
    "geo_cluster", 
    "prop_region_combo",
    "prime_town_flag" 
]

MODEL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
print(f"✅ v12 Model features loaded. Count: {len(MODEL_FEATURES)}")

# Allow frontend (Vite dev server) to call this API in dev
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://localhost:3000"])
# CORS(app, supports_credentials=True, origins=[ALLOW_ORIGIN], methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type", "Authorization"], )

# --- For Stripe (payment service)
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

def get_current_user():
    with get_cursor_cm() as cur:
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
from datetime import datetime
import pytz

@app.post("/auth/login")
def login():
    body = request.get_json(force=True) or {}
    email = (body.get("email") or "").strip()
    password = (body.get("password") or "").strip()
    role = (body.get("role") or "").strip().lower()

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    if role not in ("agent", "homeowner"):
        return jsonify({"error": "invalid role"}), 400

    with get_cursor_cm() as cur:
        # Authenticate
        cur.execute("""
            SELECT id, email, name, role, is_active, status
            FROM users
            WHERE email = %s
              AND crypt(%s, password_hash) = password_hash
              AND role = %s
            LIMIT 1
        """, [email, password, role])
        user = cur.fetchone()

        if not user:
            return jsonify({"error": "invalid credentials or role"}), 401

        # Enforce approval
        if not user["is_active"] or user["status"] != "approved":
            return jsonify({
                "error": "Your account is pending admin approval.",
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "name": user.get("name"),
                    "role": user.get("role"),
                    "status": user.get("status"),
                }
            }), 403

        # Generate session + update agent last_active (same connection)
        token = make_token()
        exp = expires_at(SESSION_TTL_MIN)

        cur.execute("""
            INSERT INTO sessions(user_id, token, expires_at)
            VALUES (%s, %s, %s)
        """, [user["id"], token, exp])

        if user["role"] == "agent":
            cur.execute("""
                UPDATE users
                SET last_active = NOW()
                WHERE id = %s
            """, [user["id"]])

    # Convert expiry to SG time
    sg = pytz.timezone("Asia/Singapore")
    exp_sg = exp.astimezone(sg)

    return jsonify({
        "token": token,
        "expires_at": exp_sg.isoformat(),
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name"),
            "role": user.get("role"),
            "status": user.get("status"),
        }
    })

#Auth Admin Login

@app.post("/auth/admin/login")
def admin_login():
    body = request.get_json(force=True, silent=True) or {}
    email = (body.get("email") or "").strip()
    password = (body.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    with get_cursor_cm() as cur:
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

    # Success, create session
    user = {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
    }
    token, exp = create_session(user["id"])   # exp is still UTC

    # convert UTC -> Singapore time before sending
    sg = pytz.timezone("Asia/Singapore")
    exp_sg = exp.astimezone(sg)

    return jsonify({
        "token": token,
        "expires_at": exp_sg.isoformat(),  # frontend sees SG time
        "user": user
    })

# --- Google OAuth Login ---
@app.post("/auth/google/login")
def google_login():
    body = request.get_json(force=True) or {}
    token = (body.get("token") or "").strip()

    if not token:
        return jsonify({"error": "missing token"}), 400

    try:
        idinfo = id_token.verify_oauth2_token(token, grequests.Request(), CLIENT_ID)
        email = idinfo["email"]

        with get_cursor_cm() as cur:
            cur.execute("""
                SELECT id, email, name, role, is_active, status
                FROM users
                WHERE email = %s
            """, [email])
            user = cur.fetchone()

        if not user:
            return jsonify({"error": "No account found, please sign up first."}), 404

        if not user["is_active"] or user["status"] != "approved":
            return jsonify({
                "error": "Your account is pending admin approval.",
                "user": user
            }), 403

        # Issue session token
        session_token = make_token()
        exp = expires_at(SESSION_TTL_MIN)
        with get_cursor_cm() as cur:
            cur.execute("""
                INSERT INTO sessions(user_id, token, expires_at)
                VALUES (%s, %s, %s)
            """, [user["id"], session_token, exp])

        return jsonify({"token": session_token, "user": user})

    except ValueError:
        return jsonify({"error": "Invalid Google token"}), 400

@app.post("/auth/google/signup")
def google_signup():
    try:
        body = request.get_json(force=True) or {}
        token = (body.get("token") or "").strip()
        role = (body.get("role") or "homeowner").lower()

        # verify Google token
        idinfo = id_token.verify_oauth2_token(token, grequests.Request(), CLIENT_ID)
        email = idinfo["email"]
        name = idinfo.get("name", "")

        # check if user already exists
        with get_cursor_cm() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", [email])
            if cur.fetchone():
                return jsonify({"error": "Account already exists"}), 409

        # Approval logic
        if role == "agent":
            is_active, status = False, "pending"
        else:
            is_active, status = True, "approved"

        # Insert with fake password hash
        fake_hash = "google-oauth"
        with get_cursor_cm() as cur:
            cur.execute("""
                INSERT INTO users (email, name, role, password_hash, is_active, status)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, email, name, role, is_active, status
            """, [email, name, role, fake_hash, is_active, status])
            user = cur.fetchone()

        return jsonify({"user": user}), 201

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500




# --- Who am I (protected) ---
@app.get("/me")
@auth_required
def me():
    return jsonify(request.user)

# --- Logout (protected) ---
@app.post("/auth/logout")
@auth_required
def logout():
    with get_cursor_cm() as cur:
        cur.execute("DELETE FROM sessions WHERE token = %s", [request.token])
    return jsonify({"ok": True})


@app.get("/api/profile")
@auth_required
def get_profile():
    user_id = request.user["id"]
    with get_cursor_cm() as cur:
        cur.execute(
            """
            SELECT id, email, name, role, phone, status, is_active, created_at, updated_at
            FROM users
            WHERE id = %s
            """,
            [user_id],
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "User not found"}), 404
    return jsonify(row)


@app.put("/api/profile")
@auth_required
def update_profile():
    body = request.get_json(force=True, silent=True) or {}
    fields = []
    params = []

    if "name" in body:
        name = (body.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Name is required"}), 400
        fields.append("name = %s")
        params.append(name)

    if "phone" in body:
        phone = (body.get("phone") or "").strip()
        fields.append("phone = %s")
        params.append(phone or None)

    if not fields:
        return jsonify({"error": "No changes submitted"}), 400

    params.append(request.user["id"])

    with get_cursor_cm() as cur:
        cur.execute(
            f"""
            UPDATE users
            SET {", ".join(fields)}, updated_at = now()
            WHERE id = %s
            RETURNING id, email, name, role, phone, status, is_active, created_at, updated_at
            """,
            params,
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "User not found"}), 404
    return jsonify(row)


@app.put("/api/profile/password")
@auth_required
def update_password():
    body = request.get_json(force=True, silent=True) or {}
    current_pw = (body.get("currentPassword") or "").strip()
    new_pw = (body.get("newPassword") or "").strip()
    confirm_pw = (body.get("confirmPassword") or "").strip()

    if not current_pw or not new_pw:
        return jsonify({"error": "Current and new password required"}), 400
    if new_pw != confirm_pw:
        return jsonify({"error": "Passwords do not match"}), 400
    if len(new_pw) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    user_id = request.user["id"]

    with get_cursor_cm() as cur:
        cur.execute(
            "SELECT password_hash FROM users WHERE id = %s",
            [user_id],
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "User not found"}), 404

        stored_hash = row["password_hash"] or ""
        if stored_hash == "google-oauth":
            return jsonify({"error": "Password not set for Google-linked account"}), 400

        cur.execute(
            "SELECT crypt(%s, %s) = %s AS match",
            [current_pw, stored_hash, stored_hash],
        )
        match_row = cur.fetchone()
        if not match_row or not match_row.get("match"):
            return jsonify({"error": "Current password is incorrect"}), 400

        cur.execute(
            """
            UPDATE users
            SET password_hash = crypt(%s, gen_salt('bf')), updated_at = now()
            WHERE id = %s
            """,
            [new_pw, user_id],
        )

    return jsonify({"ok": True})

# ---------- USERS ----------
@app.get("/api/users")
def list_users():
    rows = query_all("SELECT id, email, created_at FROM users ORDER BY id DESC;")
    return jsonify(rows)

@app.get("/api/users/pending")
def get_pending_users():
    with get_cursor_cm() as cur:
        cur.execute("""
            SELECT id, name, email, role, status, is_active
            FROM users
            WHERE role = 'agent' AND status = 'pending'
            ORDER BY created_at DESC
        """)
        users = cur.fetchall()
    return jsonify(users)

@app.patch("/api/users/<int:user_id>/approve")
def approve_user(user_id):
    with get_cursor_cm() as cur:
        cur.execute("""
            UPDATE users
            SET is_active = TRUE, status = 'approved'
            WHERE id = %s AND role = 'agent'
            RETURNING id, name, email, role, status, is_active
        """, [user_id])
        user = cur.fetchone()

    if not user:
        return jsonify({"error": "User not found or not an agent"}), 404

    return jsonify(user)


@app.get("/api/users/stats")
def user_stats():
    total_row = query_all("SELECT COUNT(*) AS count FROM users;")
    total = total_row[0]["count"] if total_row else 0

    recent = query_all("""
        SELECT id, email, created_at,name
        FROM users
        ORDER BY created_at DESC
        LIMIT 5;
    """)

    return jsonify({
        "total": total,
        "recent": recent
    })

#list features that are active
@app.get("/api/features")
def get_features():
    rows = query_all("SELECT id, title, description, icon, category FROM features WHERE is_visible = TRUE")
    return jsonify(rows)

#list all features (homepage)
@app.get("/api/admin/features")
def admin_features():
    return jsonify(query_all("SELECT * FROM features ORDER BY id DESC"))

#Add features 
@app.post("/api/admin/features")
def create_feature():
    data = request.get_json(force=True)
    execute(
        "INSERT INTO features (title, description, icon, category, is_visible) VALUES (%s,%s,%s,%s,%s)",
        [data["title"], data["description"], data["icon"], data["category"], data.get("is_visible", True)],
    )
    return jsonify({"ok": True})

#update features 
@app.patch("/api/admin/features/<int:fid>")
def update_feature(fid):
    data = request.get_json(force=True)
    execute(
        "UPDATE features SET title=%s, description=%s, icon=%s, category=%s, is_visible=%s WHERE id=%s",
        [data["title"], data["description"], data["icon"], data["category"], data["is_visible"], fid],
    )
    return jsonify({"ok": True})

#delete features 
@app.delete("/api/admin/features/<int:fid>")
def delete_feature(fid):
    execute("DELETE FROM features WHERE id=%s", [fid])
    return jsonify({"deleted": fid})

#show in dashboard recent pending properties for admin
@app.get("/api/properties/recent")
def recent_properties():
    # only show properties needing approval
    rows = query_all("""
        SELECT p.id, p.title, u.name AS agent, p.status
        FROM properties p
        JOIN users u ON p.agent_id = u.id
        WHERE p.status = 'Pending'
        ORDER BY p.created_at DESC
        LIMIT 10
    """)
    return jsonify(rows)


#admin approve property
@app.patch("/api/properties/<int:prop_id>/approve")
def approve_property(prop_id):
    with get_cursor_cm() as cur:
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



# List all active properties (public marketplace view)
# Called by: AllPropertiesPage.js
@app.get("/api/properties/all")
def list_all_public_properties():
    """
    Gets all properties that are marked as 'Active' for the public marketplace.
    """
    
    # --- Following the style of your /api/properties endpoint ---
    query = """
        SELECT id, agent_id, title, property_type, description, price, bedrooms, bathrooms,
               size, location, photos, status, created_at, updated_at
        FROM properties
        WHERE 1=1
    """
    params = []

    # Hard-code the 'Active' status for this public endpoint
    query += " AND status = %s"
    params.append('Active')

    query += " ORDER BY created_at DESC"
    
    # Call query_all with *both* arguments, just like your working function
    rows = query_all(query, params)
    
    # --- Add back your JSON processing for photos ---
    processed_rows = []
    for row in rows:
        if 'photos' in row and isinstance(row['photos'], str):
            try:
                row['photos'] = json.loads(row['photos'])
            except json.JSONDecodeError:
                row['photos'] = [] # Default to empty list if parsing fails
        processed_rows.append(row)

    return jsonify(processed_rows)


# === 2. PUBLIC: Get ONE Active Property by ID ===
# (For your 'PublicPropertyPage.js' detail page)

@app.get("/api/explore/properties/<int:prop_id>")
def get_public_property(prop_id):
    """
    Gets a single, detailed property view by its ID, but *only* if it is 'Active'.
    """
    
    # --- Fetch property + agent info in one query ---
    row = query_all(
        """
        SELECT 
            p.id, p.agent_id, p.title, p.property_type, p.description, p.price,
            p.bedrooms, p.bathrooms, p.size, p.location, p.latitude, p.longitude,
            p.photos, p.status, p.furnishing, p.floor_level, p.tenure, p.amenities,
            p.floor_plan, p.video_url, p.created_at, p.updated_at,
            p.region, p.property_type_final, p.floor_area_sqm, p.remaining_lease,
            p.nearest_mrt_km, p.nearest_school_km, p.nearest_mall_km, p.nearest_hospital_km,
            p.nearest_park_km, p.nearest_business_km, p.amenity_score, p.health_score,
            p.green_score, p.business_access_score, p.floor_level_num, p.year_completed,
            p.transaction_year, p.transaction_month, p.geo_cluster,
            u.name AS agent_name, u.status AS agent_status, u.last_active,
            p.nearest_mrt_name,
            p.nearest_mall_name,
            p.nearest_school_name,
            p.nearest_hospital_name,
            p.nearest_park_name,
            p.nearest_business_name
        FROM properties p
        LEFT JOIN users u ON p.agent_id = u.id
        WHERE p.id = %s
          AND p.status = 'Active'  -- ✅ This is the critical public filter
        """,
        [prop_id],
    )

    if not row:
        return jsonify({"error": "Property not found or is not active"}), 404

    # Get the single item from the list
    data = row[0]

    # ✅ Convert Decimal and JSON fields for React compatibility
    for key, value in data.items():
        if isinstance(value, Decimal):
            data[key] = float(value)
        
        elif key in ("photos", "amenities") and isinstance(value, str):
            value_str = value.strip()
            
            if value_str.startswith("[") or value_str.startswith("{"):
                # stored as JSON text, decode
                try:
                    data[key] = json.loads(value_str)
                except json.JSONDecodeError:
                    data[key] = []
            else:
                # stored as base64, plain string, or comma-separated
                if value_str.startswith("data:image"):
                    data[key] = [value_str]
                elif "," in value_str:
                    data[key] = [v.strip() for v in value_str.split(",") if v.strip()]
                else:
                    data[key] = [value_str] if value_str else []

    # --- Compute agent responsiveness ---
    activity = "Inactive"
    last_active_iso = None

    if data.get("last_active"):
        last_active = data["last_active"]

        if isinstance(last_active, str):
            try:
                last_active = datetime.fromisoformat(last_active)
            except Exception:
                pass  # silently skip if format unexpected

        if isinstance(last_active, datetime):
            if last_active.tzinfo is None:
                last_active = last_active.replace(tzinfo=timezone.utc)
            
            diff_days = (datetime.now(timezone.utc) - last_active).days
            last_active_iso = last_active.isoformat()

            if diff_days <= 1:
                activity = "Highly responsive"
            elif diff_days <= 7:
                activity = "Active this week"
            else:
                activity = "Occasionally active"

    # --- Build agent subobject ---
    agent_info = {
        "id": data.get("agent_id"),
        "name": data.get("agent_name"),
        "status": data.get("agent_status"),
        "verified": str(data.get("agent_status")).lower() == "approved",
        "activity": activity,
        "last_active": last_active_iso,
    }

    # --- Merge back into response ---
    data["agent"] = agent_info
    data.pop("agent_name", None)
    data.pop("agent_status", None)
    data.pop("last_active", None)

    return jsonify(data)

# --- PROPERTIES (CRUD for agent properties) ---
#list properties by agent
@app.get("/api/properties")
def list_properties():
    agent_id = request.args.get("agent_id", type=int)
    status = request.args.get("status")

    query = """
        SELECT id, agent_id, title, property_type, description, price, bedrooms, bathrooms,
               size, location, latitude, longitude, photos, status,
               furnishing, floor_level, tenure, amenities, floor_plan, video_url,
               created_at, updated_at
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

    # If you're doing soft delete, add:
    # query += " AND is_deleted = FALSE"

    query += " ORDER BY created_at DESC"

    rows = query_all(query, params)
    return jsonify(rows)

# get individual property by id
@app.get("/api/properties/<int:prop_id>")
def get_property(prop_id):
    # --- Fetch property + agent info in one query ---
    row = query_all(
        """
        SELECT 
            p.id, p.agent_id, p.title, p.property_type, p.description, p.price,
            p.bedrooms, p.bathrooms, p.size, p.location, p.latitude, p.longitude,
            p.photos, p.status, p.furnishing, p.floor_level, p.tenure, p.amenities,
            p.floor_plan, p.video_url, p.created_at, p.updated_at,
            -- ✅ Include all AI and proximity fields
            p.region, p.property_type_final, p.floor_area_sqm, p.remaining_lease,
            p.nearest_mrt_km, p.nearest_school_km, p.nearest_mall_km, p.nearest_hospital_km,
            p.nearest_park_km, p.nearest_business_km, p.amenity_score, p.health_score,
            p.green_score, p.business_access_score, p.floor_level_num, p.year_completed,
            p.transaction_year, p.transaction_month, p.geo_cluster,
            u.name AS agent_name, u.status AS agent_status, u.last_active,

            -- === 🚀 ADDED THESE 6 LINES ===
            p.nearest_mrt_name,
            p.nearest_mall_name,
            p.nearest_school_name,
            p.nearest_hospital_name,
            p.nearest_park_name,
            p.nearest_business_name
            -- ==========================

        FROM properties p
        LEFT JOIN users u ON p.agent_id = u.id
        WHERE p.id = %s
        """,
        [prop_id],
    )

    if not row:
        return jsonify({"error": "Property not found"}), 404

    data = row[0]

    # ✅ Convert Decimal and JSON fields for React compatibility
    from decimal import Decimal
    for key, value in data.items():
        if isinstance(value, Decimal):
            data[key] = float(value)

        elif key in ("photos", "amenities") and isinstance(value, str):
            value_str = value.strip()

            # --- Handle Base64 or JSON-formatted images/lists ---
            if value_str.startswith("[") or value_str.startswith("{"):
                # stored as JSON text, decode
                try:
                    data[key] = json.loads(value_str)
                except json.JSONDecodeError:
                    data[key] = []
            else:
                # stored as base64 or plain string
                if value_str.startswith("data:image"):
                    data[key] = [value_str]
                elif "," in value_str:
                    # fallback: comma-separated list of items
                    data[key] = [v.strip() for v in value_str.split(",") if v.strip()]
                else:
                    # single plain string
                    data[key] = [value_str] if value_str else []

    # --- Compute agent responsiveness ---
    from datetime import datetime, timezone

    activity = "Inactive"
    last_active_iso = None

    if data.get("last_active"):
        last_active = data["last_active"]

        # Convert string, datetime if needed
        if isinstance(last_active, str):
            try:
                last_active = datetime.fromisoformat(last_active)
            except Exception:
                pass  # silently skip if format unexpected

        # Normalize to UTC if it's naive
        if isinstance(last_active, datetime) and last_active.tzinfo is None:
            last_active = last_active.replace(tzinfo=timezone.utc)

        diff_days = (datetime.now(timezone.utc) - last_active).days
        last_active_iso = last_active.isoformat()

        if diff_days <= 1:
            activity = "Highly responsive"
        elif diff_days <= 7:
            activity = "Active this week"
        else:
            activity = "Occasionally active"

    # --- Build agent subobject ---
    agent_info = {
        "id": data.get("agent_id"),
        "name": data.get("agent_name"),
        "status": data.get("agent_status"),
        "verified": str(data.get("agent_status")).lower() == "approved",
        "activity": activity,
        "last_active": last_active_iso,
    }

    # --- Merge back into response ---
    data["agent"] = agent_info
    data.pop("agent_name", None)
    data.pop("agent_status", None)
    data.pop("last_active", None)

    return jsonify(data)



#add property
# --- Add Property ---
@app.post("/api/properties")
@auth_required
def add_property():
    data = request.get_json(force=True)

    # === 1️⃣ Role validation ===
    user = get_current_user()
    if not user or user["role"] != "agent":
        return jsonify({"error": "Only agents can add properties"}), 403

    agent_id = user["id"]
    status = data.get("status", "Pending")

    # === 2️⃣ Handle arrays / JSON ===
    photos = data.get("photos")
    if isinstance(photos, list):
        photos = json.dumps(photos)  # store as JSON string

    amenities = data.get("amenities")
    if isinstance(amenities, list):
        amenities = json.dumps(amenities)  # ensure JSON-compatible for DB

    # === 3️⃣ Derived numeric fields ===
    size_sqft = float(data.get("size") or 0)
    floor_area_sqm = round(size_sqft * 0.092903, 2) if size_sqft > 0 else None

    price = float(data.get("price") or 0)
    price_per_sqm = round(price / floor_area_sqm, 2) if floor_area_sqm else None

    transaction_year = datetime.now().year
    transaction_month = datetime.now().month

    # === 4️⃣ Floor level numeric fallback ===
    level_map = {"low": 3, "mid": 8, "medium": 8, "high": 15, "penthouse": 25}
    floor_level_raw = str(data.get("floor_level") or "").lower().strip()
    floor_level_num = data.get("floor_level_num") or level_map.get(floor_level_raw, 8)

    # === 5️⃣ Year completed (user-provided OR computed from lease) ===
    current_year = datetime.now().year
    tenure_str = str(data.get("tenure") or "").lower()
    remaining_lease = float(data.get("remaining_lease") or 0)
    year_completed = data.get("year_completed")

    if not year_completed:
        if "99" in tenure_str and remaining_lease:
            year_completed = current_year - (99 - remaining_lease)
        elif "999" in tenure_str and remaining_lease:
            year_completed = current_year - (999 - remaining_lease)
        elif "freehold" in tenure_str:
            year_completed = current_year
        else:
            year_completed = current_year

    year_completed = int(year_completed)

    # === 6️⃣ Optional geo cluster string ===
    if data.get("latitude") and data.get("longitude"):
        lat = round(float(data["latitude"]), 2)
        lon = round(float(data["longitude"]), 2)
        geo_cluster = f"{lat}_{lon}"
    else:
        geo_cluster = None

    # === 7️⃣ Insert property ===
    # I have added the 6 new name fields to the query.
    row = execute(
        """
        INSERT INTO properties
        (
            agent_id, title, property_type, description, price, bedrooms, bathrooms, size, location,
            latitude, longitude, photos, status, furnishing, floor_level, tenure, amenities,
            floor_plan, video_url, region, property_type_final, floor_area_sqm, remaining_lease,
            nearest_mrt_km, nearest_school_km, amenity_score, health_score, green_score,
            transaction_year, transaction_month, nearest_mall_km, nearest_hospital_km,
            nearest_park_km, nearest_business_km, business_access_score, price_per_sqm,
            floor_level_num, year_completed, geo_cluster,
            
            -- === ADDED THESE 6 COLUMNS ===
            nearest_mrt_name, nearest_mall_name, nearest_school_name,
            nearest_hospital_name, nearest_park_name, nearest_business_name
        )
        VALUES (
            %s,%s,%s,%s,%s,%s,%s,%s,%s,
            %s,%s,%s,%s,%s,%s,%s,%s,
            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
            
            -- === ADDED THESE 6 PLACEHOLDERS ===
            %s, %s, %s, %s, %s, %s
        )
        RETURNING *;
        """,
        [
            agent_id,
            data.get("title"),
            data.get("property_type"),
            data.get("description"),
            data.get("price"),
            data.get("bedrooms"),
            data.get("bathrooms"),
            data.get("size"),
            data.get("location"),
            data.get("latitude"),
            data.get("longitude"),
            photos,
            status,
            data.get("furnishing"),
            data.get("floor_level"),
            data.get("tenure"),
            amenities,
            data.get("floor_plan"),
            data.get("video_url"),
            data.get("region"),
            data.get("property_type_final"),
            floor_area_sqm,
            data.get("remaining_lease"),
            data.get("nearest_mrt_km"),
            data.get("nearest_school_km"),
            data.get("amenity_score"),
            data.get("health_score"),
            data.get("green_score"),
            transaction_year,
            transaction_month,
            data.get("nearest_mall_km"),
            data.get("nearest_hospital_km"),
            data.get("nearest_park_km"),
            data.get("nearest_business_km"),
            data.get("business_access_score"),
            price_per_sqm,
            floor_level_num,
            year_completed,
            geo_cluster,

            # === ADDED THESE 6 VARIABLES ===
            data.get("nearest_mrt_name"),
            data.get("nearest_mall_name"),
            data.get("nearest_school_name"),
            data.get("nearest_hospital_name"),
            data.get("nearest_park_name"),
            data.get("nearest_business_name")
        ],
        return_row=True,
    )

    # === 8️⃣ Return result ===
    return jsonify({
        "message": "Property added successfully",
        "property_id": row["id"],
        "property": row
    }), 201




#edit property
@app.patch("/api/properties/edit/<int:prop_id>")
def update_property(prop_id):
    data = request.get_json(force=True)

    # === 1️⃣ Handle arrays / JSON ===
    photos = data.get("photos")
    if isinstance(photos, list):
        photos = json.dumps(photos)

    amenities = data.get("amenities")
    if isinstance(amenities, list):
        amenities = json.dumps(amenities)

    # === 2️⃣ Derived numeric fields ===
    size_sqft = float(data.get("size") or 0)
    floor_area_sqm = round(size_sqft * 0.092903, 2) if size_sqft > 0 else None

    price = float(data.get("price") or 0)
    price_per_sqm = round(price / floor_area_sqm, 2) if floor_area_sqm else None

    transaction_year = datetime.now().year
    transaction_month = datetime.now().month

    # === 3️⃣ Floor level mapping ===
    level_map = {"low": 3, "mid": 8, "medium": 8, "high": 15, "penthouse": 25}
    floor_level_raw = str(data.get("floor_level") or "").lower().strip()
    floor_level_num = data.get("floor_level_num") or level_map.get(floor_level_raw, 8)

    # === 4️⃣ Compute year completed ===
    current_year = datetime.now().year
    tenure_str = str(data.get("tenure") or "").lower()
    remaining_lease = float(data.get("remaining_lease") or 0)
    year_completed = data.get("year_completed")

    if not year_completed:
        if "99" in tenure_str and remaining_lease:
            year_completed = current_year - (99 - remaining_lease)
        elif "999" in tenure_str and remaining_lease:
            year_completed = current_year - (999 - remaining_lease)
        elif "freehold" in tenure_str:
            year_completed = current_year
        else:
            year_completed = current_year
    year_completed = int(year_completed)

    # === 5️⃣ Geo cluster (for ML features) ===
    if data.get("latitude") and data.get("longitude"):
        lat = round(float(data["latitude"]), 2)
        lon = round(float(data["longitude"]), 2)
        geo_cluster = f"{lat}_{lon}"
    else:
        geo_cluster = None

    # === 6️⃣ Prepare SQL update ===
    sql = """
        UPDATE properties
        SET
            title = %s,
            property_type = %s,
            description = %s,
            price = %s,
            bedrooms = %s,
            bathrooms = %s,
            size = %s,
            location = %s,
            latitude = %s,
            longitude = %s,
            photos = %s,
            status = %s,
            furnishing = %s,
            floor_level = %s,
            tenure = %s,
            amenities = %s,
            floor_plan = %s,
            video_url = %s,
            region = %s,
            property_type_final = %s,
            floor_area_sqm = %s,
            remaining_lease = %s,
            nearest_mrt_km = %s,
            nearest_school_km = %s,
            amenity_score = %s,
            health_score = %s,
            green_score = %s,
            transaction_year = %s,
            transaction_month = %s,
            nearest_mall_km = %s,
            nearest_hospital_km = %s,
            nearest_park_km = %s,
            nearest_business_km = %s,
            business_access_score = %s,
            price_per_sqm = %s,
            floor_level_num = %s,
            year_completed = %s,
            geo_cluster = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING *;
    """

    values = [
        data.get("title"),
        data.get("property_type"),
        data.get("description"),
        data.get("price"),
        data.get("bedrooms"),
        data.get("bathrooms"),
        data.get("size"),
        data.get("location"),
        data.get("latitude"),
        data.get("longitude"),
        photos,
        data.get("status", "Pending"),
        data.get("furnishing"),
        data.get("floor_level"),
        data.get("tenure"),
        amenities,
        data.get("floor_plan"),
        data.get("video_url"),
        data.get("region"),
        data.get("property_type_final"),
        floor_area_sqm,
        remaining_lease,
        data.get("nearest_mrt_km"),
        data.get("nearest_school_km"),
        data.get("amenity_score"),
        data.get("health_score"),
        data.get("green_score"),
        transaction_year,
        transaction_month,
        data.get("nearest_mall_km"),
        data.get("nearest_hospital_km"),
        data.get("nearest_park_km"),
        data.get("nearest_business_km"),
        data.get("business_access_score"),
        price_per_sqm,
        floor_level_num,
        year_completed,
        geo_cluster,
        prop_id,
    ]

    row = execute(sql, values, return_row=True)
    if not row:
        return jsonify({"error": "Property not found or update failed"}), 404

    return jsonify({
        "message": "Property updated successfully",
        "property": row
    })



#delete property
@app.delete("/api/properties/<int:prop_id>")
def delete_property(prop_id):
    row = execute(
        """
        UPDATE properties
        SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING id, status, is_deleted;
        """,
        [prop_id],
        return_row=True
    )
    if not row:
        return jsonify({"error": "Property not found"}), 404
    return jsonify({"message": "Property archived", "property": row})



# ---User Registration---
@app.post("/api/register_user")
#def register_user():
#    body = request.get_json(force=True) or {}
#    name = (body.get("name") or "").strip()
#    email = (body.get("email") or "").strip().lower()
#    phone = (body.get("phone") or "").strip()
#    role = (body.get("role") or "").strip().lower()
#    password = body.get("password") or ""
#
#    try:
#        with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
#            cur.execute(
#                """
#                INSERT INTO users
#                  (email, password_hash, name, role, phone)
#                VALUES (%s, crypt(%s, gen_salt('bf')), %s, %s, %s)
#                ON CONFLICT (email) DO NOTHING
#                RETURNING id, email, name, role, phone;
#                """,
#                (email, password, name, role, phone),
#            )
#            row = cur.fetchone()
#
#        if not row:
#            return jsonify({"ok": False, "error": "Email already exists"}), 409
#
#        # Build user dict from row
#        if isinstance(row, dict):
#            user = row
#        else:
#            user = {
#                "id": row[0],
#                "email": row[1],
#                "name": row[2],
#                "role": row[3],
#                "phone": row[4],
#            }
#
#        # TODO: generate real token here (JWT etc.)
#        return jsonify({"ok": True, "user": user, "token": None}), 201
#
#    except Exception as e:
#        import traceback
#        traceback.print_exc()
#        return jsonify({"ok": False, "error": str(e)}), 500

@app.post("/api/register_user")
def register_user():
    body = request.get_json(force=True) or {}
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    phone = (body.get("phone") or "").strip()
    role = (body.get("role") or "").strip().lower()
    password = body.get("password") or ""

    agency_name = (body.get("agency_name") or "").strip()
    cea_reg_no = (body.get("cea_reg_no") or "").strip().upper()
    agency_license_no = (body.get("agency_license_no") or "").strip().upper()
    years_experience = body.get("years_experience")
    id_last4 = (body.get("id_last4") or "").strip().upper()
    supporting_url = (body.get("supporting_url") or "").strip()

    is_agent = role == "agent"

    if is_agent:
        if not agency_name or not cea_reg_no or not agency_license_no:
            return jsonify({"error": "Missing agent verification details", "field": "agencyName"}), 400

        cea_pattern = re.compile(r"^R\d{6}[A-Z]$", re.IGNORECASE)
        lic_pattern = re.compile(r"^L\d{7}[A-Z]$", re.IGNORECASE)
        if not cea_pattern.match(cea_reg_no):
            return jsonify({"error": "Enter a valid CEA registration number (e.g. R123456X)", "field": "ceaRegNo"}), 400
        if not lic_pattern.match(agency_license_no):
            return jsonify({"error": "Enter a valid agency licence number (e.g. L7654321X)", "field": "agencyLicenseNo"}), 400

        try:
            years_experience = int(years_experience)
            if years_experience < 0 or years_experience > 60:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({"error": "Enter years of experience (0-60)", "field": "yearsExperience"}), 400

        if id_last4 and not re.match(r"^[STFG][0-9]{3}$", id_last4, re.IGNORECASE):
            return jsonify({"error": "Enter NRIC/FIN prefix + last 3 digits (e.g. S123)", "field": "idLast4"}), 400

    is_active = not is_agent
    status = "pending" if is_agent else "approved"

    try:
        with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO users
                  (email, password_hash, name, role, phone, is_active, status)
                VALUES (%s, crypt(%s, gen_salt('bf')), %s, %s, %s, %s, %s)
                ON CONFLICT (email) DO NOTHING
                RETURNING id, email, name, role, phone, is_active, status;
                """,
                (email, password, name, role, phone, is_active, status),
            )
            row = cur.fetchone()

            if not row:
                return jsonify({"ok": False, "error": "Email already exists"}), 409

            if isinstance(row, dict):
                user = row
            else:
                user = {
                    "id": row[0],
                    "email": row[1],
                    "name": row[2],
                    "role": row[3],
                    "phone": row[4],
                    "is_active": row[5],
                    "status": row[6],
                }

            if is_agent:
                cur.execute(
                    """
                    INSERT INTO agent_applications
                        (user_id, cea_reg_no, agency_name, agency_license_no, years_experience, id_last4, supporting_url)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE
                        SET cea_reg_no = EXCLUDED.cea_reg_no,
                            agency_name = EXCLUDED.agency_name,
                            agency_license_no = EXCLUDED.agency_license_no,
                            years_experience = EXCLUDED.years_experience,
                            id_last4 = EXCLUDED.id_last4,
                            supporting_url = EXCLUDED.supporting_url
                    """,
                    (
                        user["id"],
                        cea_reg_no,
                        agency_name,
                        agency_license_no,
                        years_experience,
                        id_last4 or None,
                        supporting_url or None,
                    ),
                )

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
    limit = request.args.get("limit", type=int)
    page = request.args.get("page", type=int)

    # Sensible defaults to keep payloads light
    if not limit or limit <= 0:
        limit = 20
    limit = min(limit, 100)

    if not page or page <= 0:
        page = 1
    offset = (page - 1) * limit

    query = """
        SELECT id, title, price, bedrooms, location, photos
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

    query += " ORDER BY id DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    rows = query_all(query, params)
    rows = query_all(query, params)

    # Decode photos JSON safely (so frontend gets arrays instead of raw strings)
    for row in rows:
        photos = row.get("photos")
        if photos:
            if isinstance(photos, str):
                try:
                    row["photos"] = json.loads(photos)
                except Exception:
                    row["photos"] = []
        else:
            row["photos"] = []

    return jsonify({"success": True, "items": rows, "page": page, "limit": limit})

# --- Saved properties (homeowner) ---
@app.get("/api/homeowner/saved")
@auth_required
def list_saved_properties():
    user_id = request.user["id"]
    rows = query_all(
        """
        SELECT p.id, p.title, p.price, p.bedrooms, p.location
        FROM saved_properties s
        JOIN properties p ON p.id = s.property_id
        WHERE s.user_id = %s
        ORDER BY s.created_at DESC
        """,
        [user_id],
    )
    return jsonify({"items": rows})

@app.post("/api/homeowner/saved/<int:prop_id>")
@auth_required
def add_saved_property(prop_id: int):
    user_id = request.user["id"]
    exists = query_all("SELECT id FROM properties WHERE id = %s", [prop_id])
    if not exists:
        return jsonify({"error": "Property not found"}), 404
    with get_cursor_cm() as cur:
        cur.execute(
            """
            INSERT INTO saved_properties (user_id, property_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, property_id) DO NOTHING
            RETURNING user_id, property_id
            """,
            [user_id, prop_id],
        )
        _ = cur.fetchone()
    return jsonify({"ok": True})

@app.delete("/api/homeowner/saved/<int:prop_id>")
@auth_required
def remove_saved_property(prop_id: int):
    user_id = request.user["id"]
    execute(
        "DELETE FROM saved_properties WHERE user_id = %s AND property_id = %s",
        [user_id, prop_id],
    )
    return jsonify({"ok": True})



# --- Homeowner preferences ---
@app.get("/api/homeowner/preferences")
@auth_required
def get_homeowner_preferences():
    if request.user.get("role") != "homeowner":
        return jsonify({"ok": True, "preferences": None})

    user_id = request.user["id"]
    row = query_one(
        "SELECT preferences FROM homeowner_preferences WHERE user_id = %s",
        [user_id],
    )
    prefs = row.get("preferences") if row else None
    return jsonify({"ok": True, "preferences": prefs})


@app.put("/api/homeowner/preferences")
@auth_required
def upsert_homeowner_preferences():
    if request.user.get("role") != "homeowner":
        return jsonify({"error": "Only homeowners can update preferences"}), 403

    user_id = request.user["id"]
    body = request.get_json(force=True) or {}
    normalized = normalize_homeowner_preferences(body.get("preferences") or body)

    execute(
        """
        INSERT INTO homeowner_preferences (user_id, preferences, updated_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET preferences = EXCLUDED.preferences,
                      updated_at = NOW()
        """,
        [user_id, json.dumps(normalized)],
    )
    return jsonify({"ok": True, "preferences": normalized})





# ---Add Dropdown Option---
#@app.post("/api/options/<option_type>")
#def add_dropdown_option(option_type):
#    body = request.get_json(force=True) or {}
#    name = (body.get("name") or "").strip()
#    status = (body.get("status") or "active").strip().lower()
#
#    if not name:
#        return jsonify({"ok": False, "error": "Name is required"}), 400
#
#    try:
#        with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
#            cur.execute(
#                """
#                INSERT INTO dropdown_options (type, name, status)
#                VALUES (%s, %s, %s)
#                RETURNING id, type, name, status;
#                """,
#                (option_type, name, status),
#            )
#            row = cur.fetchone()
#
#        option = {
#            "id": row[0],
#            "type": row[1],
#            "name": row[2],
#            "status": row[3],
#        }
#        return jsonify({"ok": True, "option": option}), 201
#
#    except Exception as e:
#        import traceback
#        traceback.print_exc()
#        return jsonify({"ok": False, "error": str(e)}), 500

@app.post("/api/options/<option_type>")
def add_dropdown_option(option_type):
    body = request.get_json(force=True) or {}
    name = (body.get("name") or "").strip()
    status = (body.get("status") or "active").strip().lower()

    if not name:
        return jsonify({"ok": False, "error": "Name is required"}), 400

    try:
        # use shared connection + RealDictCursor
        with get_cursor_cm() as cur:
            cur.execute(
                """
                INSERT INTO dropdown_options (type, name, status)
                VALUES (%s, %s, %s)
                RETURNING id, type, name, status;
                """,
                (option_type, name, status),
            )
            row = cur.fetchone()

        if not row:
            return jsonify({"ok": False, "error": "Insert failed"}), 500

        option = {
            "id": row["id"],
            "type": row["type"],
            "name": row["name"],
            "status": row["status"],
        }
        return jsonify({"ok": True, "option": option}), 201

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500


# ---Get Dropdown Options---
#@app.get("/api/options/<option_type>")
#def get_dropdown_options(option_type):
#    try:
#        with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
#            cur.execute(
#                """
#                SELECT id, name, status
#                FROM dropdown_options
#                WHERE type = %s
#                ORDER BY id ASC;
#                """,
#                (option_type,),
#            )
#            rows = cur.fetchall()
#
#        # rows are dicts, use keys
#        options = [
#            {"id": r["id"], "name": r["name"], "status": r["status"]}
#            for r in rows
#        ]
#
#        return jsonify({"ok": True, "options": options}), 200
#
#    except Exception as e:
#        import traceback
#        traceback.print_exc()
#        return jsonify({"ok": False, "error": str(e)}), 500

@app.get("/api/options/<option_type>")
def get_dropdown_options(option_type):
    try:
        with get_cursor_cm() as cur:
            cur.execute(
                """
                SELECT id, name, status
                FROM dropdown_options
                WHERE type = %s
                ORDER BY id ASC;
                """,
                (option_type,),
            )
            rows = cur.fetchall()

        # rows are dicts from RealDictCursor
        options = [
            {"id": r["id"], "name": r["name"], "status": r["status"]}
            for r in rows
        ]

        return jsonify({"ok": True, "options": options}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500


# ---Update Dropdown Option Status---
#@app.put("/api/options/<int:option_id>/status")
#def update_dropdown_status(option_id):
#    body = request.get_json(force=True) or {}
#    status = (body.get("status") or "").strip().lower()
#
#    if status not in ["active", "inactive"]:
#        return jsonify({"ok": False, "error": "Invalid status"}), 400
#
#    try:
#        with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
#            cur.execute(
#                """
#                UPDATE dropdown_options
#                SET status = %s
#                WHERE id = %s
#                RETURNING id, type, name, status;
#                """,
#                (status, option_id),
#            )
#            row = cur.fetchone()
#
#        if not row:
#            return jsonify({"ok": False, "error": "Option not found"}), 404
#
#        option = {
#            "id": row["id"],
#            "type": row["type"],
#            "name": row["name"],
#            "status": row["status"],
#        }
#        return jsonify({"ok": True, "option": option}), 200
#
#    except Exception as e:
#        import traceback
#        traceback.print_exc()
#        return jsonify({"ok": False, "error": str(e)}), 500

@app.put("/api/options/<int:option_id>/status")
def update_dropdown_status(option_id):
    body = request.get_json(force=True) or {}
    status = (body.get("status") or "").strip().lower()

    if status not in ("active", "inactive"):
        return jsonify({"ok": False, "error": "Invalid status"}), 400

    try:
        with get_cursor_cm() as cur:
            cur.execute(
                """
                UPDATE dropdown_options
                SET status = %s
                WHERE id = %s
                RETURNING id, type, name, status;
                """,
                (status, option_id),
            )
            row = cur.fetchone()

        if not row:
            return jsonify({"ok": False, "error": "Option not found"}), 404

        option = {
            "id": row["id"],
            "type": row["type"],
            "name": row["name"],
            "status": row["status"],
        }
        return jsonify({"ok": True, "option": option}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500


# create enquiry
@app.post("/api/enquiries")
def create_enquiry():
    body = request.get_json(force=True) or {}
    property_id = body.get("property_id")
    agent_id = body.get("agent_id")
    buyer_name = (body.get("buyer_name") or "").strip()
    buyer_email = (body.get("buyer_email") or "").strip()
    buyer_phone = (body.get("buyer_phone") or "").strip()
    message = (body.get("message") or "").strip()

    # simple validation
    if not (property_id and agent_id and buyer_name and buyer_email and message):
        return jsonify({"ok": False, "error": "Missing required fields"}), 400

    try:
        with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO enquiries (property_id, agent_id, buyer_name, buyer_email, buyer_phone, message)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, property_id, agent_id, buyer_name, buyer_email, buyer_phone, message, status, created_at;
                """,
                (property_id, agent_id, buyer_name, buyer_email, buyer_phone, message),
            )
            row = cur.fetchone()
            conn.commit()

        enquiry = {
            "id": row["id"],
            "property_id": row["property_id"],
            "agent_id": row["agent_id"],
            "buyer_name": row["buyer_name"],
            "buyer_email": row["buyer_email"],
            "buyer_phone": row["buyer_phone"],
            "message": row["message"],
            "status": row["status"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
        return jsonify({"ok": True, "enquiry": enquiry}), 201

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

# get enquiries for agent and fliter enquiries by status
@app.get("/api/enquiries/agent/<int:agent_id>")
def get_agent_enquiries(agent_id):
    try:
        # Get optional status filter (e.g., /api/enquiries/agent/5?status=Pending)
        status_filter = request.args.get("status")

        with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Base query
            base_query = """
                SELECT e.id, e.property_id, p.title AS property_title,
                       e.buyer_name, e.buyer_email, e.buyer_phone,
                       e.message, e.status, e.created_at
                FROM enquiries e
                JOIN properties p ON e.property_id = p.id
                WHERE e.agent_id = %s
            """
            params = [agent_id]

            # Apply filter only if provided and not "All"
            if status_filter and status_filter.lower() != "all":
                base_query += " AND e.status = %s"
                params.append(status_filter)

            base_query += " ORDER BY e.created_at DESC;"
            cur.execute(base_query, params)
            rows = cur.fetchall()

        # Convert timestamps to Singapore time (UTC+8)
        SGT = timezone(timedelta(hours=8))

        enquiries = [
            {
                "id": r["id"],
                "property_id": r["property_id"],
                "property_title": r["property_title"],
                "buyer_name": r["buyer_name"],
                "buyer_email": r["buyer_email"],
                "buyer_phone": r["buyer_phone"],
                "message": r["message"],
                "status": r["status"],
                "created_at": r["created_at"]
                    .replace(tzinfo=timezone.utc)
                    .astimezone(SGT)
                    .strftime("%Y-%m-%d %H:%M:%S"),
            }
            for r in rows
        ]

        return jsonify({"ok": True, "enquiries": enquiries}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

# ---Update Enquiry Status---
@app.put("/api/enquiries/<int:enquiry_id>/status")
def update_enquiry_status(enquiry_id):
    body = request.get_json(force=True) or {}
    new_status = (body.get("status") or "").strip().capitalize()

    if new_status not in ["Pending", "Contacted", "Closed"]:
        return jsonify({"ok": False, "error": "Invalid status"}), 400

    try:
        with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE enquiries
                SET status = %s
                WHERE id = %s
                RETURNING id, property_id, agent_id, buyer_id, status;
                """,
                (new_status, enquiry_id),
            )
            row = cur.fetchone()
            conn.commit()

        if not row:
            return jsonify({"ok": False, "error": "Enquiry not found"}), 404

        enquiry = {
            "id": row["id"],
            "property_id": row["property_id"],
            "agent_id": row["agent_id"],
            "buyer_id": row["buyer_id"],
            "status": row["status"],
        }

        return jsonify({"ok": True, "enquiry": enquiry}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

# ---Get Chat Messages---
@app.get("/api/chat/<int:enquiry_id>")
def get_chat_messages(enquiry_id):
    try:
        with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, enquiry_id, sender_id, message, created_at
                FROM chat_messages
                WHERE enquiry_id = %s
                ORDER BY created_at ASC;
                """,
                (enquiry_id,),
            )
            rows = cur.fetchall()

        messages = [
            {
                "id": r["id"],
                "enquiry_id": r["enquiry_id"],
                "sender_id": r["sender_id"],
                "message": r["message"],
                "created_at": r["created_at"].strftime("%Y-%m-%d %H:%M:%S"),
            }
            for r in rows
        ]

        return jsonify({"ok": True, "messages": messages}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

# ---Add Chat Message---
@app.post("/api/chat")
def add_chat_message():
    try:
        data = request.get_json()
        enquiry_id = data.get("enquiry_id")
        sender_id = data.get("sender_id")
        message = data.get("message")

        if not enquiry_id or not sender_id or not message:
            return jsonify({"ok": False, "error": "Missing required fields"}), 400

        with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            # === Insert chat message ===
            cur.execute(
                """
                INSERT INTO chat_messages (enquiry_id, sender_id, message, created_at)
                VALUES (%s, %s, %s, NOW())
                RETURNING id;
                """,
                (enquiry_id, sender_id, message),
            )
            new_id = cur.fetchone()["id"]
            conn.commit()

        # === Fetch context info ===
        with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT 
                    e.property_id,
                    e.agent_id,
                    e.buyer_id,
                    a.name  AS agent_name,
                    a.email AS agent_email,
                    b.name  AS buyer_name,
                    b.email AS buyer_email,
                    p.title AS property_title
                FROM enquiries e
                JOIN users a ON e.agent_id = a.id
                JOIN users b ON e.buyer_id = b.id
                JOIN properties p ON e.property_id = p.id
                WHERE e.id = %s;
                """,
                (enquiry_id,),
            )
            info = cur.fetchone()

        # === Check if this is agent's first message ===
        should_send_email = False
        if info and info["agent_id"] == sender_id:
            with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT COUNT(*) AS msg_count
                    FROM chat_messages
                    WHERE enquiry_id = %s AND sender_id = %s;
                    """,
                    (enquiry_id, sender_id),
                )
                count_row = cur.fetchone()
                msg_count = count_row["msg_count"]

            if msg_count == 1:
                should_send_email = True

        # === Send email if agent's first message ===
        if should_send_email:
            print(f"📧 Sending first message email to {info['buyer_email']}...")
            send_chat_email_to_buyer(
                buyer_name=info["buyer_name"],
                buyer_email=info["buyer_email"],
                agent_name=info["agent_name"],
                property_title=info["property_title"],
                message=message,
            )

        return jsonify({"ok": True, "id": new_id}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

 #get enquiry tied to buyer
@app.get("/api/enquiries/buyer/<int:buyer_id>")
def get_buyer_enquiries(buyer_id):
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT 
                        e.id AS enquiry_id,
                        e.property_id,
                        e.status,
                        e.message,
                        e.created_at,
                        p.title AS property_title,
                        p.location,
                        p.price,
                        p.bedrooms,
                        u.name AS agent_name,
                        u.email AS agent_email
                    FROM enquiries e
                    JOIN properties p ON e.property_id = p.id
                    JOIN users u ON e.agent_id = u.id
                        AND LOWER(u.role) = 'agent'
                    WHERE e.buyer_id = %s
                    ORDER BY e.created_at DESC;
                    """,
                    (buyer_id,),
                )
                rows = cur.fetchall()

        return jsonify({"ok": True, "count": len(rows), "enquiries": rows})

    except Exception as e:
        print("❌ Error fetching buyer enquiries:", e)
        return jsonify({"ok": False, "error": str(e)}), 500

def send_chat_email_to_buyer(buyer_name, buyer_email, agent_name, property_title, message):
    sender_email = "lorryleeziyun@gmail.com"
    subject = f"Agent {agent_name} has sent you a message about {property_title}"

    # === HTML template ===
    html_body = f"""
    <html>
      <body style="margin:0; padding:0; font-family: 'Segoe UI', Arial, sans-serif; background-color:#f4f4f4;">
        <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.05);">
          <!-- Header -->
          <div style="background-color:#00674f;padding:20px 30px;text-align:center;">
            <img src="https://i.ibb.co/hXrL5WL/aspect-logo.png" alt="Aspect Real Estate" style="max-height:50px;"/>
          </div>

          <!-- Content -->
          <div style="padding:30px 40px;color:#333333;">
            <h2 style="color:#00674f;">New Message from {agent_name}</h2>
            <p style="font-size:15px;line-height:1.6;color:#444444;">
              Hi <b>{buyer_name}</b>,
              <br><br>
              Agent <b>{agent_name}</b> has sent you a new message regarding your enquiry for:
              <br>
              <b>"{property_title}"</b>
            </p>

            <div style="background:#f9faf9;border-left:4px solid #00674f;padding:15px 20px;margin:25px 0;border-radius:6px;">
              <p style="font-size:15px;line-height:1.6;margin:0;color:#333;">
                {message}
              </p>
            </div>

            <p style="font-size:15px;line-height:1.6;color:#444444;">
              You can reply to this message directly in your Aspect Real Estate dashboard.
            </p>

            <div style="text-align:center;margin-top:30px;">
              <a href="https://aspect-realestate.com/login"
                 style="background-color:#00674f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;display:inline-block;">
                View Message
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color:#f9faf9;text-align:center;padding:15px 20px;font-size:13px;color:#777777;">
            <p>© 2025 Aspect Real Estate. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
    """

    # === Plain text fallback ===
    plain_body = f"""
    Hi {buyer_name},

    Agent {agent_name} has sent you a message about "{property_title}".

    Message:
    {message}

    You can reply from your Aspect Real Estate dashboard:
    https://aspect-realestate.com/login
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender_email
    msg["To"] = buyer_email
    msg.attach(MIMEText(plain_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login("lorryleeziyun@gmail.com", "LOrr@12345!!") 
            server.sendmail(sender_email, buyer_email, msg.as_string())

        print(f"chat email sent to {buyer_email}")
    except Exception as e:
        print(f"Failed to send chat email: {e}")

# --- ✅ START: COMPREHENSIVE LOCATION HOTFIX (V6 - Final) ---
# This function fixes all contradictory location features at once.

def get_hotfixed_location(lat, lon, prop_type, original_region):
    """
    Checks if a property is in a mis-trained prime zone.
    If yes, returns a dictionary with ALL fixed location features
    (region, geo_cluster) to prevent contradictions.
    """
    
    # 1. Create the default (original) feature set
    original_lat_cluster = round(lat, 2)
    original_lon_cluster = round(lon, 2)
    
    # This is the baseline
    hotfixed_features = {
        "region": original_region.title(),
        "geo_cluster": f"{original_lat_cluster}_{original_lon_cluster}"
    }

    # Only apply this logic to HDBs
    if prop_type != "HDB":
        return hotfixed_features # Return original values

    print(f"\n--- [HOTFIX_DEBUG] ---")
    print(f"[HOTFIX_DEBUG] Checking HDB at lat: {lat}, lon: {lon}")

    # --- Bounding Box Definitions ---
    TIONG_BAHRU_BOUNDS = {"min_lat": 1.280, "max_lat": 1.290, "min_lon": 103.825, "max_lon": 103.835}
    CLEMENTI_BOUNDS = {"min_lat": 1.310, "max_lat": 1.318, "min_lon": 103.760, "max_lon": 103.768}
    ANG_MO_KIO_BOUNDS = {"min_lat": 1.368, "max_lat": 1.375, "min_lon": 103.844, "max_lon": 103.852}
    # ... (add your other boxes here) ...

    # --- Logic ---

    # Check Tiong Bahru
    if (TIONG_BAHRU_BOUNDS["min_lat"] <= lat <= TIONG_BAHRU_BOUNDS["max_lat"] and
        TIONG_BAHRU_BOUNDS["min_lon"] <= lon <= TIONG_BAHRU_BOUNDS["max_lon"]):
        
        print(f"[HOTFIX_DEBUG] MATCHED: Tiong Bahru Box.")
        print(f"[HOTFIX_DEBUG] Overriding Region -> 'Bukit Merah'")
        print(f"[HOTFIX_DEBUG] Overriding GeoCluster -> '1.29_103.82' (A real BM cluster)")
        print(f"--- [END HOTFIX_DEBUG] ---\n")
        
        # Override ALL contradictory features
        hotfixed_features["region"] = "Bukit Merah"
        # We use a KNOWN "Bukit Merah" cluster (e.g., from 116 Bukit Merah View)
        hotfixed_features["geo_cluster"] = "1.29_103.82" 
        return hotfixed_features

    # Check Clementi
    if (CLEMENTI_BOUNDS["min_lat"] <= lat <= CLEMENTI_BOUNDS["max_lat"] and
        CLEMENTI_BOUNDS["min_lon"] <= lon <= CLEMENTI_BOUNDS["max_lon"]):
        
        print(f"[HOTFIX_DEBUG] MATCHED: Clementi Box.")
        print(f"[HOTFIX_DEBUG] Overriding Region -> 'Queenstown'")
        print(f"[HOTFIX_DEBUG] Overriding GeoCluster -> '1.31_103.78' (A real QT cluster)")
        print(f"--- [END HOTFIX_DEBUG] ---\n")
        
        hotfixed_features["region"] = "Queenstown"
        hotfixed_features["geo_cluster"] = "1.31_103.78" # A known Queenstown cluster
        return hotfixed_features
        
    # ... (add other 'if' blocks for AMK, etc.) ...

    # Default: Not in a special box
    print(f"[HOTFIX_DEBUG] NO MATCH: No bounding box hit. Using original features.")
    print(f"--- [END HOTFIX_DEBUG] ---\n")
    return hotfixed_features

# --- ✅ END: COMPREHENSIVE LOCATION HOTFIX (V6) ---

# ============================================================
# Predict Current Resale Price (v12 pipeline – with DB insert)
# ============================================================
@app.post("/api/predict/current")
def predict_current_price_v12():
    """
    Predicts *current market price* using the trained v12 LightGBM pipeline.
    Includes: location hotfix (V6) + localized correction multiplier (V1).
    """
    if pipeline is None:
        return jsonify({"error": "v12 pipeline not loaded."}), 503

    body = request.get_json(force=True) or {}
    print(f"Incoming JSON Body (/predict/current v12): {body}")

    try:
        # --- 1️⃣ Parse Inputs ---
        floor_area_sqm = float(body.get("floor_area_sqm") or 75)
        region_str = str(body.get("region") or "Central").title()
        prop_type_raw = str(body.get("property_type_final") or body.get("property_type") or "Condominium")
        tenure_raw = str(body.get("tenure") or "99-year Leasehold")

        def normalize_prop_type(v):
            v = v.upper()
            if "HDB" in v or "FLAT" in v or "EXECUTIVE" in v: return "HDB"
            if "CONDO" in v or "APARTMENT" in v: return "Condominium"
            if "TERRACE" in v or "LANDED" in v or "SEMI" in v: return "Landed"
            return "Other"
        prop_type = normalize_prop_type(prop_type_raw)

        def normalize_tenure(v):
            v = v.lower()
            if "freehold" in v: return "Freehold"
            if "999" in v: return "999-year"
            return "99-year Leasehold"
        tenure_str = normalize_tenure(tenure_raw)

        latitude = float(body.get("latitude") or 1.35)
        longitude = float(body.get("longitude") or 103.82)

        # --- ✅ HOTFIX (V6) ---
        location_features = get_hotfixed_location(latitude, longitude, prop_type, region_str)
        region_for_model = location_features["region"]
        geo_cluster_for_model = location_features["geo_cluster"]

        nearest_mrt_km = float(body.get("nearest_mrt_km") or 0.8)
        nearest_mall_km = float(body.get("nearest_mall_km") or 1.5)
        nearest_school_km = float(body.get("nearest_school_km") or 1.0)
        nearest_hospital_km = float(body.get("nearest_hospital_km") or 2.0)
        nearest_park_km = float(body.get("nearest_park_km") or 1.2)
        amenity_score = float(body.get("amenity_score") or 5.0)
        remaining_lease = float(body.get("remaining_lease") or 90)
        year_completed = int(body.get("year_completed") or 2010)

        transaction_year = datetime.now().year
        transaction_month = datetime.now().month
        property_age = max(0, transaction_year - year_completed)

        remaining_lease_adj = 999 if tenure_str != "99-year Leasehold" else remaining_lease
        year_sin = np.sin(2 * np.pi * transaction_month / 12)
        year_cos = np.cos(2 * np.pi * transaction_month / 12)
        amenity_density = 1 / (nearest_mrt_km + nearest_mall_km +
                               nearest_school_km + nearest_hospital_km + 1)
        mrt_x_area = nearest_mrt_km * floor_area_sqm
        mall_x_school = nearest_mall_km * nearest_school_km

        prop_region_combo = f"{prop_type}_{region_for_model}"
        is_prime_hdb = (prop_type == "HDB") and (region_for_model.upper() in PRIME_HDB_LOCATIONS)
        prime_town_flag = "Prime_HDB_Area" if is_prime_hdb else "Other_Area"

        input_data = {
            "floor_area_sqm": floor_area_sqm,
            "remaining_lease_adj": remaining_lease_adj,
            "property_age": property_age,
            "nearest_mrt_km": nearest_mrt_km,
            "nearest_mall_km": nearest_mall_km,
            "nearest_school_km": nearest_school_km,
            "nearest_hospital_km": nearest_hospital_km,
            "nearest_park_km": nearest_park_km,
            "amenity_score": amenity_score,
            "transaction_year": transaction_year,
            "transaction_month": transaction_month,
            "year_sin": year_sin,
            "year_cos": year_cos,
            "amenity_density": amenity_density,
            "mrt_x_area": mrt_x_area,
            "mall_x_school": mall_x_school,
            "region": region_for_model,
            "property_category": prop_type,
            "tenure_clean": tenure_str,
            "geo_cluster": geo_cluster_for_model,
            "prop_region_combo": prop_region_combo,
            "prime_town_flag": prime_town_flag,
        }
        X_input = pd.DataFrame([input_data], columns=MODEL_FEATURES)

        # --- 2️⃣ Predict ---
        pred_log = pipeline.predict(X_input)[0]
        predicted_price = float(np.expm1(pred_log))
        predicted_price_per_sqm = predicted_price / floor_area_sqm

        # --- ✅ LOCATION CORRECTION MULTIPLIER (inline) ---
        ADJUSTMENTS = {
            "Tiong Bahru": 1.60,   # +60%
            "Bukit Merah": 1.50,   # +50%
            "Queenstown": 1.20
        }
        applied_multiplier = 1.0
        if region_for_model in ADJUSTMENTS:
            applied_multiplier = ADJUSTMENTS[region_for_model]
        if 1.280 <= latitude <= 1.290 and 103.825 <= longitude <= 103.835:  # Tiong Bahru box
            applied_multiplier = max(applied_multiplier, 1.60)

        if applied_multiplier != 1.0:
            old_price = predicted_price
            predicted_price *= applied_multiplier
            print(f"[LOC_ADJ] Applied {applied_multiplier:.2f}× for {region_for_model} "
                  f"({old_price:,.0f} → {predicted_price:,.0f})")

        # --- 3️⃣ Confidence ---
        confidence_base = 0.88
        volatility_factor = 1 - np.exp(-0.1 * property_age / 10)
        confidence_score = round(max(55.0, (confidence_base - volatility_factor * 0.15) * 100), 1)
        conf_margin = (100 - confidence_score) / 100
        conf_low = predicted_price * (1 - conf_margin)
        conf_high = predicted_price * (1 + conf_margin)

        # --- 4️⃣ DB Insert ---
        with get_cursor_cm() as cur:
            cur.execute("""
                INSERT INTO predictions (
                    property_id, user_id, model_type, predicted_current,
                    confidence_low, confidence_high, confidence_score,
                    input_data, created_at
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, [
                body.get("property_id"),
                body.get("user_id"),
                "current_price_v12_pipeline",
                float(predicted_price),
                float(conf_low),
                float(conf_high),
                float(confidence_score / 100),
                json.dumps(X_input.to_dict(), default=str),
                datetime.now(),
            ])

        # --- 5️⃣ Return ---
        return jsonify({
            "model": "current_price_v12_pipeline",
            "predicted_total_price": round(predicted_price, 2),
            "predicted_price_per_sqm": round(predicted_price_per_sqm, 2),
            "confidence_low": round(conf_low, 2),
            "confidence_high": round(conf_high, 2),
            "confidence_score": confidence_score,
            "region": region_str,
            "property_type": prop_type,
            "tenure": tenure_str,
            "applied_location_adjustment": applied_multiplier,
            "timestamp": datetime.now().isoformat(),
        })

    except Exception as e:
        print(f"[PredictCurrentErrorV12] {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ============================================================
# Predict Future Resale Price (v12 pipeline – with DB insert)
# ============================================================
@app.post("/api/predict/future")
def predict_future_resale_v12():
    """
    Predicts *future resale price* using v12 LightGBM pipeline.
    Includes: location hotfix (V6) + localized correction multiplier (V1).
    """
    if pipeline is None:
        return jsonify({"error": "v12 pipeline not loaded."}), 503

    body = request.get_json(force=True) or {}
    print(f"Incoming JSON Body (/predict/future v12): {body}")

    try:
        # --- 1️⃣ Parse Inputs ---
        floor_area_sqm = float(body.get("floor_area_sqm") or 75)
        region_str = str(body.get("region") or "Central").title()
        prop_type_raw = str(body.get("property_type_final") or body.get("property_type") or "Condominium")
        tenure_raw = str(body.get("tenure") or "99-year Leasehold")

        def normalize_prop_type(v):
            v = v.upper()
            if "HDB" in v or "FLAT" in v or "EXECUTIVE" in v: return "HDB"
            if "CONDO" in v or "APARTMENT" in v: return "Condominium"
            if "TERRACE" in v or "LANDED" in v or "SEMI" in v: return "Landed"
            return "Other"
        prop_type = normalize_prop_type(prop_type_raw)

        def normalize_tenure(v):
            v = v.lower()
            if "freehold" in v: return "Freehold"
            if "999" in v: return "999-year"
            return "99-year Leasehold"
        tenure_str = normalize_tenure(tenure_raw)

        latitude = float(body.get("latitude") or 1.35)
        longitude = float(body.get("longitude") or 103.82)

        # --- HOTFIX (V6) ---
        location_features = get_hotfixed_location(latitude, longitude, prop_type, region_str)
        region_for_model = location_features["region"]
        geo_cluster_for_model = location_features["geo_cluster"]

        nearest_mrt_km = float(body.get("nearest_mrt_km") or 0.8)
        nearest_mall_km = float(body.get("nearest_mall_km") or 1.5)
        nearest_school_km = float(body.get("nearest_school_km") or 1.0)
        nearest_hospital_km = float(body.get("nearest_hospital_km") or 2.0)
        nearest_park_km = float(body.get("nearest_park_km") or 1.2)
        amenity_score = float(body.get("amenity_score") or 5.0)
        remaining_lease = float(body.get("remaining_lease") or 90)
        year_completed = int(body.get("year_completed") or 2010)

        transaction_year = datetime.now().year
        transaction_month = datetime.now().month
        property_age = max(0, transaction_year - year_completed)

        remaining_lease_adj = 999 if tenure_str != "99-year Leasehold" else remaining_lease
        year_sin = np.sin(2 * np.pi * transaction_month / 12)
        year_cos = np.cos(2 * np.pi * transaction_month / 12)
        amenity_density = 1 / (nearest_mrt_km + nearest_mall_km +
                               nearest_school_km + nearest_hospital_km + 1)
        mrt_x_area = nearest_mrt_km * floor_area_sqm
        mall_x_school = nearest_mall_km * nearest_school_km

        prop_region_combo = f"{prop_type}_{region_for_model}"
        is_prime_hdb = (prop_type == "HDB") and (region_for_model.upper() in PRIME_HDB_LOCATIONS)
        prime_town_flag = "Prime_HDB_Area" if is_prime_hdb else "Other_Area"

        input_data = {
            "floor_area_sqm": floor_area_sqm,
            "remaining_lease_adj": remaining_lease_adj,
            "property_age": property_age,
            "nearest_mrt_km": nearest_mrt_km,
            "nearest_mall_km": nearest_mall_km,
            "nearest_school_km": nearest_school_km,
            "nearest_hospital_km": nearest_hospital_km,
            "nearest_park_km": nearest_park_km,
            "amenity_score": amenity_score,
            "transaction_year": transaction_year,
            "transaction_month": transaction_month,
            "year_sin": year_sin,
            "year_cos": year_cos,
            "amenity_density": amenity_density,
            "mrt_x_area": mrt_x_area,
            "mall_x_school": mall_x_school,
            "region": region_for_model,
            "property_category": prop_type,
            "tenure_clean": tenure_str,
            "geo_cluster": geo_cluster_for_model,
            "prop_region_combo": prop_region_combo,
            "prime_town_flag": prime_town_flag,
        }
        X_input = pd.DataFrame([input_data], columns=MODEL_FEATURES)

        # --- 2️⃣ Predict Base ---
        pred_log = pipeline.predict(X_input)[0]
        base_price = float(np.expm1(pred_log))

        # --- LOCATION MULTIPLIER ---
        ADJUSTMENTS = {
            "Tiong Bahru": 1.60,
            "Bukit Merah": 1.50,
            "Queenstown": 1.20
        }
        applied_multiplier = 1.0
        if region_for_model in ADJUSTMENTS:
            applied_multiplier = ADJUSTMENTS[region_for_model]
        if 1.280 <= latitude <= 1.290 and 103.825 <= longitude <= 103.835:
            applied_multiplier = max(applied_multiplier, 1.60)

        if applied_multiplier != 1.0:
            old_price = base_price
            base_price *= applied_multiplier
            print(f"[LOC_ADJ] Applied {applied_multiplier:.2f}× for {region_for_model} "
                  f"({old_price:,.0f} → {base_price:,.0f})")

        # --- 3️⃣ Growth ---
        YEARS_FORWARD = float(body.get("years_forward") or 3)
        growth_key = f"{prop_type}_{region_for_model}"
        default_growth = np.mean(list(GROWTH_RATES.values())) if GROWTH_RATES else 0.045
        ANNUAL_GROWTH_RATE = GROWTH_RATES.get(growth_key, default_growth)
        predicted_future_price = base_price * ((1 + ANNUAL_GROWTH_RATE) ** YEARS_FORWARD)

        # --- 4️⃣ Confidence ---
        confidence_base = 0.86
        volatility_factor = 1 - np.exp(-0.1 * property_age / 10)
        confidence_score = round(max(50.0, (confidence_base - volatility_factor * 0.2) * 100), 1)
        conf_margin = (100 - confidence_score) / 100
        conf_low = predicted_future_price * (1 - conf_margin)
        conf_high = predicted_future_price * (1 + conf_margin)

        # --- 5️⃣ DB Insert ---
        with get_cursor_cm() as cur:
            cur.execute("""
                INSERT INTO predictions (
                    property_id, user_id, model_type, predicted_price,
                    confidence_low, confidence_high, confidence_score,
                    input_data, created_at
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, [

                body.get("property_id"),
                body.get("user_id"),
                "future_resale_v12_pipeline",
                float(predicted_future_price),
                float(conf_low),
                float(conf_high),
                float(confidence_score / 100),
                json.dumps(X_input.to_dict(), default=str),
                datetime.now(),
            ])

        # --- 6️⃣ Return ---
        return jsonify({
            "model": "future_resale_v12_pipeline",
            "floor_area_sqm": round(floor_area_sqm, 2),
            "years_forward": YEARS_FORWARD,
            "predicted_total_price": round(predicted_future_price, 2),
            "predicted_price_per_sqm": round(predicted_future_price / floor_area_sqm, 2),
            "confidence_low": round(conf_low, 2),
            "confidence_high": round(conf_high, 2),
            "confidence_score": confidence_score,
            "annual_growth_rate": f"{ANNUAL_GROWTH_RATE*100:.2f}%",
            "market_trend": f"Projected {YEARS_FORWARD:.0f}-year resale appreciation at {ANNUAL_GROWTH_RATE*100:.2f}% annually.",
            "applied_location_adjustment": applied_multiplier,
            "timestamp": datetime.now().isoformat(),
        })

    except Exception as e:
        print(f"[PredictFutureErrorV12] {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500





# ============================================================
#  Get Prediction History for Logged-in User (Frontend Friendly)
# ============================================================
@app.get("/api/predict/history")
def get_prediction_history():
    user_id = request.args.get("user_id")

    try:
        if not user_id:
            return jsonify({"error": "Missing user_id"}), 400

        with get_cursor_cm() as cur:
            cur.execute("""
                SELECT 
                    id,
                    model_type,
                    predicted_price,
                    confidence_low,
                    confidence_high,
                    confidence_score,
                    input_data,
                    created_at
                FROM predictions
                WHERE user_id = %s
                ORDER BY created_at DESC
            """, [user_id])
            rows = cur.fetchall()

        if not rows:
            return jsonify({"message": "No predictions found"}), 200

        history = []
        for r in rows:
            history.append({
                "id": r["id"],
                "model_type": r["model_type"],
                "predicted_price": f"${r['predicted_price']:,.2f}" if r["predicted_price"] else "N/A",
                "confidence_range": f"${r['confidence_low']:,.2f} – ${r['confidence_high']:,.2f}"
                    if r["confidence_low"] and r["confidence_high"] else "N/A",
                "ai_confidence": f"{(r['confidence_score'] or 0) * 100:.0f}%",
                "market_trend": "Market steady with potential growth",  # placeholder (same as /api/predict/future)
                "input": r["input_data"],
                "created_at": r["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            })

        return jsonify({"history": history}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.get("/api/predictions/property/<int:property_id>")
def get_predictions_by_property(property_id):
    """
    Returns all prediction records for a given property_id.
    Used by PropertyDetails.jsx to display saved AI insights.
    """
    try:
        with get_cursor_cm() as cur:
            cur.execute("""
                SELECT 
                    id,
                    property_id,
                    user_id,
                    email,
                    model_type,
                    predicted_price,
                    confidence_low,
                    confidence_high,
                    confidence_score,
                    input_data,
                    created_at,
                    predicted_current
                FROM predictions
                WHERE property_id = %s
                ORDER BY created_at DESC
            """, [property_id])
            rows = cur.fetchall()

        # Convert rows to JSON serializable format
        return jsonify(rows), 200

    except Exception as e:
        print(f"❌ Error fetching predictions for property {property_id}: {e}")
        return jsonify({"error": str(e)}), 500

# ============================================================
#  Get Prediction History for Nearby Properties (FINAL, FILTERED)
# ============================================================
@app.post("/api/predict/history/nearby")
def get_predictions_near_location():
    """
    Fetch prediction history for properties within ~1 km of the given lat/lng.
    FILTERS to show ONLY 'current' price predictions.
    """
    try:
        body = request.get_json(force=True) or {}
        lat = float(body.get("latitude", 0))
        lng = float(body.get("longitude", 0))

        if not lat or not lng:
            return jsonify({"error": "Missing latitude or longitude"}), 400

        with get_cursor_cm() as cur:
            sql = """
                SELECT 
                    p.id AS property_id,
                    p.price AS listed_price,
                    pr.model_type,
                    pr.predicted_current, -- We only care about this one now
                    pr.confidence_low,
                    pr.confidence_high,
                    pr.confidence_score,
                    pr.created_at,
                    (6371 * acos(
                        cos(radians(%s)) * cos(radians(p.latitude)) *
                        cos(radians(p.longitude) - radians(%s)) +
                        sin(radians(%s)) * sin(radians(p.latitude))
                    )) AS distance_km
                FROM predictions pr
                JOIN properties p ON pr.property_id = p.id
                WHERE p.latitude IS NOT NULL 
                  AND p.longitude IS NOT NULL
                  -- ✅ 1. THIS IS THE FIX: Only get 'current' model predictions
                  AND pr.model_type LIKE '%%current%%' 
                  AND (6371 * acos(
                        cos(radians(%s)) * cos(radians(p.latitude)) *
                        cos(radians(p.longitude) - radians(%s)) +
                        sin(radians(%s)) * sin(radians(p.latitude))
                    )) <= 1.0  -- Filter for 1km
                ORDER BY pr.created_at DESC
                LIMIT 20
            """
            
            params = [lat, lng, lat, lat, lng, lat]
            cur.execute(sql, params)

            rows = cur.fetchall()

        if not rows:
            return jsonify({"history": []}), 200 # Return empty list, not message

        history = []
        for r in rows:
            # --- ✅ 2. SIMPLIFIED: We know we only have predicted_current ---
            price_val = r.get('predicted_current') 
            price_str = "N/A"
            if price_val is not None:
                try:
                    price_str = f"${float(price_val):,.2f}"
                except (ValueError, TypeError):
                    price_str = "N/A" 

            listed_price_str = "N/A"
            if r.get("listed_price") is not None:
                try:
                    listed_price_str = f"${float(r['listed_price']):,.2f}"
                except (ValueError, TypeError):
                    listed_price_str = "N/A"

            range_str = "N/A"
            if r.get("confidence_low") is not None and r.get("confidence_high") is not None:
                try:
                    range_str = f"${float(r['confidence_low']):,.2f} – ${float(r['confidence_high']):,.2f}"
                except (ValueError, TypeError):
                    range_str = "N/A"

            confidence_str = "0%"
            if r.get("confidence_score") is not None:
                try:
                    confidence_str = f"{(float(r['confidence_score']) or 0) * 100:.0f}%"
                except (ValueError, TypeError):
                    confidence_str = "0%"
            
            history.append({
                "property_id": r["property_id"],
                "model_type": r["model_type"],
                "listed_price": listed_price_str,
                "predicted_price": price_str, # This key is still named predicted_price
                "confidence_range": range_str,
                "ai_confidence": confidence_str,
                "distance_km": round(float(r["distance_km"]), 2),
                "created_at": r["created_at"].strftime("%Y-%m-%d")
            })

        return jsonify({"history": history}), 200

    except Exception as e:
        print(f"[NearbyPredictHistoryError] {e}")
        traceback.print_exc() 
        return jsonify({"error": str(e)}), 500

@app.get("/api/insights/market")
def get_market_insights():
    """
    Returns AI-driven market insights for agent dashboard:
    - Top 5 regions (AI predicted avg price per sqm)
    - Market Mix (count per property type)
    - Hot Region (highest avg predicted price)
    - Overall Market Growth (%)
    Handles sqft→sqm conversion, Decimal→float, and text normalization.
    """
    try:
        with get_cursor_cm() as cur:
            cur.execute("""
                SELECT 
                    p.region,
                    p.property_type,
                    p.price,
                    p.size,
                    pr.predicted_price AS ai_predicted_price
                FROM properties p
                LEFT JOIN (
                    SELECT property_id, predicted_price
                    FROM predictions
                    WHERE predicted_price IS NOT NULL
                ) pr ON pr.property_id = p.id
                WHERE p.price IS NOT NULL AND p.size > 0
            """)
            rows = cur.fetchall()

        if not rows:
            return jsonify({"message": "No property data found"}), 200

        import pandas as pd
        df = pd.DataFrame(rows).fillna(0)

        # ✅ Convert Decimal → float safely
        for col in ["price", "size", "ai_predicted_price"]:
            df[col] = df[col].astype(float)

        # ✅ Normalize Region & Property Type
        df["region"] = (
            df["region"]
            .astype(str)
            .str.strip()
            .str.title()
            .replace({"Nan": "Unknown", "None": "Unknown"})
        )

        df["property_type"] = (
            df["property_type"]
            .astype(str)
            .str.strip()
            .str.title()
            .replace({
                "Condo": "Condominium",
                "Apartment": "Condominium",
                "Flat": "HDB",
                "Hdb Flat": "HDB",
                "Semi-Detached": "Landed",
                "Detached": "Landed",
                "None": "Unknown",
                "Nan": "Unknown",
            })
        )

        # ✅ Convert sqft → sqm if values are too large
        if df["size"].mean() > 100:
            df["size_sqm"] = df["size"] / 10.7639
        else:
            df["size_sqm"] = df["size"]

        # === 1️⃣ Market Mix (by Property Type)
        mix_by_type = df["property_type"].value_counts().to_dict()
        if "Unknown" in mix_by_type and len(mix_by_type) > 1:
            mix_by_type.pop("Unknown")

        # === 2️⃣ Weighted avg AI price per sqm by Region
        def weighted_avg(g):
            total_pred = g["ai_predicted_price"].sum()
            total_size = g["size_sqm"].sum()
            return total_pred / total_size if total_size > 0 else 0

        region_prices = (
            df.groupby("region")
            .apply(weighted_avg)
            .round(2)
            .reset_index(name="ai_price_per_sqm")
            .sort_values("ai_price_per_sqm", ascending=False)
        )

        top_regions = region_prices.head(5).to_dict(orient="records")

        # === 3️⃣ Hot Region (highest predicted price)
        hot_region = (
            region_prices["region"].iloc[0]
            if not region_prices.empty and pd.notnull(region_prices["region"].iloc[0])
            else "No active regions"
        )

        # === 4️⃣ Overall Market Growth %
        df["growth_percent"] = ((df["ai_predicted_price"] - df["price"]) / df["price"]) * 100
        avg_growth = round(df["growth_percent"].mean(), 2)

        return jsonify({
            "top_regions": top_regions,
            "mix_by_type": mix_by_type,
            "hot_region": hot_region,
            "avg_ai_growth": avg_growth
        }), 200

    except Exception as e:
        print(f"[MarketInsightsError] {e}")
        return jsonify({"error": str(e)}), 500


@app.get("/api/insights/agent/<int:agent_id>")
def get_agent_insights(agent_id):
    """
    Returns summary statistics for an agent's listings,
    including AI confidence from the latest prediction.
    """
    try:
        with get_cursor_cm() as cur:
            # 🧠 Join properties with predictions using property_id
            cur.execute("""
                SELECT 
                    p.id AS property_id,
                    p.price,
                    p.size,
                    p.region,
                    pr.confidence_score
                FROM properties p
                LEFT JOIN (
                    SELECT property_id, confidence_score, created_at
                    FROM predictions
                    WHERE confidence_score IS NOT NULL
                    ORDER BY created_at DESC
                ) pr ON pr.property_id = p.id
                WHERE p.agent_id = %s
            """, [agent_id])
            rows = cur.fetchall()

        if not rows:
            return jsonify({"message": "No listings found for this agent"}), 200

        # Convert to DataFrame for easier math
        df = pd.DataFrame(rows)

        # Defensive fill for missing values
        df["size"] = df["size"].replace(0, pd.NA)
        df["price_per_sqm"] = df["price"] / df["size"]
        df["confidence_score"] = df["confidence_score"].fillna(0)

        # Compute summary metrics
        avg_conf = df["confidence_score"].mean() * 100  # convert to %
        avg_price = df["price"].mean()
        top_regions = df["region"].value_counts().head(3).to_dict()

        return jsonify({
            "listings": int(len(df)),
            "avg_confidence": round(avg_conf, 2),
            "avg_price": round(avg_price or 0, 2),
            "regions": top_regions
        }), 200

    except Exception as e:
        print(f"[AgentInsightsError] {e}")
        return jsonify({"error": str(e)}), 500



@app.get("/api/insights/recommendations/<int:agent_id>")
def get_ai_recommendations(agent_id):
    """
    Returns AI-based recommendations comparing each property's
    current price with its latest predicted price from the predictions table.
    """
    try:
        with get_cursor_cm() as cur:
            # 🧠 Join properties with latest predictions for that agent
            cur.execute("""
                SELECT 
                    p.id AS property_id,
                    p.location,
                    p.price,
                    pr.predicted_price AS predicted_future_price
                FROM properties p
                LEFT JOIN (
                    SELECT property_id, predicted_price, created_at
                    FROM predictions
                    WHERE predicted_price IS NOT NULL
                    ORDER BY created_at DESC
                ) pr ON pr.property_id = p.id
                WHERE p.agent_id = %s AND p.price IS NOT NULL
            """, [agent_id])
            rows = cur.fetchall()

        if not rows:
            return jsonify({"message": "No prediction data found for this agent"}), 200

        df = pd.DataFrame(rows)
        recs = []

        for _, r in df.iterrows():
            current = float(r.get("price") or 0)
            predicted = float(r.get("predicted_future_price") or 0)
            if not current or not predicted:
                continue

            diff = predicted - current
            trend = (diff / current) * 100

            if trend > 5:
                recs.append({
                    "message": f"{r['location']} expected to appreciate by {trend:.1f}%. Highlight this listing!",
                    "type": "positive"
                })
            elif trend < -5:
                recs.append({
                    "message": f"{r['location']} predicted to soften by {abs(trend):.1f}%. Consider adjusting pricing.",
                    "type": "negative"
                })

        return jsonify({"recommendations": recs}), 200

    except Exception as e:
        print(f"[AIRecommendationsError] {e}")
        return jsonify({"error": str(e)}), 500



# --- Helper: Haversine distance in km ---
def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)**2
    return 2 * R * asin(sqrt(a))

# --- Helper: Find nearest place by type ---
def find_nearest(lat, lng, keywords):
    """Search nearest place using multiple keywords/types until found."""
    SEARCH_RADIUS = 3000
    for keyword in keywords:
        url = (
            f"https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            f"?location={lat},{lng}&radius={SEARCH_RADIUS}&keyword={keyword}"
            f"&region=sg&key={GOOGLE_API_KEY}"
        )
        res = requests.get(url).json()
        if res.get("results"):
            loc = res["results"][0]["geometry"]["location"]
            distance = haversine(lat, lng, loc["lat"], loc["lng"])
            print(f"➡️ {keyword}: {distance:.3f} km")
            return distance
        else:
            print(f"⚠️ No result for keyword {keyword}")
    return None


@app.post("/api/geo/analyze")
def analyze_geo():
    """
    Strict geographic analyzer.
    Keeps MRT accurate.
    Filters small shops/clinics/playgrounds.
    Returns both name + distance for real amenities.
    """
    try:
        body = request.get_json(force=True) or {}
        lat, lng = float(body.get("latitude")), float(body.get("longitude"))
        if not lat or not lng:
            return jsonify({"error": "Missing coordinates"}), 400

        from math import radians, cos, sin, asin, sqrt, exp
        import urllib.parse, requests, json
        MAX_KM = 3.0

        def haversine(lat1, lon1, lat2, lon2):
            R = 6371
            dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
            a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
            return 2 * R * asin(sqrt(a))

        def query_places(params):
            base = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            q = "&".join(f"{k}={v}" for k, v in params.items())
            res = requests.get(f"{base}?{q}&key={GOOGLE_API_KEY}")
            return res.json().get("results") or []

        def best_place(results, bad_keywords):
            best, best_name = None, None
            for r in results:
                name = r.get("name", "").lower()
                if any(b in name for b in bad_keywords):
                    continue
                loc = r.get("geometry", {}).get("location")
                if not loc:
                    continue
                d = haversine(lat, lng, loc["lat"], loc["lng"])
                if best is None or d < best:
                    best, best_name = d, r.get("name")
            return best, best_name

        def find_real_mrt():
            params = {"location": f"{lat},{lng}", "rankby": "distance", "type": "subway_station", "region": "sg"}
            results = query_places(params)
            return best_place(results, [])

        def find_real_mall():
            params = {"location": f"{lat},{lng}", "rankby": "distance", "keyword": urllib.parse.quote("shopping mall"), "region": "sg"}
            results = query_places(params)
            return best_place(results, ["mini", "mart", "salon", "store", "shop", "market", "express"])

        def find_real_school():
            params = {"location": f"{lat},{lng}", "rankby": "distance", "keyword": urllib.parse.quote("primary school OR secondary school OR polytechnic OR university"), "region": "sg"}
            results = query_places(params)
            return best_place(results, ["tuition", "enrichment", "academy", "learning", "centre"])

        # 🏥 FIXED HOSPITAL LOGIC — prioritizes real hospitals
        def find_real_hospital():
            """Return nearest proper hospital name + distance."""
            keywords = ["general hospital", "regional hospital", "community hospital", "hospital"]
            blacklist = [
                "clinic", "centre", "building", "integrated", "wing", "ward", "rehab",
                "specialist", "dental", "skin", "aesthetic", "family", "gp", "surgery",
                "medical", "delifrance", "toast", "starbucks", "coffee", "café",
                "bakery", "carpark", "tower", "pharmacy", "entrance", "lobby"
            ]

            candidates = []
            for kw in keywords:
                params = {
                    "location": f"{lat},{lng}",
                    "rankby": "distance",
                    "keyword": urllib.parse.quote(kw),
                    "region": "sg"
                }
                items = query_places(params)
                for it in items:
                    name = it.get("name", "").lower()
                    if any(bad in name for bad in blacklist):
                        continue
                    candidates.append(it)

            if not candidates:
                return None, None

            ranked = []
            for c in candidates:
                loc = c.get("geometry", {}).get("location")
                if loc:
                    d = haversine(lat, lng, loc["lat"], loc["lng"])
                    ranked.append((d, c.get("name", "")))

            ranked.sort(key=lambda x: x[0])

            # Prefer general > community > others
            for d, n in ranked:
                if "general hospital" in n.lower():
                    return d, n
            for d, n in ranked:
                if "community hospital" in n.lower():
                    return d, n
            return ranked[0]

        def find_real_park():
            params = {"location": f"{lat},{lng}", "rankby": "distance", "keyword": urllib.parse.quote("park OR garden OR nature park"), "region": "sg"}
            results = query_places(params)
            return best_place(results, ["playground", "fitness", "gym"])

        def find_real_business():
            """
            Finds the nearest legitimate business / industrial / corporate hub.
            ✅ Focuses on major business or industrial zones.
            🚫 Skips residences, malls, hotels, and showrooms.
            """
            params = {
                "location": f"{lat},{lng}",
                "rankby": "distance",
                "keyword": urllib.parse.quote(
                    "business park OR industrial park OR corporate office OR tech park OR CBD OR business hub"
                ),
                "region": "sg"
            }

            results = query_places(params)
            if not results:
                print("⚠️ No business results found.")
                return None, None

            blacklist = [
                "residence", "condo", "mall", "plaza", "hotel", "showroom",
                "auto", "warehouse", "storage", "factory", "car", "m-space",
                "service", "shop", "studio", "gym", "school", "training"
            ]

            best = None
            best_name = None
            for r in results:
                name = r.get("name", "").lower()
                if any(bad in name for bad in blacklist):
                    continue

                loc = r.get("geometry", {}).get("location")
                if not loc:
                    continue
                d = haversine(lat, lng, loc["lat"], loc["lng"])

                if best is None or d < best:
                    best = d
                    best_name = r.get("name", "")

            if best is not None:
                print(f"🏢 Business hub: {best_name} ({best:.2f} km)")
                return best, best_name
            else:
                return None, None


        # === Fetch distances ===
        nearest_mrt_km, nearest_mrt_name = find_real_mrt()
        nearest_mall_km, nearest_mall_name = find_real_mall()
        nearest_school_km, nearest_school_name = find_real_school()
        nearest_hospital_km, nearest_hospital_name = find_real_hospital()
        nearest_park_km, nearest_park_name = find_real_park()
        nearest_business_km, nearest_business_name = find_real_business()

        def score(d): return round(10 * exp(-0.5 * (d or 3)), 1)
        amenity_score = round((score(nearest_mall_km) + score(nearest_school_km) + score(nearest_park_km)) / 3, 1)
        health_score = round((score(nearest_hospital_km) + score(nearest_park_km)) / 2, 1)
        green_score = score(nearest_park_km)
        business_access_score = score(nearest_business_km)

        def r2(x): return round(x, 2) if x else None
        result = {
            "nearest_mrt_name": nearest_mrt_name,
            "nearest_mrt_km": r2(nearest_mrt_km),
            "nearest_mall_name": nearest_mall_name,
            "nearest_mall_km": r2(nearest_mall_km),
            "nearest_school_name": nearest_school_name,
            "nearest_school_km": r2(nearest_school_km),
            "nearest_hospital_name": nearest_hospital_name,
            "nearest_hospital_km": r2(nearest_hospital_km),
            "nearest_park_name": nearest_park_name,
            "nearest_park_km": r2(nearest_park_km),
            "nearest_business_name": nearest_business_name,
            "nearest_business_km": r2(nearest_business_km),
            "amenity_score": amenity_score,
            "health_score": health_score,
            "green_score": green_score,
            "business_access_score": business_access_score,
            "timestamp": datetime.now().isoformat(),
        }

        print("✅ Geo analysis\n", json.dumps(result, indent=2))
        return jsonify(result)

    except Exception as e:
        print(f"[GeoAnalyzeError] {e}")
        return jsonify({"error": str(e)}), 400
# --- Payment page ---
# --- Payment page content (public)---
@app.get("/api/public/payment-page")
def get_payment_page_public():
    with get_cursor_cm() as cur:
        cur.execute("SELECT id, title, subtitle, disclaimer, updated_at FROM payment_pages LIMIT 1;")
        row = cur.fetchone()
        if not row:
            # bootstrap default row to avoid admin step blocking the page
            cur.execute("""
                INSERT INTO payment_pages (title, subtitle, disclaimer)
                VALUES ('Complete Subscription','Choose a plan to continue','This is a demo payment page.')
                RETURNING id, title, subtitle, disclaimer, updated_at;
            """)
            row = cur.fetchone()
    return jsonify(row)

# --- Plans con(public) ---
@app.get("/api/public/plans")
def get_plans_public():
    rows = query_all("""
        SELECT id, handle, name, description, currency, unit_amount, interval, is_active
        FROM plans
        WHERE is_active = TRUE
        ORDER BY id ASC;
    """)
    return jsonify(rows)

def _require_admin():
    u = getattr(request, "user", None)
    return bool(u and str(u.get("role","")).lower() == "admin")

# --- Payment page Admin update page and manage plans---
@app.put("/api/admin/payment-page")
@auth_required
def update_payment_page_admin():
    if not _require_admin():
        return jsonify({"error":"admin only"}), 403
    data = request.get_json(force=True) or {}
    with get_cursor_cm() as cur:
        cur.execute("SELECT id FROM payment_pages LIMIT 1;")
        exists = cur.fetchone()
        if exists:
            cur.execute("""
                UPDATE payment_pages
                SET title = COALESCE(%s, title),
                    subtitle = COALESCE(%s, subtitle),
                    disclaimer = COALESCE(%s, disclaimer),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING id, title, subtitle, disclaimer, updated_at;
            """, [data.get("title"), data.get("subtitle"), data.get("disclaimer"), exists["id"]])
        else:
            cur.execute("""
                INSERT INTO payment_pages (title, subtitle, disclaimer)
                VALUES (%s,%s,%s)
                RETURNING id, title, subtitle, disclaimer, updated_at;
            """, [data.get("title") or "Complete Subscription",
                  data.get("subtitle") or "Choose a plan to continue",
                  data.get("disclaimer") or ""] )
        row = cur.fetchone()
    return jsonify(row)

@app.post("/api/admin/plans")
@auth_required
def create_plan_admin():
    if not _require_admin():
        return jsonify({"error":"admin only"}), 403
    d = request.get_json(force=True) or {}
    row = execute("""
        INSERT INTO plans (handle, name, description, currency, unit_amount, interval, stripe_price_id, is_active)
        VALUES (%s,%s,%s,%s,%s,%s,%s,COALESCE(%s, TRUE))
        RETURNING id, handle, name, description, currency, unit_amount, interval, stripe_price_id, is_active;
    """, [
        d["handle"], d["name"], d.get("description"),
        d.get("currency","sgd"), int(d["unit_amount"]), d["interval"], d["stripe_price_id"],
        d.get("is_active", True)
    ], return_row=True)
    return jsonify(row), 201

@app.patch("/api/admin/plans/<int:pid>")
@auth_required
def update_plan_admin(pid):
    if not _require_admin():
        return jsonify({"error":"admin only"}), 403
    d = request.get_json(force=True) or {}
    fields, vals = [], []
    for k in ["handle","name","description","currency","interval","stripe_price_id","is_active","unit_amount"]:
        if k in d:
            fields.append(f"{k} = %s")
            vals.append(int(d[k]) if k=="unit_amount" else d[k])
    if not fields:
        return jsonify({"error":"no fields"}), 400
    vals.append(pid)
    sql = f"UPDATE plans SET {', '.join(fields)} WHERE id = %s RETURNING id, handle, name, description, currency, unit_amount, interval, stripe_price_id, is_active;"
    row = execute(sql, vals, return_row=True)
    if not row:
        return jsonify({"error":"not found"}), 404
    return jsonify(row)

# --- Stripe (payment service) checkout ---
@app.post("/api/payments/checkout")
@auth_required
def payments_checkout():
    try:
        body = request.get_json(force=True) or {}
        plan_id = body.get("plan_id")

        # --- diagnostics ---
        print("[checkout] start", flush=True)
        print("[checkout] user", request.user, flush=True)
        print("[checkout] body", body, flush=True)
        print("[checkout] stripe_key_prefix", (stripe.api_key or "")[:8], flush=True)
        print("[checkout] FRONTEND_URL", FRONTEND_URL, flush=True)

        # 1) validate inputs/config
        if not isinstance(plan_id, int):
            return jsonify({"error":"invalid_plan","detail":"plan_id must be integer"}), 400
        if not stripe.api_key or not stripe.api_key.startswith(("sk_test_","sk_live_")):
            return jsonify({"error":"stripe_config","detail":"STRIPE_SECRET_KEY missing/invalid"}), 500
        if not FRONTEND_URL.startswith(("http://","https://")):
            return jsonify({"error":"frontend_url","detail":f"bad FRONTEND_URL: {FRONTEND_URL}"}), 500

        # 2) current signed-in user (set by @auth_required)
        user_id = request.user["id"]
        email   = request.user["email"]
        role    = (request.user.get("role") or "homeowner").lower()

        # 3) ensure stripe customer id
        with get_cursor_cm() as cur:
            cur.execute("SELECT stripe_customer_id FROM users WHERE id=%s", [user_id])
            row = cur.fetchone()
            stripe_customer_id = row["stripe_customer_id"] if row else None
        if not stripe_customer_id:
            cust = stripe.Customer.create(email=email, metadata={"app_user_id": str(user_id), "role": role})
            with get_cursor_cm() as cur:
                cur.execute("UPDATE users SET stripe_customer_id=%s WHERE id=%s", [cust.id, user_id])
            stripe_customer_id = cust.id
        print("[checkout] customer", stripe_customer_id, flush=True)

        # 4) fetch plan
        with get_cursor_cm() as cur:
            cur.execute("SELECT id, stripe_price_id, is_active FROM plans WHERE id=%s", [plan_id])
            plan = cur.fetchone()
        print("[checkout] plan", plan, flush=True)

        if not plan:
            return jsonify({"error":"plan_not_found","detail":f"id={plan_id}"}), 404
        if not plan["is_active"]:
            return jsonify({"error":"plan_inactive","detail":f"id={plan_id}"}), 400
        if not plan["stripe_price_id"] or not plan["stripe_price_id"].startswith("price_"):
            return jsonify({"error":"bad_price_id","detail":"missing/invalid stripe_price_id"}), 400

        # 5) proactively verify the price exists in this Stripe mode
        try:
            _ = stripe.Price.retrieve(plan["stripe_price_id"])
        except stripe.error.InvalidRequestError as e:
            print("[checkout] price INVALID:", plan["stripe_price_id"], str(e), flush=True)
            return jsonify({"error":"bad_price_id","detail":str(e)}), 400

        # 6) create checkout session
        success_url = f"{FRONTEND_URL}/payment/success?role={role}&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url  = f"{FRONTEND_URL}/payment/cancel"

        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            customer=stripe_customer_id,
            line_items=[{"price": plan["stripe_price_id"], "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": str(user_id), "plan_id": str(plan["id"]), "role": role},
        )
        print("[checkout] session", session.id, flush=True)
        return jsonify({"checkout_url": session.url})

    # --- targeted error mapping (always JSON) ---
    except stripe.error.AuthenticationError as e:
        return jsonify({"error":"stripe_auth","detail":str(e)}), 500
    except stripe.error.InvalidRequestError as e:
        return jsonify({"error":"stripe_invalid_request","detail":str(e)}), 400
    except stripe.error.StripeError as e:
        return jsonify({"error":"stripe_generic","detail":str(e)}), 500
    except OperationalError as e:
        return jsonify({"error":"db_error","detail":str(e)}), 500
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error":"unexpected","detail":str(e)}), 500

# --- Webhook for Stripe persistent subscription status ---
@app.post("/api/webhooks/stripe")
def stripe_webhook():
    payload = request.data
    sig = request.headers.get("Stripe-Signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    t = event["type"]

    # Checkout completed -> create/update subscription row
    if t == "checkout.session.completed":
        sess = event["data"]["object"]
        sub_id = sess.get("subscription")
        meta = sess.get("metadata", {}) or {}
        user_id = int(meta.get("user_id", 0))
        plan_id = int(meta.get("plan_id", 0)) if meta.get("plan_id") else None

        if sub_id and user_id:
            s = stripe.Subscription.retrieve(sub_id)
            started_at = datetime.fromtimestamp(s.start_date, tz=timezone.utc) if getattr(s, "start_date", None) else None
            period_end = datetime.fromtimestamp(s.current_period_end, tz=timezone.utc) if getattr(s, "current_period_end", None) else None

            with get_cursor_cm() as cur:
                cur.execute("""
                    INSERT INTO subscriptions (user_id, plan_id, stripe_subscription_id, stripe_status, started_at, current_period_end)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (stripe_subscription_id) DO UPDATE
                    SET stripe_status=EXCLUDED.stripe_status,
                        current_period_end=EXCLUDED.current_period_end
                """, [user_id, plan_id, sub_id, s.status, started_at, period_end])

    # Lifecycle updates
    elif t in ("customer.subscription.updated", "customer.subscription.deleted"):
        s = event["data"]["object"]
        sub_id = s["id"]
        status = s["status"]
        period_end = s.get("current_period_end")
        with get_cursor_cm() as cur:
            cur.execute("""
                UPDATE subscriptions
                SET stripe_status=%s,
                    current_period_end=COALESCE(to_timestamp(%s), current_period_end)
                WHERE stripe_subscription_id=%s
            """, [status, period_end, sub_id])

    return jsonify({"received": True})

# --- Get AI prediction for a property ---
@app.get("/api/predict/<int:property_id>")
def get_prediction(property_id):
    try:
        query = """
            SELECT 
                property_id,
                predicted_price AS predicted_total_price,
                confidence_low,
                confidence_high,
                confidence_score,
                input_data,
                created_at
            FROM predictions
            WHERE property_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """
        rows = query_all(query, [property_id])
        if not rows:
            return jsonify({"success": False, "message": "No prediction found."}), 404

        pred = rows[0]

        # Decode input data
        if pred.get("input_data") and isinstance(pred["input_data"], str):
            try:
                pred["input_data"] = json.loads(pred["input_data"])
            except Exception:
                pred["input_data"] = {}

        # Compute missing fields
        predicted_price = float(pred["predicted_total_price"])
        floor_area = float(pred["input_data"].get("floor_area_sqm", 1) or 1)

        pred["predicted_price_per_sqm"] = round(predicted_price / floor_area, 2)

        return jsonify({"success": True, **pred})

    except Exception as e:
        print("❌ Prediction fetch error:", e)
        return jsonify({"success": False, "message": "Error fetching prediction."}), 500



if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)
