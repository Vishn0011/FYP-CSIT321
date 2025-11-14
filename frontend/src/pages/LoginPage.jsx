import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { GoogleLogin } from "@react-oauth/google";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3"; // <-- ADDED

export default function LoginPage() {
    const nav = useNavigate();
    const [role, setRole] = useState("agent");
    const [email, setEmail] = useState("");
    const [pw, setPw] = useState("");
    const [showPw, setShowPw] = useState(false);
    const { login } = useAuth();
    const [err, setErr] = useState(null);
    const [loading, setLoading] = useState(false);

    const { executeRecaptcha } = useGoogleReCaptcha(); // <-- ADDED

    async function onSubmit(e) {
        e.preventDefault();
        setErr(null);

        if (!email || !pw) {
            setErr("Email and password required");
            return;
        }

        setLoading(true);
        try {
            // --- 1️⃣ Run reCAPTCHA ---
            let captchaToken = null;
            if (executeRecaptcha) {
                captchaToken = await executeRecaptcha("login_action");
            }

            const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    password: pw,
                    role,
                    captcha: captchaToken   // <-- ADDED
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Invalid credentials");

            // persist login
            login(data.user, data.token);

            // redirect based on role
            if (data.user.role === "agent") nav("/properties");
            else nav("/homeowner/search");
        } catch (e) {
            setErr(e.message || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    // === Google login handler ===
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

            // persist login
            login(data.user, data.token);

            if (data.user.role === "agent") nav("/properties");
            else nav("/homeowner/search");
        } catch (err) {
            setErr(err.message);
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
            <main className="flex items-center justify-center flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 transition-colors">
                <div className="w-full max-w-md space-y-8">
                    <div className="rounded-2xl border border-gray-200 bg-white/95 p-8 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
                            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">Sign in to continue</p>
                        </div>

                        {/* Role selector */}
                        <div className="mb-6">
                            <div className="flex bg-gray-100 rounded-lg p-1 dark:bg-zinc-800/60">
                                <button
                                    type="button"
                                    onClick={() => setRole("agent")}
                                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition ${role === "agent"
                                            ? "bg-white shadow text-gray-700 dark:bg-zinc-900 dark:text-white"
                                            : "text-gray-500 dark:text-zinc-400"
                                        }`}
                                >
                                    Property Agent
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole("homeowner")}
                                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition ${role === "homeowner"
                                            ? "bg-white shadow text-gray-700 dark:bg-zinc-900 dark:text-white"
                                            : "text-gray-500 dark:text-zinc-400"
                                        }`}
                                >
                                    Homeowner
                                </button>
                            </div>
                        </div>

                        {/* Normal login form */}
                        <form className="space-y-6" onSubmit={onSubmit}>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-zinc-200">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-zinc-200">
                                    Password
                                </label>
                                <div className="mt-1 relative">
                                    <input
                                        id="password"
                                        required
                                        type={showPw ? "text" : "password"}
                                        autoComplete="current-password"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg pr-12 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                                        value={pw}
                                        onChange={(e) => setPw(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw((s) => !s)}
                                        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 dark:text-zinc-400"
                                    >
                                        <span className="material-symbols-outlined text-lg">
                                            {showPw ? "visibility_off" : "visibility"}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 px-4 rounded-lg text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 focus:ring-2 focus:ring-emerald-700 focus:outline-none focus:ring-offset-2 focus:ring-offset-transparent"
                            >
                                {loading
                                    ? "Signing in..."
                                    : `Sign in as ${role === "agent" ? "Property Agent" : "Homeowner"}`}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="my-6 flex items-center">
                            <div className="flex-grow border-t border-gray-300 dark:border-zinc-700"></div>
                            <span className="mx-4 text-gray-400 text-sm dark:text-zinc-400">or</span>
                            <div className="flex-grow border-t border-gray-300 dark:border-zinc-700"></div>
                        </div>

                        {/* Google login button */}
                        <div className="flex justify-center">
                            <GoogleLogin
                                onSuccess={handleGoogleLogin}
                                onError={() => setErr("Google Login Failed")}
                            />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}