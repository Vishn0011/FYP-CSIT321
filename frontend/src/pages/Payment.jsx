// src/Payment.jsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const PLANS = [
    { id: "monthly", name: "Monthly", price: 25.00, desc: "Monthly Subscription" },
    { id: "yearly", name: "Yearly", price: 250.00, desc: "Yearly Subscription" },
];

export default function Payment() {
    const loc = useLocation();
    const navigate = useNavigate();
    // state coming from signup: { role: 'homeowner'|'agent', email }
    const { state } = loc;
    const role = state?.role ?? "homeowner";
    const email = state?.email ?? "unknown@example.com";

    const [selectedPlan, setSelectedPlan] = useState(PLANS[0].id);
    const [cardName, setCardName] = useState("");
    const [cardNumber, setCardNumber] = useState("");
    const [expiry, setExpiry] = useState("");
    const [cvc, setCvc] = useState("");
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");

    // very dumb client-side validation (mock only)
    const validateCard = () => {
        if (cardName.trim().length < 2) return "Invalid name on card.";
        if (!/^\d{12,19}$/.test(cardNumber.replace(/\s+/g, ""))) return "Card number must be 12–19 digits (mock).";
        if (!/^\d{2}\/\d{2}$/.test(expiry)) return "Expiry must be in MM/YY format.";
        if (!/^\d{3,4}$/.test(cvc)) return "CVC must be 3 or 4 digits.";
        return "";
    };

    const onPay = (e) => {
        e.preventDefault();
        setError("");
        const v = validateCard();
        if (v) {
            setError(v);
            return;
        }
        setProcessing(true);
        // Simulate processing delay
        setTimeout(() => {
            setProcessing(false);
            // "Persist" subscription locally — for demo we'll use localStorage
            const subscriptions = JSON.parse(localStorage.getItem("mock_subs") || "[]");
            subscriptions.push({
                email,
                role,
                plan: selectedPlan,
                paidAt: new Date().toISOString(),
                tx: `MOCKTX-${Math.random().toString(36).slice(2, 9).toUpperCase()}`
            });
            localStorage.setItem("mock_subs", JSON.stringify(subscriptions));

            // route to role-specific homepage
            if (role === "agent") navigate("/properties");
            else navigate("/dashboard");
        }, 1100);
    };

    return (
        <main className="min-h-screen bg-gray-50 flex items-start justify-center py-16 px-4">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-2">Complete Subscription</h2>
                <p className="text-sm text-gray-600 mb-6">
                    Signing up as <strong>{role}</strong> — <span className="font-mono">{email}</span>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {PLANS.map(plan => (
                        <label key={plan.id} className={`p-4 rounded-lg border ${selectedPlan === plan.id ? "border-emerald-600 bg-emerald-50" : "border-gray-200"} cursor-pointer`}>
                            <input
                                type="radio"
                                name="plan"
                                value={plan.id}
                                checked={selectedPlan === plan.id}
                                onChange={() => setSelectedPlan(plan.id)}
                                className="mr-2"
                            />
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-semibold">{plan.name}</div>
                                    <div className="text-sm text-gray-600">{plan.desc}</div>
                                </div>
                                <div className="text-lg font-medium">${plan.price.toFixed(2)}</div>
                            </div>
                        </label>
                    ))}
                </div>

                <form onSubmit={onPay} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Name on card</label>
                        <input value={cardName} onChange={e => setCardName(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-md" placeholder="John Doe" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Card number (mock)</label>
                        <input value={cardNumber} onChange={e => setCardNumber(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-md" placeholder="4242424242424242" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Expiry (MM/YY)</label>
                            <input value={expiry} onChange={e => setExpiry(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-md" placeholder="09/27" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">CVC</label>
                            <input value={cvc} onChange={e => setCvc(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-md" placeholder="123" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Billing ZIP (optional)</label>
                            <input className="w-full mt-1 px-3 py-2 border rounded-md" placeholder="000000" />
                        </div>
                    </div>

                    {error && <div className="text-sm text-red-600">{error}</div>}

                    <div className="flex items-center justify-between gap-4">
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-5 py-2 rounded-md bg-emerald-700 text-white font-medium disabled:opacity-60">
                            {processing ? "Processing…" : `Pay $${PLANS.find(p => p.id === selectedPlan).price.toFixed(2)}`}
                        </button>

                        <button
                            type="button"
                            className="px-4 py-2 rounded-md border"
                            onClick={() => {
                                // allow user to skip payment in demo
                                if (role === "agent") navigate("/properties");
                                else navigate("/dashboard");
                            }}
                        >
                            Skip (demo)
                        </button>
                    </div>

                    <p className="text-xs text-gray-500 mt-4">
                        This is a demo payment page — no real payments occur. Subscriptions are saved in <span className="font-mono">localStorage</span>.
                    </p>
                </form>
            </div>
        </main>
    );
}
