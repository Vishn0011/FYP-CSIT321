// src/SignUp.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export default function SignUp() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    password: "", confirmPassword: "",
    agreeTerms: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [role, setRole] = useState(form.role || "homeowner");
  const updateRole = (nextRole) => {
    setRole(nextRole);
    onChange({ target: { name: "role", value: nextRole } });
  };

  const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  const PHONE_SG_RE = /^(?:\+65\s?)?(?:[689]\d{7})$/;

  const onChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setFieldErrors({});

    const errs = {};
    if (!form.agreeTerms) {
      errs.agreeTerms = "Please accept the Terms and Privacy Policy.";
    }
    if (!(form.password === form.confirmPassword)) {
      errs.confirmPassword = "Passwords do not match.";
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      errs.email = "Enter a valid email address.";
    }
    const phoneNorm = form.phone.replace(/[-\s]/g, "");
    if (!PHONE_SG_RE.test(phoneNorm)) {
      errs.phone = "Enter a valid Singapore phone number.";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/api/register_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          role,
        }),
      });
      if (res.status === 409) {
        setFieldErrors({ email: "An account with that email already exists." });
        return;
      }
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setSuccess("Sign up successful! You can now log in.");
    } catch (err) {
      setError(err.message || "Sign up failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="bg-gray-50 text-gray-800 min-h-screen flex flex-col">
      <section className="flex items-center justify-center flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="bg-white p-8 shadow-lg rounded-xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Create your account</h1>
            </div>
            
            {/* Role selector*/}
            <div className="mb-6">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => updateRole("agent")}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition ${
                    role === "agent"
                      ? "bg-white shadow text-gray-700"
                      : "text-gray-500"
                  }`}
                >
                  Property Agent
                </button>
                <button
                  type="button"
                  onClick={() => updateRole("homeowner")}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition ${
                    role === "homeowner"
                      ? "bg-white shadow text-gray-700"
                      : "text-gray-500"
                  }`}
                >
                  Homeowner
                </button>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              {/* Keep role as a real form field for submission */}
              <input type="hidden" name="role" value={role} />
              
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                <div className="mt-1">
                  <input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    required
                    aria-invalid={!!fieldErrors.name}
                    className={`w-full px-3 py-2 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 ${
                      fieldErrors.name
                        ? "border border-red-500 focus:ring-red-600 focus:border-red-600"
                        : "border border-gray-300 focus:ring-emerald-700 focus:border-emerald-700"
                    }`}
                    placeholder="Your full name"
                  />
                </div>
                {fieldErrors.name && (
                  <span className="text-sm text-red-600 mt-1 block">{fieldErrors.name}</span>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={onChange}
                    required
                    aria-invalid={!!fieldErrors.email}
                    className={`w-full px-3 py-2 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 ${
                      fieldErrors.email
                        ? "border border-red-500 focus:ring-red-600 focus:border-red-600"
                        : "border border-gray-300 focus:ring-emerald-700 focus:border-emerald-700"
                    }`}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                {fieldErrors.email && (
                  <span className="text-sm text-red-600 mt-1 block">{fieldErrors.email}</span>
                )}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone number</label>
                <div className="mt-1">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={onChange}
                    required
                    aria-invalid={!!fieldErrors.phone}
                    className={`w-full px-3 py-2 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 ${
                      fieldErrors.phone
                        ? "border border-red-500 focus:ring-red-600 focus:border-red-600"
                        : "border border-gray-300 focus:ring-emerald-700 focus:border-emerald-700"
                    }`}
                    placeholder="+65 91234567"
                    autoComplete="tel"
                  />
                </div>
                {fieldErrors.phone && (
                  <span className="text-sm text-red-600 mt-1 block">{fieldErrors.phone}</span>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={onChange}
                    required
                    minLength={8}
                    aria-invalid={!!fieldErrors.password}
                    className={`w-full px-3 py-2 pr-12 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 ${
                      fieldErrors.password
                        ? "border border-red-500 focus:ring-red-600 focus:border-red-600"
                        : "border border-gray-300 focus:ring-emerald-700 focus:border-emerald-700"
                    }`}
                    placeholder="••••••••"
                    autoComplete="new-password"
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
                {fieldErrors.password && (
                  <span className="text-sm text-red-600 mt-1 block">{fieldErrors.password}</span>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm password</label>
                <div className="mt-1 relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPw ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={onChange}
                    required
                    minLength={8}
                    aria-invalid={!!fieldErrors.confirmPassword}
                    className={`w-full px-3 py-2 pr-12 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 ${
                      fieldErrors.confirmPassword
                        ? "border border-red-500 focus:ring-red-600 focus:border-red-600"
                        : "border border-gray-300 focus:ring-emerald-700 focus:border-emerald-700"
                    }`}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw((s) => !s)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showConfirmPw ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <span className="text-sm text-red-600 mt-1 block">{fieldErrors.confirmPassword}</span>
                )}
              </div>

              {/* Terms */}
              <div className="flex items-start gap-2">
                <input
                  id="agreeTerms"
                  type="checkbox"
                  name="agreeTerms"
                  checked={form.agreeTerms}
                  onChange={onChange}
                  aria-invalid={!!fieldErrors.agreeTerms}
                  className="h-4 w-4 text-emerald-700 focus:ring-emerald-700 border-gray-300 rounded"
                />
                <label htmlFor="agreeTerms" className="text-sm text-gray-700">
                  I agree to the{" "}
                  <a href="#" target="_blank" rel="noreferrer" className="text-emerald-700 hover:text-emerald-900">
                    Terms and Conditions
                  </a>{" "}
                  and the{" "}
                  <a href="#" target="_blank" rel="noreferrer" className="text-emerald-700 hover:text-emerald-900">
                    Privacy Policy
                  </a>.
                </label>
              </div>
              {fieldErrors.agreeTerms && (
                <span className="text-sm text-red-600 mt-0 block">{fieldErrors.agreeTerms}</span>
              )}

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                <button
                  className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 disabled:opacity-60"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create account"}
                </button>
              </div>

              {/* Success / Info */}
              {success && <p className="text-sm text-emerald-700 mt-2">{success}</p>}
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

            </form>
          </div>

          <div className="text-center text-sm text-gray-600">
            <p>
              Already have an account?{" "}
              <Link className="font-medium text-emerald-800 hover:text-emerald-900" to="/login">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
