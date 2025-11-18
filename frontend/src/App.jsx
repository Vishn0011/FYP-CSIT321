import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminLogin from "./pages/AdminLogin";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import RequireAgent from "./components/RequireAgent";
import PropertiesPage from "./components/PropertiesPage";
import AddPropertiesPage from "./components/AddProperties";
import ViewIndividualPropertiesPage from "./components/ViewIndividualProperties";
import EditIndividualPropertiesPage from "./components/UpdateProperties";
import AdminUsers from "./pages/AdminUsers";
import "./index.css";
import SignUp from "./pages/SignUp";
import Unauthorized from "./pages/Unauthorized";
import HomePage from "./pages/HomePage"
import Nav from "./components/Nav";
import { AuthProvider } from "./AuthContext";
import AdminDashboard from "./pages/AdminDashboard";
import AllPropertiesPage from "./pages/AllPropertiesPage";
import PublicPropertyPage from "./pages/PublicPropertyPage";
import RequireHomebuyer from "./components/RequireHomebuyer"; // import guard
import HomebuyerSearch from "./pages/HomebuyerSearch";
import AdminListings from "./pages/AdminListings.jsx";
import AdminAnnouncements from "./pages/AdminAnnouncements.jsx";
import AdminAnnouncementNew from "./pages/AdminAnnouncementNew.jsx";
import Subscribe from "./pages/Subscribe";
import ProfilePage from "./pages/ProfilePage";
import UserAnnouncementPopup from "./components/UserAnnouncementPopup";
import WelcomeVideo from "./pages/WelcomeVideo";



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
//function AdminDashboard() {
//    const user = JSON.parse(localStorage.getItem("user") || "{}");
//    return (
//        <main className="p-6">
//            <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
//            <p>Welcome, {user?.name || user?.email} (admin).</p>
//        </main>
//    );
//}


// ==========================
// Main App
// ==========================
export default function App() {
    return (
        <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50 transition-colors">
            <BrowserRouter>
                <AuthProvider>
                    {/* Nav is outside Routes so it always shows */}
                    <Nav />
                    <UserAnnouncementPopup />
                    <Routes>
                        {/* Auth routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/admin/login" element={<AdminLogin />} />
                        <Route path="/properties/all" element={<AllPropertiesPage />} />
                        <Route path="/explore/properties/:id" element={<PublicPropertyPage />} />
                        <Route
                            path="/welcome"
                            element={
                                <RequireAuth>
                                    <WelcomeVideo />
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

                        {/* Protected Homebuyer routes */}
                        <Route
                            path="/homeowner/search"
                            element={
                                <RequireHomebuyer>
                                    <HomebuyerSearch />
                                </RequireHomebuyer>
                            }
                        />

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
                            path="/profile"
                            element={
                                <RequireAuth>
                                    <ProfilePage />
                                </RequireAuth>
                            }
                        />
                        <Route
                            path="/admin/dashboard"
                            element={
                                <RequireAdmin>
                                    <AdminDashboard />
                                </RequireAdmin>
                            }
                        />

                        {/* Admin → Manage Listings */}
                        <Route
                            path="/admin/listings"
                            element={
                                <RequireAdmin>
                                    <AdminListings />
                                </RequireAdmin>
                            }
                        />

                        {/* Admin → Manage Listings */}
                        <Route
                            path="/admin/users"
                            element={
                                <RequireAdmin>
                                    <AdminUsers />
                                </RequireAdmin>
                            }
                        />

                        <Route
                            path="/properties/:id"
                            element={
                                <RequireAuth>
                                    <ViewIndividualPropertiesPage />
                                </RequireAuth>
                            }
                        />

                        <Route
                            path="/admin/announcements"
                            element={
                                <RequireAdmin>
                                    <AdminAnnouncements />
                                </RequireAdmin>}
                        />
                        <Route
                            path="/admin/announcements/new"
                            element={
                                <RequireAdmin>
                                    <AdminAnnouncementNew />
                                </RequireAdmin>
                            } />

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
                        {/*<Route*/}
                        {/*    path="/properties/:id"*/}
                        {/*    element={*/}
                        {/*        <RequireAdmin>*/}
                        {/*            <ViewIndividualPropertiesPage />*/}
                        {/*        </RequireAdmin>*/}
                        {/*    }*/}
                        {/*/>*/}
                        <Route
                            path="/properties/edit/:id"
                            element={
                                <RequireAgent>
                                    <EditIndividualPropertiesPage />
                                </RequireAgent>
                            }
                        />


                        {/* Unauthorized route */}
                        <Route path="/unauthorized" element={<Unauthorized />} />


                        {/*Guest routes */}
                        <Route path="/" element={<LoginPage />} />
                        <Route path="/home" element={<HomePage />} />
                        <Route path="/signup" element={<SignUp />} />
                        <Route path="/subscribe" element={<Subscribe />} />
                        {/* Default fallback */}
                        <Route path="*" element={<LoginPage />} />
                    </Routes>
                </AuthProvider>
            </BrowserRouter>
        </div>
    );
}


