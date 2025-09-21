import { Routes, Route, Link, Navigate } from "react-router-dom";
import HomeownerAddProperty from "./pages/HomeownerAddProperty.jsx";
import HomeownerMyProperties from "./pages/HomeownerMyProperties.jsx";
import HomeownerEditProperty from "./pages/HomeownerEditProperty.jsx";

export default function App() {
  return (
    <div style={{ padding: "1rem" }}>
      <h1>Homeowner</h1>

      {/* Simple nav */}
      <nav style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <Link to="/add-property">Add Property</Link>
        <Link to="/my-properties">My Properties</Link>
        {/* Edit links are shown per-row on My Properties, not here */}
      </nav>

      <Routes>
        {/* redirect "/" to Add Property so root isn’t blank */}
        <Route path="/" element={<Navigate to="/add-property" replace />} />

        <Route path="/add-property" element={<HomeownerAddProperty />} />
        <Route path="/my-properties" element={<HomeownerMyProperties />} />
        <Route path="/edit-property/:id" element={<HomeownerEditProperty />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/add-property" replace />} />
      </Routes>
    </div>
  );
}
