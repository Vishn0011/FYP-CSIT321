import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import RequireAdmin from "./components/RequireAdmin.jsx";
import RequireAgent from "./components/RequireAgent.jsx";
import PropertiesPage from "./components/PropertiesPage.jsx";
import AddPropertiesPage from "./components/AddProperties.jsx";
import ViewIndividualPropertiesPage from "./components/ViewIndividualProperties.jsx";
import EditIndividualPropertiesPage from "./components/UpdateProperties.jsx";
import "./index.css";
import SignUp from "./components/SignUp.jsx";
import Unauthorized from "./pages/Unauthorized.jsx";
import HomePage from "./pages/HomePage.jsx";
import Nav from "./components/Nav.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AllPropertiesPage from "./pages/AllPropertiesPage.jsx";
import PublicPropertyPage from "./pages/PublicPropertyPage.jsx";

// ==========================
// Dashboard (User)
// ==========================
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
            await fetch(
              `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/auth/logout`,
              { method: "POST", headers: { Authorization: `Bearer ${token}` } }
            ).catch(() => {});
          }
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = "/login";
        }}
      >
        Logout
      </button>
    </main>
  );
}

// ==========================
// Main App
// ==========================
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Nav />
        <Routes>
          {/* Auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/properties/all" element={<AllPropertiesPage />} />
          <Route path="/explore/properties/:id" element={<PublicPropertyPage />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminDashboard />
              </RequireAdmin>
            }
          />

          {/* Property routes */}
          <Route
            path="/properties"
            element={
              <RequireAgent>
                <PropertiesPage />
              </RequireAgent>
            }
          />
          <Route
            path="/addproperties"
            element={
              <RequireAgent>
                <AddPropertiesPage />
              </RequireAgent>
            }
          />
          <Route
            path="/properties/:id"
            element={
              <RequireAgent>
                <ViewIndividualPropertiesPage />
              </RequireAgent>
            }
          />
          <Route
            path="/properties/edit/:id"
            element={
              <RequireAgent>
                <EditIndividualPropertiesPage />
              </RequireAgent>
            }
          />

          {/* Unauthorized + Guest */}
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Default fallback */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
