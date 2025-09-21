import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { OWNER_ID } from "../config";

export default function HomeownerMyProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/homeowner/properties?owner_id=${OWNER_ID}`
      );
      const data = await res.json();

      if (data.success) {
        const normalized = (data.items || []).map((row) =>
          Array.isArray(row)
            ? { id: row[0], title: row[1], price: row[2], created_at: row[3] }
            : row
        );
        setProperties(normalized);
      } else {
        setError(data.error || "Failed to fetch properties");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id) {
    const ok = confirm(`Delete property #${id}?`);
    if (!ok) return;

    setBusyId(id);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/homeowner/properties/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Delete failed");
      } else {
        await load();
      }
    } catch {
      alert("Network error");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p>❌ {error}</p>;

  return (
    <div style={{ padding: "2rem" }}>
      <h2>My Properties</h2>
      {properties.length === 0 ? (
        <p>No properties found.</p>
      ) : (
        <table border="1" cellPadding="6">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Price</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.title}</td>
                <td>${p.price}</td>
                <td>{p.created_at}</td>
                <td style={{ display: "flex", gap: "8px" }}>
                  <Link to={`/edit-property/${p.id}`}>Edit</Link>
                  <button onClick={() => handleDelete(p.id)} disabled={busyId === p.id}>
                    {busyId === p.id ? "Deleting..." : "Delete"}
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
