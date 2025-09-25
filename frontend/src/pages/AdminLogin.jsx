import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    if (!email || !pw) { setErr("Email and password required"); return; }
    setLoading(true);
    try {
      const base = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const res = await fetch(`${base}/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data?.error || "Invalid credentials");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      nav("/admin"); // send admins to their dashboard route
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen flex flex-col">
      <main className="flex items-center justify-center flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="bg-white p-8 shadow-lg rounded-xl">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Admin sign in</h2>
              <p className="mt-2 text-sm text-gray-600">Restricted area, fam.</p>
            </div>

            <form className="space-y-6" onSubmit={onSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email" type="email" autoComplete="email" required
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
                  value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="admin@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1 relative">
                  <input
                    id="password" required
                    type={showPw ? "text" : "password"} autoComplete="current-password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 pr-12"
                    value={pw} onChange={(e)=>setPw(e.target.value)} placeholder="••••••••"
                  />
                  <button type="button" onClick={()=>setShowPw(s=>!s)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500">
                    <span className="material-symbols-outlined text-lg">{showPw ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>

              {err && <p className="text-sm text-red-600">{err}</p>}

              <button type="submit" disabled={loading}
                      className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 disabled:opacity-60">
                {loading ? "Signing in…" : "Sign in as Admin"}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-gray-600">
            Not an admin?{" "}
            <Link className="font-medium text-emerald-800 hover:text-emerald-900" to="/login">Go to user login</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
