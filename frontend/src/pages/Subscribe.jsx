// src/Subscribe.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function Subscribe() {
  const loc = useLocation();
  const navigate = useNavigate();
  // state coming from signup: { role: 'homeowner'|'agent', email }
  const { state } = loc;
  const role = state?.role ?? "homeowner";
  const email = state?.email ?? "unknown@example.com";

  const [page, setPage] = useState({ title: "", subtitle: "", disclaimer: "" });
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  // NEW: subscription state
  const [subscription, setSubscription] = useState(null);
  const [subLoading, setSubLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);

  const hasActiveSubscription = !!subscription;

  useEffect(() => {
    (async () => {
      try {
        setError("");

        // Load payment-page config + plans + current subscription in parallel
        const [pgRes, plRes, subRes] = await Promise.all([
          api.get("api/public/payment-page"),
          api.get("api/public/plans"),
          api
            .get("api/subscriptions/me")
            .catch((e) => {
              // If not logged in / 404, just treat as no active sub
              if (e?.response?.status === 401 || e?.response?.status === 404) {
                return { data: { active: false, subscription: null } };
              }
              throw e;
            }),
        ]);

        const pg = pgRes.data;
        const pls = plRes.data;
        const subData = subRes.data || {};

        setPage(pg);
        setPlans(pls);

        if (!hasActiveSubscription && pls?.length > 0) {
          setSelectedPlan(Number(pls[0].id));
        }

        if (subData.active && subData.subscription) {
          setSubscription(subData.subscription);
        } else {
          setSubscription(null);
        }
      } catch (e) {
        const msg =
          e?.response?.data?.error ||
          e?.message ||
          "Failed to load payment page.";
        setError(`Failed to load payment page: ${msg}`);
      } finally {
        setSubLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSubscription = async () => {
    setSubLoading(true);
    try {
      const { data } = await api.get("api/subscriptions/me");
      if (data.active && data.subscription) {
        setSubscription(data.subscription);
      } else {
        setSubscription(null);
      }
    } catch (e) {
      // if 401/404, just treat as none
      setSubscription(null);
    } finally {
      setSubLoading(false);
    }
  };

  const onPay = async (e) => {
    e.preventDefault();
    setError("");

    // Extra front-end guard (backend also enforces this)
    if (hasActiveSubscription) {
      setError(
        "You already have an active subscription. Please cancel it first if you want to change plans."
      );
      return;
    }

    setProcessing(true);
    try {
      if (!selectedPlan) throw new Error("Please select a plan.");

      const { data } = await api.post("api/payments/checkout", {
        plan_id: selectedPlan,
      });

      if (!data?.checkout_url) {
        throw new Error("Failed to start checkout");
      }

      window.location.href = data.checkout_url; // Stripe Hosted Checkout
    } catch (err) {
      if (err?.response?.status === 401) {
        setError("Please sign in again to continue.");
        navigate("/login", {
          replace: true,
          state: { redirectTo: "/subscribe" },
        });
        return;
      }
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err.message ||
        String(err);
      setError(msg);
    } finally {
      setProcessing(false);
    }
  };

  const onCancelSubscription = async () => {
    if (!hasActiveSubscription) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel your current subscription? This action cannot be undone."
    );
    if (!confirmed) return;

    setCancelLoading(true);
    setError("");
    try {
      await api.post("api/subscriptions/cancel");
      await refreshSubscription();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err.message ||
        String(err);
      setError(`Failed to cancel subscription: ${msg}`);
    } finally {
      setCancelLoading(false);
    }
  };

  const formatMoney = (amount, currency = "SGD") =>
    (amount / 100).toLocaleString(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    });

  const activePlanLabel = subscription
    ? `${subscription.plan_name} – ${formatMoney(
        subscription.unit_amount,
        subscription.currency || "SGD"
      )} / ${subscription.interval}`
    : "";

  const nextBilling =
    subscription && subscription.current_period_end
      ? new Date(subscription.current_period_end).toLocaleString()
      : null;

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

        {/* Current subscription status */}
        <div className="mb-6">
          {subLoading ? (
            <div className="text-sm text-gray-500">Checking subscription…</div>
          ) : hasActiveSubscription ? (
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 space-y-1">
              <div className="text-sm font-semibold text-emerald-800">
                You have an active subscription
              </div>
              <div className="text-sm text-emerald-900">{activePlanLabel}</div>
              {nextBilling && (
                <div className="text-xs text-emerald-900">
                  Next billing / period end: {nextBilling}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-3 items-center">
                <button
                  type="button"
                  onClick={onCancelSubscription}
                  disabled={cancelLoading}
                  className="px-4 py-2 rounded-md border border-emerald-700 text-emerald-800 text-sm font-medium disabled:opacity-60"
                >
                  {cancelLoading ? "Cancelling…" : "Cancel current subscription"}
                </button>
                <span className="text-xs text-emerald-900">
                  To change plans, cancel first, then choose a new plan below.
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              You don&apos;t have an active subscription yet. Choose a plan
              below.
            </div>
          )}
        </div>

        {/* Plan selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {plans.map((plan) => (
            <label
              key={plan.id}
              className={`p-4 rounded-lg border ${
                selectedPlan === plan.id
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-gray-200"
              } ${
                hasActiveSubscription
                  ? "opacity-60 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
            >
              <input
                type="radio"
                name="plan"
                value={plan.id}
                checked={selectedPlan === plan.id}
                onChange={() =>
                  !hasActiveSubscription &&
                  setSelectedPlan(Number(plan.id))
                }
                className="mr-2"
                disabled={hasActiveSubscription}
              />
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{plan.name}</div>
                  <div className="text-sm text-gray-600">
                    {plan.description}
                  </div>
                </div>
                <div className="text-lg font-medium">
                  {formatMoney(plan.unit_amount, plan.currency || "SGD")}
                  <span className="text-sm text-gray-500">
                    {" "}
                    / {plan.interval}
                  </span>
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Actions */}
        <form onSubmit={onPay} className="space-y-4">
          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex items-center justify-between gap-4">
            <button
              type="submit"
              disabled={processing || hasActiveSubscription}
              className="px-5 py-2 rounded-md bg-emerald-700 text-white font-medium disabled:opacity-60"
            >
              {hasActiveSubscription
                ? "Active subscription in place"
                : processing
                ? "Processing…"
                : "Continue to secure checkout"}
            </button>

            <button
              type="button"
              className="px-4 py-2 rounded-md border"
              onClick={() => {
                if (role === "agent") window.location.href = "/properties";
                else window.location.href = "/dashboard";
              }}
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
