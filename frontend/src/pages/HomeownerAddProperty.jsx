import { useState } from "react";
import { OWNER_ID } from "../config";

export default function HomeownerAddProperty() {
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/homeowner/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: OWNER_ID,
          title,
          address,
          price: Number(price),
          bedrooms: Number(bedrooms),
        }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage("✅ Property added!");
        setTitle("");
        setAddress("");
        setPrice("");
        setBedrooms("");
      } else {
        setMessage("❌ " + (data.error || "Failed to add property"));
      }
    } catch {
      setMessage("❌ Network error");
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 480 }}>
      <h2>Add Property</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label>Title: </label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Address: </label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Price: </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Bedrooms: </label>
          <input
            type="number"
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
          />
        </div>
        <button type="submit">Add Property</button>
      </form>
      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
}
