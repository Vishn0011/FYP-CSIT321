// src/SignUp.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./css/HomePage.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export default function SignUp() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    password: "", confirmPassword: "",
    agreeTerms: false, // text already mentions Terms + Privacy
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

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
          role: "homeowner",
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
    <div className="home-page">
      <header className="site-header card">
        <div className="brand">
          <Link to="/" aria-label="Home" className="brand-link">
            <span className="brand-dot" /> SGProp
          </Link>
        </div>
        <nav className="main-nav" aria-label="Primary">
          <Link className="nav-link" to="/">Home</Link>
          <Link className="nav-link" to="/properties">Property Listing</Link>
          <Link className="nav-link" to="/analytics">Analytics</Link>
          <Link className="nav-link" to="/announcement">Announcement</Link>
        </nav>
        <div className="auth-actions">
          <Link className="btn btn-outline" to="/login">Login</Link>
          <Link className="btn btn-primary" to="/signup">Sign up</Link>
        </div>
      </header>

      <main className="container">
        <section className="card" style={{ marginTop: 18, padding: "24px 18px" }}>
          <h1 className="hero-title" style={{ marginBottom: 12 }}>Create your account</h1>

          <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 520 }}>
            <label className="form-label">
              <span className="label">Name</span>
              <input className={`input ${fieldErrors.name ? "input-error" : ""}`} name="name" value={form.name} onChange={onChange} required aria-invalid={!!fieldErrors.name}/>
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </label>

            <label className="form-label">
              <span className="label">Email address</span>
              <input className={`input ${fieldErrors.email ? "input-error" : ""}`} name="email" type="email" value={form.email} onChange={onChange} required aria-invalid={!!fieldErrors.email}/>
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </label>

            <label className="form-label">
              <span className="label">Phone number</span>
              <input className={`input ${fieldErrors.phone ? "input-error" : ""}`} name="phone" type="tel" value={form.phone} onChange={onChange} required aria-invalid={!!fieldErrors.phone} placeholder="+65 91234567"/>
              {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
            </label>

            <label className="form-label">
              <span className="label">Password</span>
              <input className={`input ${fieldErrors.password ? "input-error" : ""}`} name="password" type="password" value={form.password} onChange={onChange} required minLength={8} aria-invalid={!!fieldErrors.password}/>
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </label>

            <label className="form-label">
              <span className="label">Confirm password</span>
              <input className={`input ${fieldErrors.confirmPassword ? "input-error" : ""}`} name="confirmPassword" type="password" value={form.confirmPassword} onChange={onChange} required minLength={8} aria-invalid={!!fieldErrors.confirmPassword}/>
              {fieldErrors.confirmPassword && (<span className="field-error">{fieldErrors.confirmPassword}</span>
              )}
            </label>

            <label className="form-label" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" name="agreeTerms" checked={form.agreeTerms} onChange={onChange} aria-invalid={!!fieldErrors.agreeTerms}/>
              <span className="muted-text">
                I agree to the{" "}
                <a href="#" target="_blank" rel="noreferrer">Terms and Conditions</a>
                {" "}and the{" "}
                <a href="#" target="_blank" rel="noreferrer">Privacy Policy</a>.
              </span>
            </label>
            {fieldErrors.agreeTerms && <span className="field-error" style={{color: "red"}}>{fieldErrors.agreeTerms}</span>}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create account"}
              </button>
              <Link className="btn btn-outline" to="/login">Back to login</Link>
            </div>

            {success && <p style={{ color: "green" }}>{success}</p>}

            <p style={{ marginTop: 8, marginBottom:0 }}>Are you an Agent?</p>
            <div>
              <Link className="btn btn-outline" to="/signup/agent">Sign up as Property Agent</Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
