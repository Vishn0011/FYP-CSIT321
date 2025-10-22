import os, re
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from db import query_all, execute, get_cursor, get_conn
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
from psycopg2 import OperationalError
import stripe

load_dotenv()
app = Flask(__name__)

CLIENT_ID = "98981474983-d5h2shgl18u6oovn378q3ovao61jtbm0.apps.googleusercontent.com"  # same as frontend


# Allow frontend (Vite dev server) to call this API in dev
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://localhost:3000"])
# CORS(app, supports_credentials=True, origins=[ALLOW_ORIGIN], methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type", "Authorization"], )

# --- For Stripe (payment service)
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

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

    with get_cursor() as cur:
        cur.execute("""
            SELECT id, email, name, role, is_active, status
            FROM users
            WHERE email = %s
              AND crypt(%s, password_hash) = password_hash
              AND role = %s
        """, [email, password, role])
        user = cur.fetchone()

    if not user:
        return jsonify({"error": "invalid credentials or role"}), 401

    #Enforce approval rules
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

    # Generate session
    token = make_token()
    exp = expires_at(SESSION_TTL_MIN)

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO sessions(user_id, token, expires_at)
            VALUES (%s, %s, %s)
        """, [user["id"], token, exp])

    if user["role"] == "agent":
        with get_cursor() as cur:
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

        with get_cursor() as cur:
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
        with get_cursor() as cur:
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
        with get_cursor() as cur:
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
        with get_cursor() as cur:
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
    with get_cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE token = %s", [request.token])
    return jsonify({"ok": True})

# ---------- USERS ----------
@app.get("/api/users")
def list_users():
    rows = query_all("SELECT id, email, created_at FROM users ORDER BY id DESC;")
    return jsonify(rows)

@app.get("/api/users/pending")
def get_pending_users():
    with get_cursor() as cur:
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
    with get_cursor() as cur:
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

#get individual property by id
@app.get("/api/properties/<int:prop_id>")
def get_property(prop_id):
    # --- Fetch property + agent info in one query ---
    row = query_all(
        """
        SELECT p.id, p.agent_id, p.title, p.property_type, p.description, p.price,
               p.bedrooms, p.bathrooms, p.size, p.location, p.latitude, p.longitude,
               p.photos, p.status, p.furnishing, p.floor_level, p.tenure, p.amenities,
               p.floor_plan, p.video_url, p.created_at, p.updated_at,
               u.name AS agent_name, u.status AS agent_status, u.last_active
        FROM properties p
        LEFT JOIN users u ON p.agent_id = u.id
        WHERE p.id = %s
        """,
        [prop_id],
    )

    if not row:
        return jsonify({"error": "Property not found"}), 404

    data = row[0]

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

    # Only agents can add
    user = get_current_user()
    if not user or user["role"] != "agent":
        return jsonify({"error": "Only agents can add properties"}), 403

    agent_id = user["id"]

    # status can be "Draft" or "Pending" (default Pending)
    status = data.get("status", "Pending")

    # handle arrays: convert photos to JSON, amenities to array
    photos = None
    if "photos" in data:
        photos = data["photos"]
        if isinstance(photos, list):
            photos = json.dumps(photos)

    amenities = None
    if "amenities" in data:
        amenities = data["amenities"]
        if isinstance(amenities, list):
            # if DB column is JSON, dump to JSON
            # if DB column is Postgres ARRAY, pass list directly
            amenities = amenities  

    row = execute(
        """
        INSERT INTO properties
        (agent_id, title, property_type, description, price, bedrooms, bathrooms,
         size, location, latitude, longitude, photos, status,
         furnishing, floor_level, tenure, amenities, floor_plan, video_url)
        VALUES (%s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s)
        RETURNING id, agent_id, title, property_type, description, price,
                  bedrooms, bathrooms, size, location, latitude, longitude,
                  photos, status, furnishing, floor_level, tenure, amenities,
                  floor_plan, video_url, created_at, updated_at;
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
        ],
        return_row=True,
    )

    return jsonify(row), 201


