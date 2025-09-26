import { useEffect, useState } from "react";
import { listProperties } from "../services/properties";

export default function DevPropertyProbe() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let on = true;
    listProperties()
      .then((rows) => on && setData(rows))
      .catch((e) => on && setErr(e.message || "Failed"));
    return () => { on = false; };
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Dev Property Probe</h1>
      <p>Calls <code>GET /api/properties</code> using <code>VITE_API_URL</code>.</p>
      {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
      <pre style={{ background: "#f6f8fa", padding: 12, borderRadius: 8 }}>
        {data ? JSON.stringify(data, null, 2) : "Loading..."}
      </pre>
    </div>
  );
}
