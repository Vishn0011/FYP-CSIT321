import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HOMEBUYER_ID } from "../config";

export default function HomebuyerSearch() {
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");

  async function search() {
    setMsg("");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (location) params.set("location", location);
    if (minPrice) params.set("min_price", minPrice);
    if (maxPrice) params.set("max_price", maxPrice);
    if (bedrooms) params.set("bedrooms", bedrooms);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/homebuyer/properties?` + params.toString());
      const data = await res.json();
      if (data.success) {
        const normalized = (data.items || []).map(row =>
          Array.isArray(row)
            ? { id: row[0], title: row[1], location: row[2], price: row[3], bedrooms: row[4], created_at: row[5] }
            : row
        );
        setItems(normalized);
      } else {
        setMsg(data.error || "Search failed");
      }
    } catch {
      setMsg("Network error");
    }
  }

  async function addFav(propertyId) {
    setMsg("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/homebuyer/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: HOMEBUYER_ID, property_id: propertyId }),
      });
      const data = await res.json();
      if (!data.success) setMsg(data.error || "Failed to save favourite");
      else setMsg("✅ Saved to favourites");
    } catch {
      setMsg("Network error");
    }
  }

  useEffect(() => { search(); }, []); // initial load

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Homebuyer: Search Properties</h2>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 12 }}>
        <input placeholder="Search (title/location)" value={q} onChange={e => setQ(e.target.value)} />
        <input placeholder="Location (exact)" value={location} onChange={e => setLocation(e.target.value)} />
        <input type="number" placeholder="Min price" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
        <input type="number" placeholder="Max price" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
        <input type="number" placeholder="Bedrooms" value={bedrooms} onChange={e => setBedrooms(e.target.value)} />
      </div>

      <button onClick={search}>Search</button>
      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

      <table border="1" cellPadding="6" style={{ marginTop: 16, width: "100%" }}>
        <thead>
          <tr>
            <th>ID</th><th>Title</th><th>Price</th><th>Bedrooms</th><th>Location</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td><Link to={`/homebuyer/property/${p.id}`}>{p.title}</Link></td>
              <td>${p.price}</td>
              <td>{p.bedrooms}</td>
              <td>{p.location}</td>
              <td style={{ display: "flex", gap: 8 }}>
                <Link to={`/homebuyer/property/${p.id}`}>View</Link>
                <button onClick={() => addFav(p.id)}>Save ♥</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}
