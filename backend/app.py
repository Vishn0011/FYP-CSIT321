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



load_dotenv()
app = Flask(__name__)

CLIENT_ID = "98981474983-d5h2shgl18u6oovn378q3ovao61jtbm0.apps.googleusercontent.com"  # same as frontend

# Ensure saved_properties table exists for environments that have not run latest migration yet.
with get_cursor() as cur:
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
with get_cursor() as cur:
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


@app.get("/api/profile")
@auth_required
def get_profile():
    user_id = request.user["id"]
    with get_cursor() as cur:
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

    with get_cursor() as cur:
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

    with get_cursor() as cur:
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
    row = query_all(
        """
        SELECT id, agent_id, title, property_type, description, price, bedrooms, bathrooms,
               size, location, latitude, longitude, photos, status,
               furnishing, floor_level, tenure, amenities, floor_plan, video_url,
               created_at, updated_at
        FROM properties
        WHERE id = %s
    """,
        [prop_id],
    )
    if not row:
        return jsonify({"error": "Property not found"}), 404
    return jsonify(row[0])


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
        with get_conn() as conn, conn.cursor() as cur:
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
        limit = 50
    limit = min(limit, 200)

    if not page or page <= 0:
        page = 1
    offset = (page - 1) * limit

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

    query += " ORDER BY id DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    rows = query_all(query, params)
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
    # Ensure property exists and is active (optional but useful)
    exists = query_all("SELECT id FROM properties WHERE id = %s", [prop_id])
    if not exists:
        return jsonify({"error": "Property not found"}), 404
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO saved_properties (user_id, property_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, property_id) DO NOTHING
            RETURNING user_id, property_id
            """,
            [user_id, prop_id],
        )
        _ = cur.fetchone()  # may be None if conflict
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


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)




