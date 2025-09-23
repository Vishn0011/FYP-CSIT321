import { useEffect, useState } from "react";
import { HOMEBUYER_ID } from "../config";
import { Link } from "react-router-dom";

export default function HomebuyerFavourites() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/homebuyer/favorites?user_id=${HOMEBUYER_ID}`);
      const data = await res.json();
      if (!data.success) setMsg(data.error || "Failed to load favourites");
      else {
        const normalized = (data.items || []).map(row =>
          Array.isArray(row)
            ? { id: row[0], title: row[1], location: row[2], price: row[3], bedrooms: row[4], created_at: row[5] }
            : row
        );
        setItems(normalized);
      }
    } catch {
      setMsg("Network error");
    }
  }

  async function remove(pid) {
    setMsg("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/homebuyer/favorites/${pid}?user_id=${HOMEBUYER_ID}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) setMsg(data.error || "Remove failed");
      else load();
    } catch {
      setMsg("Network error");
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Homebuyer: My Favourites</h2>
      {msg && <p>{msg}</p>}
      {items.length === 0 ? (
        <p>No favourites yet.</p>
      ) : (
        <table border="1" cellPadding="6" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>ID</th><th>Title</th><th>Price</th><th>Bedrooms</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td><Link to={`/homebuyer/property/${p.id}`}>{p.title}</Link></td>
                <td>${p.price}</td>
                <td>{p.bedrooms}</td>
                <td><button onClick={() => remove(p.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
