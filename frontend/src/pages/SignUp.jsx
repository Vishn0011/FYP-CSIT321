// src/SignUp.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";


const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export default function SignUp() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        agreeTerms: false,
        agencyName: "",
        ceaRegNo: "",
        agencyLicenseNo: "",
        yearsExperience: "",
        idLast4: "",
        supportingUrl: "",
    });

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [showPw, setShowPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);
    const { executeRecaptcha } = useGoogleReCaptcha();

    const [role, setRole] = useState("homeowner");
    const updateRole = (nextRole) => {
        setRole(nextRole);
        setFieldErrors({});
        onChange({ target: { name: "role", value: nextRole } });
        if (nextRole === "homeowner") {
            setForm((s) => ({
                ...s,
                agencyName: "",
                ceaRegNo: "",
                agencyLicenseNo: "",
                yearsExperience: "",
                idLast4: "",
                supportingUrl: "",
            }));
        }
    };

    const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    const PHONE_SG_RE = /^(?:\+65\s?)?(?:[689]\d{7})$/;
    const CEA_REG_RE = /^R\d{6}[A-Z]$/i;
    const AGENCY_LICENSE_RE = /^L\d{7}[A-Z]$/i;
    const ID_LAST4_RE = /^[STFG]\d{3}$/i;

    const onChange = (e) => {
        const { name, type, checked, value } = e.target;
        setForm((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
        if (fieldErrors[name]) {
            setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const navigate = useNavigate();

    // Manual signup
    const onSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setFieldErrors({});

        // Existing validation logic...
        const errs = {};
        if (!form.agreeTerms)
            errs.agreeTerms = "Please accept the Terms and Privacy Policy.";
        if (form.password !== form.confirmPassword)
            errs.confirmPassword = "Passwords do not match.";
        if (!EMAIL_RE.test(form.email.trim()))
            errs.email = "Enter a valid email address.";

        const phoneNorm = form.phone.replace(/[-\s]/g, "");
        if (!PHONE_SG_RE.test(phoneNorm))
            errs.phone = "Enter a valid Singapore phone number.";

        let normalizedCea = "";
        let normalizedLicense = "";
        let normalizedId = "";
        let parsedYears = null;

        if (role === "agent") {
            if (!form.agencyName.trim())
                errs.agencyName = "Enter your agency name.";
            normalizedCea = form.ceaRegNo.trim().toUpperCase();
            if (!CEA_REG_RE.test(normalizedCea))
                errs.ceaRegNo = "Use the format R123456X.";

            normalizedLicense = form.agencyLicenseNo.trim().toUpperCase();
            if (!AGENCY_LICENSE_RE.test(normalizedLicense))
                errs.agencyLicenseNo = "Use the format L7654321X.";

            if (form.yearsExperience === "") {
                errs.yearsExperience = "Enter your years of experience.";
            } else {
                parsedYears = Number.parseInt(form.yearsExperience, 10);
                if (!Number.isFinite(parsedYears) || parsedYears < 0 || parsedYears > 60)
                    errs.yearsExperience = "Enter a value between 0 and 60.";
            }

            normalizedId = form.idLast4.trim().toUpperCase();
            if (normalizedId && !ID_LAST4_RE.test(normalizedId))
                errs.idLast4 = "Use the prefix letter followed by the last 3 digits (e.g. S123).";
        }

        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            return;
        }

        // === Payload ===
        const payload = {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            password: form.password,
            role,
        };

        if (role === "agent") {
            payload.agency_name = form.agencyName.trim();
            payload.cea_reg_no = normalizedCea;
            payload.agency_license_no = normalizedLicense;
            payload.years_experience = parsedYears;
            if (normalizedId) payload.id_last4 = normalizedId;
            if (form.supportingUrl.trim()) payload.supporting_url = form.supportingUrl.trim();
        }

        // === RUN CAPTCHA — ADDED HERE ===
        if (executeRecaptcha) {
            const captchaToken = await executeRecaptcha("signup_action");
            payload.captcha = captchaToken; // <-- ADDED
        }

        try {
            setSubmitting(true);
            const res = await fetch(`${API_BASE}/api/register_user`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => null);

            if (res.status === 409) {
                setFieldErrors({ email: "An account with that email already exists." });
                return;
            }

            if (!res.ok) {
                if (res.status === 400 && data?.field) {
                    setFieldErrors({ [data.field]: data.error });
                    return;
                }
                throw new Error((data && data.error) || `HTTP ${res.status}`);
            }

            if (role === "agent") {
                setError("Your account is pending admin approval.");
            } else {
                navigate("/subscribe", {
                    state: { role, email: form.email.trim() },
                });
            }
        } catch (err) {
            setError(err.message || "Sign up failed.");
        } finally {
            setSubmitting(false);
        }
    };

    // Google signup
    async function handleGoogleSignup(credentialResponse) {
        try {
            const token = credentialResponse.credential;
            const res = await fetch(`${API_BASE}/auth/google/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, role }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Google sign-up failed");

            if (data.user.role === "agent" && data.user.status === "pending") {
                setError("Your account is pending admin approval. You cannot log in yet.");
            } else {
                navigate("/subscribe", {
                    state: { role: data.user.role, email: data.user.email },
                });
            }
        } catch (err) {
            setError(err.message);
        }
    }

    const inputClasses =
        "w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500";


    return (
        <main className="min-h-screen flex flex-col bg-gray-50 text-gray-800 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
            <section className="flex items-center justify-center flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 transition-colors">
                <div className="w-full max-w-md space-y-8">
                    <div className="rounded-2xl border border-gray-200 bg-white/95 p-8 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Create your account
                            </h1>
                        </div>

                        {/* Role selector */}
                        <div className="mb-6">
                            <div className="flex bg-gray-100 rounded-lg p-1 dark:bg-zinc-800/60">
                                <button
                                    type="button"
                                    onClick={() => updateRole("agent")}
                                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition ${role === "agent"
                                            ? "bg-white shadow text-gray-700 dark:bg-zinc-900 dark:text-white"
                                            : "text-gray-500 dark:text-zinc-400"
                                        }`}
                                >
                                    Property Agent
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateRole("homeowner")}
                                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition ${role === "homeowner"
                                            ? "bg-white shadow text-gray-700 dark:bg-zinc-900 dark:text-white"
                                            : "text-gray-500 dark:text-zinc-400"
                                        }`}
                                >
                                    Homeowner
                                </button>
                            </div>
                        </div>

                        <form onSubmit={onSubmit} className="space-y-6">
                            <input type="hidden" name="role" value={role} />

                            {/* Name */}
                            <div>
                                <label
                                    htmlFor="name"
                                    className="block text-sm font-medium text-gray-700 dark:text-zinc-200"
                                >
                                    Name
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="name"
                                        name="name"
                                        value={form.name}
                                        onChange={onChange}
                                        required
                                        className={inputClasses}
                                        placeholder="Your full name"
                                    />
                                </div>
                                {fieldErrors.name && (
                                    <span className="text-sm text-red-600 dark:text-red-400 mt-1 block">
                                        {fieldErrors.name}
                                    </span>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-gray-700 dark:text-zinc-200"
                                >
                                    Email address
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={form.email}
                                        onChange={onChange}
                                        required
                                        className={inputClasses}
                                        placeholder="you@example.com"
                                    />
                                </div>
                                {fieldErrors.email && (
                                    <span className="text-sm text-red-600 dark:text-red-400 mt-1 block">
                                        {fieldErrors.email}
                                    </span>
                                )}
                            </div>

                            {/* Phone */}
                            <div>
                                <label
                                    htmlFor="phone"
                                    className="block text-sm font-medium text-gray-700 dark:text-zinc-200"
                                >
                                    Phone number
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        value={form.phone}
                                        onChange={onChange}
                                        required
                                        className={inputClasses}
                                        placeholder="+65 91234567"
                                    />
                                </div>
                                {fieldErrors.phone && (
                                    <span className="text-sm text-red-600 dark:text-red-400 mt-1 block">
                                        {fieldErrors.phone}
                                    </span>
                                )}
                            </div>

                            {/* Password */}
                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 dark:text-zinc-200"
                                >
                                    Password
                                </label>
                                <div className="mt-1 relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPw ? "text" : "password"}
                                        value={form.password}
                                        onChange={onChange}
                                        required
                                        minLength={8}
                                        className={`${inputClasses} pr-12`}
                                        placeholder="••••••••"
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

                            {/* Confirm Password */}
                            <div>
                                <label
                                    htmlFor="confirmPassword"
                                    className="block text-sm font-medium text-gray-700 dark:text-zinc-200"
                                >
                                    Confirm password
                                </label>
                                <div className="mt-1 relative">
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showConfirmPw ? "text" : "password"}
                                        value={form.confirmPassword}
                                        onChange={onChange}
                                        required
                                        minLength={8}
                                        className={`${inputClasses} pr-12`}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPw((s) => !s)}
                                        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 dark:text-zinc-400"
                                    >
                                        <span className="material-symbols-outlined text-lg">
                                            {showConfirmPw ? "visibility_off" : "visibility"}
                                        </span>
                                    </button>
                                </div>
                            </div>


                            {role === "agent" && (
                                <div className="border-t border-gray-200 pt-4 space-y-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-100">
                                            Property Agent Verification
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">
                                            Provide your CEA credentials so we can verify your account before activation.
                                        </p>
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="agencyName"
                                            className="block text-sm font-medium text-gray-700 dark:text-zinc-200"
                                        >
                                            Agency name
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                id="agencyName"
                                                name="agencyName"
                                                value={form.agencyName}
                                                onChange={onChange}
                                                required
                                                className={inputClasses}
                                                placeholder="Your agency / brokerage"
                                            />
                                        </div>
                                        {fieldErrors.agencyName && (
                                            <span className="text-sm text-red-600 dark:text-red-400 mt-1 block">
                                                {fieldErrors.agencyName}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="ceaRegNo"
                                            className="block text-sm font-medium text-gray-700 dark:text-zinc-200"
                                        >
                                            CEA registration number
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                id="ceaRegNo"
                                                name="ceaRegNo"
                                                value={form.ceaRegNo}
                                                onChange={onChange}
                                                required
                                                maxLength={8}
                                                className={`${inputClasses} uppercase`}
                                                placeholder="R123456X"
                                            />
                                        </div>
                                        {fieldErrors.ceaRegNo && (
                                            <span className="text-sm text-red-600 dark:text-red-400 mt-1 block">
                                                {fieldErrors.ceaRegNo}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="agencyLicenseNo"
                                            className="block text-sm font-medium text-gray-700 dark:text-zinc-200"
                                        >
                                            Agency licence number
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                id="agencyLicenseNo"
                                                name="agencyLicenseNo"
                                                value={form.agencyLicenseNo}
                                                onChange={onChange}
                                                required
                                                maxLength={9}
                                                className={`${inputClasses} uppercase`}
                                                placeholder="L7654321X"
                                            />
                                        </div>
                                        {fieldErrors.agencyLicenseNo && (
                                            <span className="text-sm text-red-600 dark:text-red-400 mt-1 block">
                                                {fieldErrors.agencyLicenseNo}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="yearsExperience"
                                            className="block text-sm font-medium text-gray-700 dark:text-zinc-200"
                                        >
                                            Years of experience
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                id="yearsExperience"
                                                name="yearsExperience"
                                                type="number"
                                                min={0}
                                                max={60}
                                                step={1}
                                                value={form.yearsExperience}
                                                onChange={onChange}
                                                required
                                                className={inputClasses}
                                                placeholder="e.g. 5"
                                            />
                                        </div>
                                        {fieldErrors.yearsExperience && (
                                            <span className="text-sm text-red-600 dark:text-red-400 mt-1 block">
                                                {fieldErrors.yearsExperience}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="idLast4"
                                            className="block text-sm font-medium text-gray-700 dark:text-zinc-200"
                                        >
                                            NRIC / FIN prefix + last 3 digits (optional)
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                id="idLast4"
                                                name="idLast4"
                                                value={form.idLast4}
                                                onChange={onChange}
                                                maxLength={4}
                                                className={`${inputClasses} uppercase`}
                                                placeholder="S123"
                                            />
                                        </div>
                                        {fieldErrors.idLast4 && (
                                            <span className="text-sm text-red-600 dark:text-red-400 mt-1 block">
                                                {fieldErrors.idLast4}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="supportingUrl"
                                            className="block text-sm font-medium text-gray-700 dark:text-zinc-200"
                                        >
                                            Supporting document URL (optional)
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                id="supportingUrl"
                                                name="supportingUrl"
                                                type="url"
                                                value={form.supportingUrl}
                                                onChange={onChange}
                                                className={inputClasses}
                                                placeholder="https://drive.google.com/..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Terms */}
                            <div className="flex items-start gap-2">
                                <input
                                    id="agreeTerms"
                                    type="checkbox"
                                    name="agreeTerms"
                                    checked={form.agreeTerms}
                                    onChange={onChange}
                                    className="h-4 w-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 dark:border-zinc-600 dark:bg-zinc-900"
                                />
                                <label htmlFor="agreeTerms" className="text-sm text-gray-700 dark:text-zinc-200">
                                    I agree to the{" "}
                                    <a
                                        href="#"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
                                    >
                                        Terms and Conditions
                                    </a>{" "}
                                    and{" "}
                                    <a
                                        href="#"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
                                    >
                                        Privacy Policy
                                    </a>
                                    .
                                </label>
                            </div>

                            <div className="flex gap-3 flex-wrap">
                                <button
                                    className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-60"
                                    type="submit"
                                    disabled={submitting}
                                >
                                    {submitting ? "Creating..." : "Create account"}
                                </button>
                            </div>
                        </form>

                        {/* Divider */}
                        <div className="my-6 flex items-center">
                            <div className="flex-grow border-t border-gray-300"></div>
                            <span className="mx-4 text-gray-400 text-sm dark:text-zinc-400">or sign up with</span>
                            <div className="flex-grow border-t border-gray-300"></div>
                        </div>

                        {/* Google Sign-up button */}
                        {role === "agent" ? (
                            <p className="text-sm text-gray-500 text-center dark:text-zinc-400">
                                Google sign-up is unavailable for Property Agents. Please complete the verification form above.
                            </p>
                        ) : (
                            <div className="flex justify-center">
                                <GoogleLogin
                                    onSuccess={handleGoogleSignup}
                                    onError={() => setError("Google Sign-up Failed")}
                                />
                            </div>
                        )}

                        {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
                    </div>

                    <div className="text-center text-sm text-gray-600 dark:text-zinc-400">
                        <p>
                            Already have an account?{" "}
                            <Link
                                className="font-medium text-emerald-800 hover:text-emerald-900"
                                to="/login"
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}
