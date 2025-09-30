import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import ManageFeatures from "./ManageFeatures";
import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
});
export default function AdminDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ total: 0, recent: [] });
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [listings, setListings] = useState([]);
    const [selected, setSelected] = useState(null);

    async function approveProperty(id) {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/properties/${id}/approve`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to approve");
            alert("Property approved!");
            setSelected(null);
            // Optionally reload listings
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("Approval failed");
        }
    }

    // fetch pending listings
    useEffect(() => {
        async function fetchListings() {
            try {
                const res = await api.get("/api/properties/recent");
                setListings(res.data);
            } catch (err) {
                console.error("Failed to fetch listings:", err);
            }
        }
        fetchListings();
    }, []);

    async function fetchPropertyDetails(id) {
        try {
            const res = await api.get(`/api/properties/${id}`);
            console.log("Property details response:", res.data);
            setSelected(res.data);
        } catch (err) {
            console.error("Failed to fetch property details:", err);
        }
    }




    useEffect(() => {
        async function fetchStats() {
            try {
                setErr("");
                const res = await api.get("/api/users/stats"); // using api.js
                setStats({
                    total: Number(res.data?.total || 0),
                    recent: Array.isArray(res.data?.recent) ? res.data.recent : [],
                });
            } catch (e) {
                console.error("Failed to fetch stats:", e);
                setErr("Failed to load stats");
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);



    return (
        <div className="min-h-screen bg-gray-50">
            <main className="flex-1">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
                        <p className="text-gray-500 mt-1">
                            An overview of the key activities and metrics on AgentPro.
                        </p>
                    </div>

                    {/* Stats cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <StatCard
                            icon="group"
                            value={loading ? "…" : stats.total}
                            label="Total Users"
                        />
                        <StatCard icon="apartment" value="421" label="Active Listings" />
                        <StatCard icon="pending_actions" value="23" label="Pending Listings" />
                        <StatCard icon="campaign" value="8" label="Announcements" />
                    </div>

                    {/* Sections */}
                    <div className="space-y-8">
                        {/* Recent Users (real data) */}
                        <Section
                            title="Recent Users"
                            onViewAll={() => navigate("/admin/users")}
                        >
                            {loading ? (
                                <div className="text-sm text-gray-500">Loading…</div>
                            ) : err ? (
                                <div className="text-sm text-red-600">{err}</div>
                            ) : stats.recent.length === 0 ? (
                                <div className="text-sm text-gray-500">No users yet.</div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 font-semibold text-gray-500">Name</th>
                                            <th className="p-3 font-semibold text-gray-500">Email</th>
                                            <th className="p-3 font-semibold text-gray-500">Role</th>
                                            <th className="p-3 font-semibold text-gray-500">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.recent.map((u) => (
                                            <tr key={u.id} className="border-b hover:bg-gray-50">
                                                <td className="p-3">{u.name || "—"}</td>
                                                <td className="p-3 text-gray-500">{u.email}</td>
                                                <td className="p-3 capitalize">{u.role || "user"}</td>
                                                <td className="p-3">
                                                    <span
                                                        className={`px-2 py-1 text-xs font-semibold rounded-full ${u.is_active
                                                                ? "text-green-800 bg-green-100"
                                                                : "text-red-800 bg-red-100"
                                                            }`}
                                                    >
                                                        {u.is_active ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </Section>

                        {/* Recent Listings */}
                        <Section title="Recent Listings">
                            {loading ? (
                                <p className="p-3 text-gray-500">Loading...</p>
                            ) : listings.length === 0 ? (
                                <p className="p-3 text-gray-500">No pending properties.</p>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 font-semibold text-gray-500">Property Title</th>
                                            <th className="p-3 font-semibold text-gray-500">Agent</th>
                                            <th className="p-3 font-semibold text-gray-500">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {listings.map((p) => (
                                            <tr
                                                key={p.id}
                                                className="border-b hover:bg-gray-50 cursor-pointer"
                                                onClick={() => fetchPropertyDetails(p.id)}
                                            >
                                                <td className="p-3">{p.title}</td>
                                                <td className="p-3 text-gray-500">{p.agent}</td>
                                                <td className="p-3">
                                                    <span
                                                        className={`px-2 py-1 text-xs font-semibold rounded-full ${p.status === "Active"
                                                                ? "text-green-800 bg-green-100"
                                                                : p.status === "Pending"
                                                                    ? "text-yellow-800 bg-yellow-100"
                                                                    : "text-gray-800 bg-gray-100"
                                                            }`}
                                                    >
                                                        {p.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* Modal */}
                            {selected && (
                                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                                    <div className="bg-white rounded-lg shadow-lg p-6 w-[600px] max-h-[90vh] overflow-y-auto">
                                        {/* Title */}
                                        <h2 className="text-xl font-bold mb-4">{selected.title}</h2>

                                        {/* Agent */}
                                        <p className="mb-2 text-gray-600">
                                            <strong>Agent:</strong> {selected.agent?.name || "N/A"}
                                        </p>

                                        {/* Status */}
                                        <p className="mb-2 text-gray-600">
                                            <strong>Status:</strong> {selected.status}
                                        </p>

                                        {/* Price */}
                                        <p className="mb-2 text-gray-600">
                                            <strong>Price:</strong> ${selected.price}
                                        </p>

                                        {/* Location */}
                                        <p className="mb-2 text-gray-600">
                                            <strong>Location:</strong> {selected.location}
                                        </p>

                                        {/* Description */}
                                        <p className="mb-4 text-gray-700">{selected.description}</p>

                                        {/* Photos (if any) */}
                                        {selected.photos && (
                                            <div className="grid grid-cols-2 gap-2 mt-4">
                                                {JSON.parse(selected.photos).map((url, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={url}
                                                        alt="property"
                                                        className="w-full h-32 object-cover rounded"
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {/* Buttons */}
                                        <div className="flex gap-4 justify-end mt-6">
                                            <button
                                                onClick={() => approveProperty(selected.id)}
                                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => setSelected(null)}
                                                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Section>


                        {/* Announcements (hard-coded) */}
                        <Section
                            title="Announcements"
                            onViewAll={() => navigate("/admin/announcements")}
                        >
                            <table className="w-full text-left">
                                <thead className="border-b border-gray-200">
                                    <tr>
                                        <th className="p-3 font-semibold text-gray-500">Title</th>
                                        <th className="p-3 font-semibold text-gray-500">Visibility</th>
                                        <th className="p-3 font-semibold text-gray-500">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b hover:bg-gray-50">
                                        <td className="p-3">Welcome to the New AgentPro!</td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full">
                                                Public
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-500">Jul 15, 2025</td>
                                    </tr>
                                    <tr className="border-b hover:bg-gray-50">
                                        <td className="p-3">Scheduled Maintenance on Friday</td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 text-xs font-semibold text-purple-800 bg-purple-100 rounded-full">
                                                Agents Only
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-500">Jul 18, 2025</td>
                                    </tr>
                                </tbody>
                            </table>
                        </Section>

                        {/* Manage Features (CRUD for AI + Traditional homepage features) */}
                        <Section
                            title="Manage Homepage Features"
                            onViewAll={() => navigate("/admin/features")}
                        >
                            <ManageFeatures />
                        </Section>
                    </div>
                </div>
            </main>
        </div>
    );
}

/* --- Small components --- */
function StatCard({ icon, value, label }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-lg">
                <span className="material-symbols-outlined text-emerald-700">
                    {icon}
                </span>
            </div>
            <div>
                <p className="text-3xl font-bold text-gray-800">{value}</p>
                <h2 className="text-sm font-medium text-gray-500">{label}</h2>
            </div>
        </div>
    );
}

function Section({ title, onViewAll, children }) {
    return (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
                <button
                    onClick={onViewAll}
                    className="text-sm font-medium text-emerald-700 hover:underline"
                >
                    View all
                </button>
            </div>
            <div className="px-6 pb-6">{children}</div>
        </div>
    );
}

/* Announcements widget (optional standalone card) */
function AnnouncementsWidget() {
    return (
        <section className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Announcements</h2>
                <div className="flex items-center gap-3">
                    <Link
                        to="/admin/announcements/new"
                        className="text-sm font-medium text-emerald-600 hover:underline"
                    >
                        Create
                    </Link>
                    <Link
                        to="/admin/announcements"
                        className="text-sm font-medium text-emerald-600 hover:underline"
                    >
                        View all
                    </Link>
                </div>
            </div>

            <table className="w-full text-left text-sm">
                <thead className="text-gray-500">
                    <tr>
                        <th className="py-2">Title</th>
                        <th className="py-2">Visibility</th>
                        <th className="py-2">Date</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    <tr>
                        <td className="py-3 font-medium text-gray-900">
                            Scheduled Maintenance – RDS (11pm–1am)
                        </td>
                        <td className="py-3">
                            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                                Agents Only
                            </span>
                        </td>
                        <td className="py-3">Sep 28, 2025</td>
                    </tr>
                    <tr>
                        <td className="py-3 font-medium text-gray-900">
                            New Feature: Manage Listings (Beta)
                        </td>
                        <td className="py-3">
                            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                                Public
                            </span>
                        </td>
                        <td className="py-3">Sep 18, 2025</td>
                    </tr>
                </tbody>
            </table>
        </section>
    );
}
