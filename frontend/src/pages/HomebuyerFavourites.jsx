import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function HomebuyerFavourites() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      // Token is attached by api.js interceptor
      const { data } = await api.get("/api/homebuyer/favorites");
      if (!data?.success) {
        setMsg(data?.error || "Failed to load favourites");
      } else {
        setItems(data.items || []);
      }
    } catch (e) {
      if (e?.response?.status === 401) {
        setMsg("Please log in to view favourites.");
      } else {
        setMsg("Network error");
      }
    } finally {
      setLoading(false);
    }
  }

  async function remove(pid) {
    setMsg("");
    try {
      const { data } = await api.delete(`/api/homebuyer/favorites/${pid}`);
      if (!data?.success) {
        setMsg(data?.error || "Remove failed");
      } else {
        // optimistic update
        setItems((prev) => prev.filter((x) => x.id !== pid));
      }
    } catch (e) {
      if (e?.response?.status === 401) {
        setMsg("Please log in to modify favourites.");
      } else {
        setMsg("Network error");
      }
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/homebuyer/search">← Back to Browse</Link>
      </div>

      <h2 style={{ marginBottom: 12 }}>Favourites</h2>

      {msg && (
        <p style={{ color: msg.includes("log in") ? "#b45309" : "#b91c1c" }}>{msg}</p>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No favourites yet.</p>
      ) : (
        <table border="1" cellPadding="8" style={{ width: "100%", background: "white" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Location</th>
              <th>Price</th>
              <th>Bedrooms</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>
                  <Link to={`/homebuyer/property/${p.id}`}>{p.title}</Link>
                </td>
                <td>{p.location}</td>
                <td>${p.price}</td>
                <td>{p.bedrooms}</td>
                <td>
                  <button
                    onClick={() => remove(p.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "#00674F",
                      color: "white",
                      fontWeight: 600,
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
