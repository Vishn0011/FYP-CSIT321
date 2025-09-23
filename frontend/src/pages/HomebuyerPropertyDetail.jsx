import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function HomebuyerPropertyDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      setMsg("");
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/homebuyer/properties/${id}`);
        const data = await res.json();
        if (!data.success) setMsg(data.error || "Failed to load");
        else setP(data.property);
      } catch {
        setMsg("Network error");
      }
    })();
  }, [id]);

  if (!p) return <div style={{ padding: "2rem" }}>{msg || "Loading..."}</div>;

  return (
    <div style={{ padding: "2rem" }}>
      <Link to="/homebuyer/search">← Back to Search</Link>
      <h2 style={{ marginTop: 8 }}>{p.title}</h2>
      <p><b>Location:</b> {p.location}</p>
      <p><b>Price:</b> ${p.price} &nbsp; <b>Bedrooms:</b> {p.bedrooms} &nbsp; <b>Bathrooms:</b> {p.bathrooms}</p>
      <p><b>Size:</b> {p.size}</p>
      <p><b>Status:</b> {p.status}</p>
      <p><b>Description:</b> {p.description || "-"}</p>
      <p><small>Created: {p.created_at} | Updated: {p.updated_at}</small></p>
    </div>
  );
}
