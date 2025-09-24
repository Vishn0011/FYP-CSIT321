import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminLogin from "./pages/AdminLogin";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import PropertiesPage from "./components/PropertiesPage";
import AddPropertiesPage from "./components/AddProperties";
import ViewIndividualPropertiesPage from "./components/ViewIndividualProperties";
import EditIndividualPropertiesPage from "./components/UpdateProperties";
import "./index.css";
import HomePage from "./components/HomePage";
import SignUp from "./components/SignUp";

// ==========================
// Dashboard (User)
// ==========================
function Dashboard() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    return (
        <main className="p-6">
            <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
            <p>
                Welcome, {user?.name || user?.email} ({user?.role}).
            </p>
            <button
                className="mt-4 px-4 py-2 rounded bg-gray-900 text-white"
                onClick={async () => {
                    const token = localStorage.getItem("token");
                    if (token) {
                        await fetch(
                            `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
                            }/auth/logout`,
                            {
                                method: "POST",
                                headers: { Authorization: `Bearer ${token}` },
                            }
                        ).catch(() => { });
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
// Dashboard (Admin)
// ==========================
function AdminDashboard() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    return (
        <main className="p-6">
            <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
            <p>Welcome, {user?.name || user?.email} (admin).</p>
        </main>
    );
}

// ==========================
// Navigation Bar
// ==========================
function Nav() {
    return (
        <nav className="flex justify-between items-center px-6 py-3 bg-gray-800 text-white">
            <div className="font-bold text-lg">Aspect Real Estate</div>
            <div className="flex gap-4">
                <Link to="/agents">Agents</Link>
                <Link to="/predict">Predict</Link>
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/compare">Compare</Link>
                <Link to="/reports">Reports</Link>
                <Link to="/properties">Properties</Link>
            </div>
        </nav>
    );
}

// ==========================
// Main App
// ==========================
export default function App() {
    return (
        <BrowserRouter>
            <Nav />
            <Routes>
                {/* Auth routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/admin/login" element={<AdminLogin />} />

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
                <Route path="/properties" element={<PropertiesPage />} />
                <Route path="/addproperties" element={<AddPropertiesPage />} />
                <Route path="/properties/:id" element={<ViewIndividualPropertiesPage />} />
                <Route path="/properties/edit/:id" element={<EditIndividualPropertiesPage />} />

                {/*Guest routes */}
                <Route path="/home" element={<HomePage />} />
                <Route path="/signup" element={<SignUp />} />

                {/* Default fallback */}
                <Route path="*" element={<HomePage />} />
            </Routes>
        </BrowserRouter>
    );
}
