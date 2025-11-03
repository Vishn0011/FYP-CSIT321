// src/Payment.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function Payment() {
    const loc = useLocation();
    const navigate = useNavigate();
    // state coming from signup: { role: 'homeowner'|'agent', email }
    const { state } = loc;
    const role = state?.role ?? "homeowner";
    const email = state?.email ?? "unknown@example.com";

    const [page, setPage] = useState({ title:"", subtitle:"", disclaimer:"" });
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
        try {
            const [pgRes, plRes] = await Promise.all([
            api.get("/public/payment-page"),
            api.get("/public/plans"),
            ]);
            const pg = pgRes.data;
            const pls = plRes.data;
            setPage(pg);
            setPlans(pls);
            setSelectedPlan(Number(pls?.[0]?.id ?? 0));
        } catch (e) {
            const msg =
            e?.response?.data?.error ||
            e?.message ||
            "Failed to load payment page.";
            setError(`Failed to load payment page: ${msg}`);
        }
        })();
    }, []);

    const onPay = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            if (!selectedPlan) throw new Error("Please select a plan.");
                const { data } = await api.post("/payments/checkout", {
                plan_id: selectedPlan,
                });
            if (!data?.checkout_url) {
                throw new Error("Failed to start checkout");
            }
            window.location.href = data.checkout_url; // Stripe Hosted Checkout
        } catch (err) {
            if (err?.response?.status === 401) {
                setError("Please sign in again to continue.");
                navigate("/login", { replace: true, state: { redirectTo: "/payment" } });
                return;
            }
            setError(String(err.message || err));
            setProcessing(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 flex items-start justify-center py-16 px-4">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-2">{page.title || "Complete Subscription"}</h2>
                <p className="text-sm text-gray-600 mb-2">{page.subtitle}</p>
                <p className="text-sm text-gray-600 mb-6">
                    Signing up as <strong>{role}</strong> — <span className="font-mono">{email}</span>
                </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {plans.map(plan => (
                <label key={plan.id} className={`p-4 rounded-lg border ${selectedPlan === plan.id ? "border-emerald-600 bg-emerald-50" : "border-gray-200"} cursor-pointer`}>
                    <input type="radio" name="plan" value={plan.id}
                    checked={selectedPlan === plan.id}
                    onChange={() => setSelectedPlan(Number(plan.id))}
                    className="mr-2"
                    />
                    <div className="flex items-center justify-between">
                    <div>
                        <div className="font-semibold">{plan.name}</div>
                        <div className="text-sm text-gray-600">{plan.description}</div>
                    </div>
                    <div className="text-lg font-medium">
                        {(plan.unit_amount/100).toLocaleString(undefined,{style:"currency",currency:(plan.currency||"sgd").toUpperCase()})}
                        <span className="text-sm text-gray-500"> / {plan.interval}</span>
                    </div>
                    </div>
                </label>
                ))}
            </div>

            <form onSubmit={onPay} className="space-y-4">
                {error && <div className="text-sm text-red-600">{error}</div>}
                <div className="flex items-center justify-between gap-4">
                <button type="submit" disabled={processing}
                    className="px-5 py-2 rounded-md bg-emerald-700 text-white font-medium disabled:opacity-60">
                    {processing ? "Processing…" : "Continue to secure checkout"}
                </button>
                <button type="button" className="px-4 py-2 rounded-md border"
                    onClick={() => { if (role === "agent") window.location.href="/properties"; else window.location.href="/dashboard";}}>
                    Skip (demo)
                </button>
                </div>
                <p className="text-xs text-gray-500 mt-4">{page.disclaimer}</p>
            </form>
            </div>
        </main>
    );
}
