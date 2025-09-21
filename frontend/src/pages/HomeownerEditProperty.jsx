import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

export default function HomeownerEditProperty() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");

  // Load existing record to prefill
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/homeowner/properties/${id}`);
        const data = await res.json();
        if (!data.success) {
          setError(data.error || "Failed to load property");
        } else {
          const p = data.property;
          setTitle(p.title ?? "");
          setAddress(p.address ?? "");
          setPrice(p.price ?? "");
          setBedrooms(p.bedrooms ?? "");
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Save (PUT) – your backend supports updating price & bedrooms
  async function handleSave(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/homeowner/properties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: Number(price),
          bedrooms: bedrooms === "" ? null : Number(bedrooms),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Update failed");
        return;
      }
      navigate("/my-properties"); // back to list
    } catch {
      setError("Network error");
    }
  }

  if (loading) return <p style={{ padding: "2rem" }}>Loading...</p>;

  return (
    <div style={{ padding: "2rem", maxWidth: 520 }}>
      <h2>Edit Property #{id}</h2>

      <div style={{ marginBottom: 12 }}>
        <Link to="/my-properties">← Back to My Properties</Link>
      </div>

      {error && <p style={{ color: "crimson" }}>❌ {error}</p>}

      <form onSubmit={handleSave}>
        <div style={{ marginBottom: 10 }}>
          <label>Title (read-only): </label>
          <input value={title} readOnly style={{ width: "100%" }} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>Address (read-only): </label>
          <input value={address} readOnly style={{ width: "100%" }} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>Price: </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{ width: "100%" }}
            required
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Bedrooms: </label>
          <input
            type="number"
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <button type="submit">Save</button>
      </form>
    </div>
  );
}
