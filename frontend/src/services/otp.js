// frontend/src/services/otp.js
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Step 1: verify password on the server and send an OTP email.
 * Returns: { otp_sent: true, user: { id, email_hint, role } }
 */
export async function loginStep1({ email, password, role }) {
  // normalize "homebuyer" to "homeowner" for the backend
  const normalizedRole = role === "homebuyer" ? "homeowner" : role;

  const res = await fetch(`${BASE}/auth/login-step1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: String(email || "").trim(),
      password,
      role: normalizedRole || undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Login (step 1) failed");
  }
  return data;
}

/**
 * Step 2: submit the OTP code to finish login and receive the normal token.
 * Returns: { token, user }
 */
export async function loginStep2({ email, code, role }) {
  const normalizedRole = role === "homebuyer" ? "homeowner" : role;

  const res = await fetch(`${BASE}/auth/login-step2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: String(email || "").trim(),
      code: String(code || "").trim(),
      role: normalizedRole || undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Invalid or expired OTP");
  }
  return data;
}
