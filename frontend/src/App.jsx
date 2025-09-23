import { Routes, Route, Link, Navigate } from "react-router-dom";

// Import your Homebuyer pages
import HomebuyerSearch from "./pages/HomebuyerSearch.jsx";
import HomebuyerPropertyDetail from "./pages/HomebuyerPropertyDetail.jsx";
import HomebuyerFavourites from "./pages/HomebuyerFavourites.jsx";

function App() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>FYP Frontend</h1>

      <nav style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <Link to="/homebuyer/search">HB: Search</Link>
        <Link to="/homebuyer/favourites">HB: Favourites</Link>
      </nav>

      <Routes>
        {/* Default route */}
        <Route path="/" element={<Navigate to="/homebuyer/search" replace />} />

        {/* Homebuyer routes */}
        <Route path="/homebuyer/search" element={<HomebuyerSearch />} />
        <Route path="/homebuyer/property/:id" element={<HomebuyerPropertyDetail />} />
        <Route path="/homebuyer/favourites" element={<HomebuyerFavourites />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/homebuyer/search" replace />} />
      </Routes>
    </div>
  );
}

export default App;