#edit property
@app.patch("/api/properties/edit/<int:prop_id>")
def update_property(prop_id):
    data = request.get_json(force=True)
    fields, values = [], []

    # Allow updating all fields (old + new)
    updatable = [
        "title", "property_type", "description", "price",
        "bedrooms", "bathrooms", "size", "location", "photos", "status",
        "furnishing", "floor_level", "tenure", "amenities",
        "floor_plan", "video_url", "latitude", "longitude"
    ]

    for key in updatable:
        if key in data:
            if key == "photos" and isinstance(data[key], list):
                fields.append(f"{key} = %s")
                values.append(json.dumps(data[key]))
            elif key == "amenities" and isinstance(data[key], list):
                fields.append(f"{key} = %s")
                values.append(data[key])  # Postgres ARRAY
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
        RETURNING id, agent_id, title, property_type, description, price,
                  bedrooms, bathrooms, size, location, photos, status,
                  furnishing, floor_level, tenure, amenities, floor_plan,
                  video_url, latitude, longitude, created_at, updated_at
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

# ---Add Dropdown Option---
@app.post("/api/options/<option_type>")
def add_dropdown_option(option_type):
    body = request.get_json(force=True) or {}
    name = (body.get("name") or "").strip()
    status = (body.get("status") or "active").strip().lower()

    if not name:
        return jsonify({"ok": False, "error": "Name is required"}), 400

    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO dropdown_options (type, name, status)
                VALUES (%s, %s, %s)
                RETURNING id, type, name, status;
                """,
                (option_type, name, status),
            )
            row = cur.fetchone()

        option = {
            "id": row[0],
            "type": row[1],
            "name": row[2],
            "status": row[3],
        }
        return jsonify({"ok": True, "option": option}), 201

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

# ---Get Dropdown Options---
@app.get("/api/options/<option_type>")
def get_dropdown_options(option_type):
    try:
        with get_conn() as conn, conn.cursor() as cur:
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

        # rows are dicts, use keys
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
@app.put("/api/options/<int:option_id>/status")
def update_dropdown_status(option_id):
    body = request.get_json(force=True) or {}
    status = (body.get("status") or "").strip().lower()

    if status not in ["active", "inactive"]:
        return jsonify({"ok": False, "error": "Invalid status"}), 400

    try:
        with get_conn() as conn, conn.cursor() as cur:
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
        with get_conn() as conn, conn.cursor() as cur:
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

        with get_conn() as conn, conn.cursor() as cur:
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
        with get_conn() as conn, conn.cursor() as cur:
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
        with get_conn() as conn, conn.cursor() as cur:
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

        with get_conn() as conn, conn.cursor() as cur:
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
        with get_conn() as conn, conn.cursor() as cur:
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
            with get_conn() as conn, conn.cursor() as cur:
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

# --- Payment page ---
# --- Payment page content (public)---
@app.get("/api/public/payment-page")
def get_payment_page_public():
    with get_cursor() as cur:
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
    with get_cursor() as cur:
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
        with get_cursor() as cur:
            cur.execute("SELECT stripe_customer_id FROM users WHERE id=%s", [user_id])
            row = cur.fetchone()
            stripe_customer_id = row["stripe_customer_id"] if row else None
        if not stripe_customer_id:
            cust = stripe.Customer.create(email=email, metadata={"app_user_id": str(user_id), "role": role})
            with get_cursor() as cur:
                cur.execute("UPDATE users SET stripe_customer_id=%s WHERE id=%s", [cust.id, user_id])
            stripe_customer_id = cust.id
        print("[checkout] customer", stripe_customer_id, flush=True)

        # 4) fetch plan
        with get_cursor() as cur:
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

            with get_cursor() as cur:
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
        with get_cursor() as cur:
            cur.execute("""
                UPDATE subscriptions
                SET stripe_status=%s,
                    current_period_end=COALESCE(to_timestamp(%s), current_period_end)
                WHERE stripe_subscription_id=%s
            """, [status, period_end, sub_id])

    return jsonify({"received": True})

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
