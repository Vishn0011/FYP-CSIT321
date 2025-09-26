// frontend/src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/homebuyer/search";

  // Backend roles are "homeowner" or "agent".
  // We'll label the button "Homebuyer" but keep the value "homeowner".
  const [role, setRole] = useState("homeowner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!email || !password) {
      setErr("Email and password required");
      return;
    }

    // If at some point you set role to "homebuyer" from the UI,
    // normalize it to what the backend expects.
    const normalizedRole = role === "homebuyer" ? "homeowner" : role;

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          role: normalizedRole || undefined, // omit if empty
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Invalid credentials");

      // Persist session
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect by role (or go back to the page that required auth)
      if (data.user?.role === "agent") {
        nav("/properties");
      } else if (data.user?.role === "homeowner") {
        nav(from);
      } else {
        nav("/");
      }
    } catch (e) {
      setErr(e.message || "Login failed");
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
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ flex: 1, padding: 8 }}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: "white",
                cursor: "pointer",
              }}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {err && <div style={{ color: "crimson" }}>{err}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "#00674F",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        Tip (dev): try <code>home@example.com / Abc123!</code> (Homebuyer) or{" "}
        <code>agent@example.com / Abc123!</code> (Agent) if your seed data uses those.
      </p>
    </div>
  );
}
