// frontend/src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login, getMe } from "../services/auth";

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/homebuyer/search";

  const [role, setRole] = useState("homeowner"); // backend expects "homeowner" or "agent"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login({ email, password, role });
      try {
        await getMe();
      } catch {}
      nav(from, { replace: true }); // redirect back to the page user wanted
    } catch (e2) {
      setErr(e2.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
      <h1>Login</h1>

      {/* Role tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setRole("homeowner")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: role === "homeowner" ? "#e8f5e9" : "white",
            cursor: "pointer",
          }}
        >
          Homebuyer
        </button>
        <button
          type="button"
          onClick={() => setRole("agent")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: role === "agent" ? "#e8f5e9" : "white",
            cursor: "pointer",
          }}
        >
          Property Agent
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          <div style={{ marginBottom: 4 }}>Email</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
            placeholder="you@example.com"
          />
        </label>

        <label>
          <div style={{ marginBottom: 4 }}>Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
            placeholder="••••••••"
          />
        </label>

        {err && <div style={{ color: "crimson" }}>{err}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "#0f766e",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        Tip (dev): try <code>agent1@example.com / Abc123!</code> (Property Agent) or{" "}
        <code>vishnu_test_1@example.com / Abc123!</code> (Homebuyer) if you have the seed inserted.
      </p>
    </div>
  );
}
