// frontend/src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { loginStep1, loginStep2 } from "../services/otp";
import { setSession } from "../services/auth";

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/homebuyer/search";

  // Backend roles are "homeowner" or "agent".
  // We label "Homebuyer" but keep the value "homeowner".
  const [role, setRole] = useState("homeowner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // OTP phase
  const [phase, setPhase] = useState("creds"); // "creds" | "otp"
  const [otpCode, setOtpCode] = useState("");
  const [emailHint, setEmailHint] = useState("");

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // -------- Step 1: submit email+password to trigger OTP --------
  async function onSubmitCreds(e) {
    e.preventDefault();
    setErr("");

    if (!email || !password) {
      setErr("Email and password required");
      return;
    }

    try {
      setLoading(true);
      const data = await loginStep1({
        email,
        password,
        role, // service will normalize "homebuyer" -> "homeowner"
      });

      // Move to OTP phase
      setEmailHint(data?.user?.email_hint || "");
      setPhase("otp");
      setOtpCode("");
    } catch (e) {
      setErr(e.message || "Login (step 1) failed");
    } finally {
      setLoading(false);
    }
  }

  // -------- Step 2: submit OTP to finish login --------
  async function onSubmitOtp(e) {
    e.preventDefault();
    setErr("");

    if (!otpCode) {
      setErr("Enter the 6-digit code from your email");
      return;
    }

    try {
      setLoading(true);
      const data = await loginStep2({
        email,
        code: otpCode,
        role, // service will normalize "homebuyer" -> "homeowner"
      });

      // ✅ Persist session using the shared helper
      //    This stores the token under the same key and sets axios Authorization header.
      setSession(data.token, data.user);

      // Redirect by role (or go back to the page that required auth)
      if (data.user?.role === "agent") {
        nav("/properties", { replace: true });
      } else if (data.user?.role === "homeowner") {
        nav(from, { replace: true });
      } else {
        nav("/", { replace: true });
      }
    } catch (e) {
      setErr(e.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  }

  // Reset back to creds phase
  function backToCreds() {
    setPhase("creds");
    setOtpCode("");
    setErr("");
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

      {phase === "creds" ? (
        // -------------------- STEP 1: Email + Password --------------------
        <form onSubmit={onSubmitCreds} style={{ display: "grid", gap: 12 }}>
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
            {loading ? "Checking..." : "Sign in"}
          </button>
        </form>
      ) : (
        // -------------------- STEP 2: OTP Code --------------------
        <form onSubmit={onSubmitOtp} style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 14, color: "#444" }}>
            We’ve sent a 6-digit code to <b>{emailHint || email}</b>. Enter it below.
          </div>

          <label>
            <div style={{ marginBottom: 4 }}>One-time code</div>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              required
              style={{ width: "100%", padding: 8, letterSpacing: 4 }}
              placeholder="••••••"
            />
          </label>

          {err && <div style={{ color: "crimson" }}>{err}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={backToCreds}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "white",
                color: "#00674F",
                border: "1px solid #00674F",
                cursor: "pointer",
                flex: 1,
              }}
            >
              Back
            </button>
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
                flex: 1,
              }}
            >
              {loading ? "Verifying..." : "Verify & continue"}
            </button>
          </div>
        </form>
      )}

      <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        Tip (dev): try <code>home@example.com / Abc123!</code> (Homebuyer) or{" "}
        <code>agent@example.com / Abc123!</code> (Agent) if your seed data uses those.
      </p>
    </div>
  );
}
