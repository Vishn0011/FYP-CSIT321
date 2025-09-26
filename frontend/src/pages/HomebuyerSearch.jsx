import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function HomebuyerSearch() {
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function search() {
    setMsg("");
    setLoading(true);
    try {
      const params = {
        ...(q && { q }),
        ...(location && { location }),
        ...(minPrice && { min_price: minPrice }),
        ...(maxPrice && { max_price: maxPrice }),
        ...(bedrooms && { bedrooms }),
      };
      const { data } = await api.get("/api/homebuyer/properties", { params });
      if (data?.success) {
        setItems(data.items || []);
      } else {
        setMsg(data?.error || "Search failed");
      }
    } catch (e) {
      setMsg("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function onSave(propertyId) {
    setMsg("");
    try {
      // token is attached by api.js interceptor
      const { data } = await api.post("/api/homebuyer/favorites", {
        property_id: propertyId,
      });

      if (!data?.success) {
        setMsg(data?.error || "Failed to add to favourites");
        return;
      }

      setMsg("✅ Saved to favourites");
    } catch (e) {
      if (e?.response?.status === 401) {
        setMsg("Please log in to save favourites.");
      } else {
        setMsg("Network error");
      }
    }
  }

  useEffect(() => {
    search(); // initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Homebuyer: Search Properties</h2>

      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          marginBottom: 12,
        }}
      >
        <input
          placeholder="Search (title/location)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          placeholder="Location (exact)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <input
          type="number"
          placeholder="Min price"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <input
          type="number"
          placeholder="Max price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
        <input
          type="number"
          placeholder="Bedrooms"
          value={bedrooms}
          onChange={(e) => setBedrooms(e.target.value)}
        />
      </div>

      <button
        onClick={search}
        disabled={loading}
        style={{
          padding: "8px 12px",
          background: "#00674F",
          color: "white",
          borderRadius: 8,
          fontWeight: 600,
        }}
      >
        {loading ? "Searching..." : "Search"}
      </button>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

      <table border="1" cellPadding="6" style={{ marginTop: 16, width: "100%" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Price</th>
            <th>Bedrooms</th>
            <th>Location</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>
                <Link to={`/homebuyer/property/${p.id}`}>{p.title}</Link>
              </td>
              <td>${p.price}</td>
              <td>{p.bedrooms}</td>
              <td>{p.location}</td>
              <td style={{ display: "flex", gap: 8 }}>
                <Link to={`/homebuyer/property/${p.id}`}>View</Link>
                <button
                  onClick={() => onSave(p.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: "#00674F",
                    color: "white",
                    fontWeight: 600,
                  }}
                >
                  Save ♥
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
