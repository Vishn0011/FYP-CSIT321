from flask import Blueprint, request, jsonify
from db import query_all, execute

bp = Blueprint("agents", __name__, url_prefix="/api/agents")

# GET all agents
@bp.get("")
def list_agents():
    rows = query_all("SELECT id, name, email, phone FROM agents ORDER BY created_at DESC;")
    return jsonify(rows)

# POST create agent
@bp.post("")
def create_agent():
    data = request.get_json()
    row = execute(
        """
        INSERT INTO agents (name, email, phone, created_at)
        VALUES (%s, %s, %s, NOW())
        RETURNING id, name, email, phone, created_at;
        """,
        [data.get("name"), data.get("email"), data.get("phone")],
        return_row=True
    )
    return jsonify(row), 201

# DELETE agent
@bp.delete("/<uuid:agent_id>")
def delete_agent(agent_id):
    execute("DELETE FROM agents WHERE id = %s;", [str(agent_id)])
    return jsonify({"deleted": str(agent_id)})
