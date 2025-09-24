import React, { useEffect, useState } from "react";
import "./css/HomePage.css";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export default function HomePage() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/get_featured_properties`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setFeatured)
      .catch((e) => {
        console.error("Failed to load featured properties:", e);
        setFeatured([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatPrice = (n) =>
    Number(n).toLocaleString("en-SG", {
      style: "currency",
      currency: "SGD",
      maximumFractionDigits: 0,
    });

  return (
    <div className="home-page">
      {/* Top navigation */}
      <header className="site-header card">
        <div className="brand">
          <Link to="/" aria-label="Home" className="brand-link">
            <span className="brand-dot" /> SGProp
          </Link>
        </div>

        <nav className="main-nav" aria-label="Primary">
          <Link className="nav-link" to="/home">Home</Link>
          <Link className="nav-link" to="/properties">Property Listing</Link>
          <Link className="nav-link" to="/analytics">Analytics</Link>
          <Link className="nav-link" to="/announcement">Announcement</Link>
        </nav>

        <div className="auth-actions">
          <Link className="btn btn-outline" to="/login">Login</Link>
          <Link className="btn btn-primary" to="/signup">Sign up</Link>
        </div>
      </header>

      {/* Hero / CTA */}
      <div className="container">
        <main>
          <section className="hero card">
            <div className="hero-content">
              <h1 className="hero-title">Find your next home with confidence.</h1>
              <p className="hero-subtitle">
                Join SGProp to explore listings, track market trends, and receive
                smart insights tailored to Singapore’s property market.
              </p>

              <div className="hero-cta">
                <Link className="btn btn-primary" to="/signup">Sign up</Link>
                <Link className="btn btn-outline" to="/login">Login</Link>
              </div>

              <ul className="hero-bullets">
                <li>Personalised alerts &amp; saved searches</li>
                <li>Market analytics &amp; trends</li>
                <li>Fast, clean browsing experience</li>
              </ul>
            </div>
          </section>

          {/* Featured listings */}
          <section className="featured">
            <div className="section-header">
              <h2 className="section-title">Featured Properties</h2>
              <p className="muted-text">Handpicked listings to get you started</p>
            </div>

            {loading ? (
              <div className="featured-grid">
                {[0, 1, 2].map((i) => (
                  <article key={i} className="property-card card">
                    <div className="property-media"><div className="img-skeleton" /></div>
                    <div className="card-body">
                      <h3 className="property-location">Loading…</h3>
                      <div className="property-tags">
                        <span className="badge">—</span>
                        <span className="badge badge-muted">— BR</span>
                        <span className="badge badge-muted">— BA</span>
                        <span className="badge badge-success">— sqft</span>
                      </div>
                      <div className="property-cta">
                        <a className="btn btn-outline" href="#">View details</a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="featured-grid">
                {featured.map((p) => (
                  <article key={p.id} className="property-card card" aria-label={`Property in ${p.location}`}>
                    <div className="property-media" aria-hidden="true">
                      <div className="img-skeleton" />
                    </div>
                    <div className="card-body">
                      <h3 className="property-location">{p.location}</h3>
                      <div className="property-tags">
                        <span className="badge">{formatPrice(p.price)}</span>
                        <span className="badge badge-muted">{p.bedrooms} BR</span>
                        <span className="badge badge-muted">{p.bathrooms} BA</span>
                        <span className="badge badge-success">{p.size} sqft</span>
                      </div>
                      <div className="property-cta">
                        <a className="btn btn-outline" href="#">View details</a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
      <footer className="site-footer">
        <p className="muted-text">© {new Date().getFullYear()} SGProp. All rights reserved.</p>
      </footer>
    </div>
  );
}