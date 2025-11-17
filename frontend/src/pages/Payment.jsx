// src/Payment.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

// PUBLIC API (no auth)
const publicApi = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
});

// PRIVATE API (auth only when token exists)
const privateApi = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
});

privateApi.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default function Payment() {
    const loc = useLocation();
    const navigate = useNavigate();

    // Comes from SignUp: { role, email }
    const { state } = loc;
    const role = state?.role ?? "homeowner";
    const email = state?.email ?? "unknown@example.com";

    const [page, setPage] = useState({ title: "", subtitle: "", disclaimer: "" });
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");

    // Load payment page + plans (PUBLIC → no token)
    useEffect(() => {
        (async () => {
            try {
                const [pgRes, plRes] = await Promise.all([
                    publicApi.get("/public/payment-page"),
                    publicApi.get("/public/plans"),
                ]);

                setPage(pgRes.data);
                setPlans(plRes.data);
                setSelectedPlan(Number(plRes.data?.[0]?.id ?? 0));
            } catch (e) {
                const msg =
                    e?.response?.data?.error ||
                    e?.message ||
                    "Failed to load payment page.";
                setError(`Failed to load payment page: ${msg}`);
            }
        })();
    }, []);

    // Continue to checkout
    const onPay = async (e) => {
        e.preventDefault();
        setProcessing(true);

        try {
            if (!selectedPlan) throw new Error("Please select a plan.");

            // Checkout should also be PUBLIC during signup
            const { data } = await publicApi.post("/payments/checkout", {
                plan_id: selectedPlan,
                email, // optional: helps track user
            });

            if (!data?.checkout_url) throw new Error("Failed to start checkout");

            window.location.href = data.checkout_url; // Stripe Hosted Checkout
        } catch (err) {
            const msg = err?.response?.data?.error || err.message;

            setError(msg);
            setProcessing(false);
        }
    };

    // Skip (demo)
    const onSkip = () => {
        if (role === "agent") {
            navigate("/properties");
        } else {
            navigate("/dashboard");
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 flex items-start justify-center py-16 px-4">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-8">

                <h2 className="text-2xl font-bold mb-2">
                    {page.title || "Complete Subscription"}
                </h2>
                <p className="text-sm text-gray-600 mb-2">{page.subtitle}</p>
                <p className="text-sm text-gray-600 mb-6">
                    Signing up as <strong>{role}</strong> —{" "}
                    <span className="font-mono">{email}</span>
                </p>

                {/* Plans */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {plans.map((plan) => (
                        <label
                            key={plan.id}
                            className={`p-4 rounded-lg border ${selectedPlan === plan.id
                                    ? "border-emerald-600 bg-emerald-50"
                                    : "border-gray-200"
                                } cursor-pointer`}
                        >
                            <input
                                type="radio"
                                name="plan"
                                value={plan.id}
                                checked={selectedPlan === plan.id}
                                onChange={() => setSelectedPlan(Number(plan.id))}
                                className="mr-2"
                            />
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-semibold">{plan.name}</div>
                                    <div className="text-sm text-gray-600">
                                        {plan.description}
                                    </div>
                                </div>
                                <div className="text-lg font-medium">
                                    {(plan.unit_amount / 100).toLocaleString(undefined, {
                                        style: "currency",
                                        currency: (plan.currency || "sgd").toUpperCase(),
                                    })}
                                    <span className="text-sm text-gray-500">
                                        {" "}
                                        / {plan.interval}
                                    </span>
                                </div>
                            </div>
                        </label>
                    ))}
                </div>

                <form onSubmit={onPay} className="space-y-4">
                    {error && (
                        <div className="text-sm text-red-600">{error}</div>
                    )}

                    <div className="flex items-center justify-between gap-4">
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-5 py-2 rounded-md bg-emerald-700 text-white font-medium disabled:opacity-60"
                        >
                            {processing ? "Processing…" : "Continue to secure checkout"}
                        </button>

                        <button
                            type="button"
                            className="px-4 py-2 rounded-md border"
                            onClick={onSkip}
                        >
                            Skip (demo)
                        </button>
                    </div>

                    <p className="text-xs text-gray-500 mt-4">{page.disclaimer}</p>
                </form>
            </div>
        </main>
    );
}
