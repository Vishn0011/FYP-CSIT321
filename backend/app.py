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

#get enquiries for agent
@app.get("/api/enquiries/agent/<int:agent_id>")
def get_agent_enquiries(agent_id):
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT e.id, e.property_id, p.title AS property_title,
                       e.buyer_name, e.buyer_email, e.buyer_phone,
                       e.message, e.status, e.created_at
                FROM enquiries e
                JOIN properties p ON e.property_id = p.id
                WHERE e.agent_id = %s
                ORDER BY e.created_at DESC;
                """,
                (agent_id,),
            )
            rows = cur.fetchall()

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
                "created_at": r["created_at"].strftime("%Y-%m-%d %H:%M:%S"),
            }
            for r in rows
        ]

        return jsonify({"ok": True, "enquiries": enquiries}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

#update enquiry status
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
                RETURNING id, status;
                """,
                (new_status, enquiry_id),
            )
            row = cur.fetchone()
            conn.commit()

        if not row:
            return jsonify({"ok": False, "error": "Enquiry not found"}), 404

        return jsonify({"ok": True, "enquiry": {"id": row["id"], "status": row["status"]}}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500




if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
