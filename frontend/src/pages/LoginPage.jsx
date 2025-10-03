import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { GoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
    const nav = useNavigate();
    const [role, setRole] = useState("agent");
    const [email, setEmail] = useState("");
    const [pw, setPw] = useState("");
    const [showPw, setShowPw] = useState(false);
    const { login } = useAuth();
    const [err, setErr] = useState(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        setErr(null);

        if (!email || !pw) {
            setErr("Email and password required");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password: pw, role }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Invalid credentials");

            login(data.user, data.token);

            if (data.user.role === "agent") {
                nav("/properties");
            } else if (data.user.role === "homeowner") {
                nav("/homeowner/search");
            } else {
                nav("/");
            }
        } catch (e) {
            setErr(e.message || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleLogin(credentialResponse) {
        try {
            const token = credentialResponse.credential;
            const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/google/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Google login failed");

            login(data.user, data.token);

            if (data.user.role === "agent") {
                nav("/properties");
            } else {
                nav("/homeowner/search");
            }
        } catch (err) {
            setErr(err.message);
        }
    }

    return (
        <div className="bg-gray-50 text-gray-800 min-h-screen flex flex-col">
            <main className="flex items-center justify-center flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-md space-y-8">
                    <div className="bg-white p-8 shadow-lg rounded-xl">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
                            <p className="mt-2 text-sm text-gray-600">Sign in to continue</p>
                        </div>

                        {/* Role selector */}
                        <div className="mb-6">
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setRole("agent")}
                                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition ${role === "agent"
                                            ? "bg-white shadow text-gray-700"
                                            : "text-gray-500"
                                        }`}
                                >
                                    Property Agent
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole("homeowner")}
                                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition ${role === "homeowner"
                                            ? "bg-white shadow text-gray-700"
                                            : "text-gray-500"
                                        }`}
                                >
                                    Homeowner
                                </button>
                            </div>
                        </div>

                        {/* Normal login form */}
                        <form className="space-y-6" onSubmit={onSubmit}>
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Email address
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Password
                                </label>
                                <div className="mt-1 relative">
                                    <input
                                        id="password"
                                        required
                                        type={showPw ? "text" : "password"}
                                        autoComplete="current-password"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 pr-12"
                                        value={pw}
                                        onChange={(e) => setPw(e.target.value)}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw((s) => !s)}
                                        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500"
                                    >
                                        <span className="material-symbols-outlined text-lg">
                                            {showPw ? "visibility_off" : "visibility"}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {err && <p className="text-sm text-red-600">{err}</p>}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 disabled:opacity-60"
                            >
                                {loading
                                    ? "Signing in…"
                                    : `Sign in as ${role === "agent" ? "Property Agent" : "Homeowner"
                                    }`}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="my-6 flex items-center">
                            <div className="flex-grow border-t border-gray-300"></div>
                            <span className="mx-4 text-gray-400 text-sm">or</span>
                            <div className="flex-grow border-t border-gray-300"></div>
                        </div>

                        {/* Google login button */}
                        <div className="flex justify-center">
                            <GoogleLogin
                                onSuccess={handleGoogleLogin}
                                onError={() => setErr("Google Login Failed")}
                            />
                        </div>
                    </div>

                    <div className="text-center text-sm text-gray-600">
                        <p>
                            Don’t have an account?{" "}
                            <Link
                                className="font-medium text-emerald-800 hover:text-emerald-900"
                                to="/register"
                            >
                                Create account
                            </Link>
                        </p>
                        <p className="mt-2">
                            <Link
                                className="text-xs text-gray-500 hover:text-gray-700"
                                to="/admin/login"
                            >
                                Admin login
                            </Link>
                        </p>
                    </div>
                </div>
            </main>

            <footer className="bg-gray-100 py-4">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-sm text-gray-500">
                        © 2025 Aspect Real Estate. All Rights Reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
