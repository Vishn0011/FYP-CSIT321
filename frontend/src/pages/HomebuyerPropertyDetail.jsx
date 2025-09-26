import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";

export default function HomebuyerPropertyDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Load this property's details
  useEffect(() => {
    let alive = true;

    async function load() {
      setMsg("");
      try {
        const { data } = await api.get(`/api/homebuyer/properties/${id}`);
        if (!data?.success) setMsg(data?.error || "Failed to load");
        else if (alive) setP(data.property);
      } catch {
        setMsg("Network error");
      }
    }

    load();
    return () => { alive = false; };
  }, [id]);

  // <<< Add your async function HERE (inside the component) >>>
  async function handleAddFavourite() {
    setSaving(true);
    setMsg("");
    try {
      const { data } = await api.post("/api/homebuyer/favorites", {
        property_id: Number(id),
      });
      if (!data?.success) setMsg(data?.error || "Failed to add to favourites");
      else setMsg("Added to favourites ✓");
    } catch (e) {
      if (e?.response?.status === 401) {
        setMsg("Please log in again to save favourites.");
      } else {
        setMsg("Failed to add to favourites");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!p) return <div style={{ padding: "2rem" }}>{msg || "Loading..."}</div>;

  return (
    <div style={{ padding: "2rem" }}>
      <Link to="/homebuyer/search">← Back to Search</Link>

      <h2 style={{ marginTop: 8 }}>{p.title}</h2>
      <p><b>Location:</b> {p.location}</p>
      <p>
        <b>Price:</b> ${p.price} &nbsp; <b>Bedrooms:</b> {p.bedrooms} &nbsp;{" "}
        <b>Bathrooms:</b> {p.bathrooms}
      </p>
      <p><b>Size:</b> {p.size}</p>
      <p><b>Status:</b> {p.status}</p>
      <p><b>Description:</b> {p.description || "-"}</p>
      <p><small>Created: {p.created_at} | Updated: {p.updated_at}</small></p>

      {msg && (
        <p style={{ marginTop: 12, color: msg.includes("✓") ? "#00674F" : "#b91c1c" }}>
          {msg}
        </p>
      )}

      <button
        onClick={handleAddFavourite}
        disabled={saving}
        style={{
          marginTop: 16,
          padding: "0.8rem 1.2rem",
          borderRadius: 10,
          background: "#00674F",
          color: "white",
          fontWeight: 600,
        }}
      >
        {saving ? "Saving…" : "+ Add to favourites"}
      </button>
    </div>
  );
}
