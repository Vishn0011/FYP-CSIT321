import { Routes, Route, Link, Navigate } from "react-router-dom";

// Pages
import HomebuyerSearch from "./pages/HomebuyerSearch.jsx";
import HomebuyerPropertyDetail from "./pages/HomebuyerPropertyDetail.jsx";
import HomebuyerFavourites from "./pages/HomebuyerFavourites.jsx";
import DevPropertyProbe from "./pages/DevPropertyProbe.jsx";
import Login from "./pages/Login.jsx";

// Auth
import RequireAuth from "./components/RequireAuth.jsx";
import useAuth from "./hooks/useAuth.js";
import { logout } from "./services/auth";

function App() {
  const { user } = useAuth();

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>FYP Frontend</h1>

      <nav
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        {/* Links only after login */}
        {user && <Link to="/homebuyer/search">HB: Search</Link>}
        {user && <Link to="/homebuyer/favourites">HB: Favourites</Link>}

        {!user ? (
          <Link to="/login">Login</Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              logout();              // clears token + notifies app
              window.location.href = "/login";
            }}
            style={{
              border: "1px solid #ccccccff",
              borderRadius: 6,
              padding: "2px 8px",
            }}
          >
            Logout {user?.email ? `(${user.email})` : ""}
          </button>
        )}
      </nav>

      <Routes>
        {/* Default route → if logged in go to Search, else Login */}
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/homebuyer/search" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Protected routes */}
        <Route
          path="/homebuyer/search"
          element={
            <RequireAuth>
              <HomebuyerSearch />
            </RequireAuth>
          }
        />
        <Route
          path="/homebuyer/favourites"
          element={
            <RequireAuth>
              <HomebuyerFavourites />
            </RequireAuth>
          }
        />
        <Route
          path="/homebuyer/property/:id"
          element={
            <RequireAuth>
              <HomebuyerPropertyDetail />
            </RequireAuth>
          }
        />

        {/* Dev + Auth */}
        <Route path="/dev/probe" element={<DevPropertyProbe />} />
        <Route path="/login" element={<Login />} />

        {/* Fallback */}
        <Route
          path="*"
          element={
            user ? (
              <Navigate to="/homebuyer/search" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </div>
  );
}

export default App;
