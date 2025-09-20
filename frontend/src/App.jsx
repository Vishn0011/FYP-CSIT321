import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminLogin from "./pages/AdminLogin";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p>Welcome, {user?.name || user?.email} ({user?.role}).</p>
      <button
        className="mt-4 px-4 py-2 rounded bg-gray-900 text-white"
        onClick={async () => {
          const token = localStorage.getItem("token");
          if (token) {
            await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/auth/logout`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            }).catch(()=>{});
          }
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = "/login";
        }}
      >Logout</button>
    </main>
  );
}

function AdminDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
      <p>Welcome, {user?.name || user?.email} (admin).</p>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />

        <Route path="*" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import "./index.css";
import PropertiesPage from "./components/PropertiesPage";
import AddPropertiesPage from "./components/AddProperties";
import ViewIndividualPropertiesPage from "./components/ViewIndividualProperties";
import EditIndividualPropertiesPage from "./components/UpdateProperties";

function Nav() {
    return (
        <nav className="nav">
            <div className="nav-brand">Aspect Real Estate</div>
            <div className="nav-links">
                <Link to="/agents">Agents</Link>
                <Link to="/predict">Predict</Link>
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/compare">Compare</Link>
                <Link to="/reports">Reports</Link>
                <Link to ="/properties">Properties</Link>
            </div>
        </nav>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <Nav />
            <Routes>
                <Route path="/" element={<Navigate to="/properties" replace />} />
                <Route path="/properties" element={<PropertiesPage />} />
                <Route path="/addproperties" element={<AddPropertiesPage />} />
                <Route path="/properties/:id" element={<ViewIndividualPropertiesPage />} />
                <Route path="/properties/edit/:id" element={<EditIndividualPropertiesPage />} />
                <Route path="/predict" element={<div className="page">Prediction form (AI)</div>} />
                <Route path="/dashboard" element={<div className="page">Dashboard (trends, yields, heatmaps)</div>} />
                <Route path="/compare" element={<div className="page">Compare saved predictions</div>} />
                <Route path="/reports" element={<div className="page">Reports / PDF generator</div>} />
                {/* 404 */}
                <Route path="*" element={<div className="page">Not found</div>} />
            </Routes>
        </BrowserRouter>
    );
}
