import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import ManageFeatures from "./ManageFeatures";
import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token"); // or wherever you store it
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ total: 0, recent: [] });
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [listings, setListings] = useState([]);
    const [selected, setSelected] = useState(null);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [loadingPred, setLoadingPred] = useState(false);
    const [announcements, setAnnouncements] = useState([]);
    const [annLoading, setAnnLoading] = useState(true);
    const [annErr, setAnnErr] = useState("");






    useEffect(() => {
        async function fetchAnnouncements() {
            try {
                setAnnErr("");
                const res = await api.get("/api/admin/announcements");
                const list = Array.isArray(res.data) ? res.data : [];
                // only keep first 10
                setAnnouncements(list.slice(0, 10));
            } catch (e) {
                console.error("Failed to fetch announcements:", e);
                setAnnErr("Failed to load announcements.");
            } finally {
                setAnnLoading(false);
            }
        }
        fetchAnnouncements();
    }, []);



    async function approveProperty(id) {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/properties/${id}/approve`,
                {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            if (!res.ok) throw new Error("Failed to approve");
            alert("Property approved!");
            setSelected(null);
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
        if (!selected?.id) return; // only run when we have a property
        setLoadingPred(true);

        const fetchPrediction = async () => {
            try {
                // ⚠️ adjust path if your baseURL already has /api
                const res = await api.get(`/api/predict/${selected.id}`);
                if (res.data.success) {
                    setSelected(prev => ({ ...prev, ...res.data }));
                }
            } catch (err) {
                console.error("❌ Failed to fetch prediction:", err);
            } finally {
                setLoadingPred(false);
            }
        };

        fetchPrediction();
    }, [selected?.id]);

    useEffect(() => {
        async function fetchStats() {
            try {
                setErr("");
                const res = await api.get("/api/users/stats"); // using api.js
                setStats({
                    total: Number(res.data?.total || 0),
                    recent: Array.isArray(res.data?.recent)
                        ? res.data.recent
                        : [],
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

    useEffect(() => {
        async function fetchPending() {
            try {
                const res = await api.get("/api/users/pending");
                setPendingUsers(res.data);
            } catch (err) {
                console.error("Failed to fetch pending users:", err);
            }
        }
        fetchPending();
    }, []);

    async function approveUser(id) {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/users/${id}/approve`,
                {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            if (!res.ok) throw new Error("Failed to approve user");
            alert("Agent approved!");
            setPendingUsers((prev) => prev.filter((u) => u.id !== id));
        } catch (err) {
            console.error(err);
            alert("Approval failed");
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="flex-1">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-800">
                            Admin Dashboard
                        </h1>
                        <p className="text-gray-500 mt-1">
                            An overview of the key activities and metrics on
                            AgentPro.
                        </p>
                    </div>

                    {/* Stats cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <StatCard
                            icon="group"
                            value={loading ? "…" : stats.total}
                            label="Total Users"
                        />
                        <StatCard
                            icon="apartment"
                            value="421"
                            label="Active Listings"
                        />
                        <StatCard
                            icon="pending_actions"
                            value="23"
                            label="Pending Listings"
                        />
                        <StatCard
                            icon="campaign"
                            value={annLoading ? "…" : announcements.length}
                            label="Announcements"
                        /> <StatCard
                            icon="campaign"
                            value="8"
                            label="Announcements"
                        />
                    </div>

                    {/* Sections */}
                    <div className="space-y-8">
                        {/* Recent Users */}
                        <Section
                            title="Recent Users"
                            onViewAll={() => navigate("/admin/users")}
                        >
                            {loading ? (
                                <div className="text-sm text-gray-500">
                                    Loading…
                                </div>
                            ) : err ? (
                                <div className="text-sm text-red-600">
                                    {err}
                                </div>
                            ) : stats.recent.length === 0 ? (
                                <div className="text-sm text-gray-500">
                                    No users yet.
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 font-semibold text-gray-500">
                                                Name
                                            </th>
                                            <th className="p-3 font-semibold text-gray-500">
                                                Email
                                            </th>
                                            <th className="p-3 font-semibold text-gray-500">
                                                Role
                                            </th>
                                            <th className="p-3 font-semibold text-gray-500">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.recent.map((u) => (
                                            <tr
                                                key={u.id}
                                                className="border-b hover:bg-gray-50"
                                            >
                                                <td className="p-3">
                                                    {u.name || "—"}
                                                </td>
                                                <td className="p-3 text-gray-500">
                                                    {u.email}
                                                </td>
                                                <td className="p-3 capitalize">
                                                    {u.role || "user"}
                                                </td>
                                                <td className="p-3">
                                                    <span
                                                        className={`px-2 py-1 text-xs font-semibold rounded-full ${u.is_active
                                                            ? "text-green-800 bg-green-100"
                                                            : "text-red-800 bg-red-100"
                                                            }`}
                                                    >
                                                        {u.is_active
                                                            ? "Active"
                                                            : "Inactive"}
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
                                <p className="p-3 text-gray-500">
                                    No pending properties.
                                </p>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 font-semibold text-gray-500">
                                                Property Title
                                            </th>
                                            <th className="p-3 font-semibold text-gray-500">
                                                Agent
                                            </th>
                                            <th className="p-3 font-semibold text-gray-500">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {listings.map((p) => (
                                            <tr
                                                key={p.id}
                                                className="border-b hover:bg-gray-50 cursor-pointer"
                                                onClick={() =>
                                                    fetchPropertyDetails(p.id)
                                                }
                                            >
                                                <td className="p-3">
                                                    {p.title}
                                                </td>
                                                <td className="p-3 text-gray-500">
                                                    {p.agent}
                                                </td>
                                                <td className="p-3">
                                                    <span
                                                        className={`px-2 py-1 text-xs font-semibold rounded-full ${p.status === "Active"
                                                            ? "text-green-800 bg-green-100"
                                                            : p.status ===
                                                                "Pending"
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
                                        <h2 className="text-xl font-bold mb-4">
                                            {selected.title}
                                        </h2>
                                        <p className="mb-2 text-gray-600">
                                            <strong>Agent:</strong>{" "}
                                            {selected.agent?.name || "N/A"}
                                        </p>
                                        <p className="mb-2 text-gray-600">
                                            <strong>Status:</strong>{" "}
                                            {selected.status}
                                        </p>
                                        <p className="mb-2 text-gray-600">
                                            <strong>Price:</strong> $
                                            {selected.price}
                                        </p>
                                        <p className="mb-2 text-gray-600">
                                            <strong>Location:</strong>{" "}
                                            {selected.location}
                                        </p>
                                        <p className="mb-4 text-gray-700">
                                            {selected.description}
                                        </p>
                                        {selected.photos && (
                                            <div className="grid grid-cols-2 gap-2 mt-4">
                                                {(Array.isArray(selected.photos)
                                                    ? selected.photos
                                                    : JSON.parse(selected.photos || "[]")
                                                ).map((url, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={url}
                                                        alt="property"
                                                        className="w-full h-32 object-cover rounded"
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = "/placeholder.jpg";
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        {selected.predicted_total_price && (
                                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 mt-5 shadow-sm">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-emerald-600 text-xl">🤖</span>
                                                    <h4 className="font-semibold text-emerald-900 text-lg tracking-tight">
                                                        AI Market Prediction
                                                    </h4>
                                                </div>

                                                <ul className="text-sm text-gray-800 space-y-2">
                                                    <li className="flex justify-between border-b border-gray-100 pb-1">
                                                        <span className="font-medium text-gray-600">Predicted Future Price:</span>
                                                        <span className="font-semibold text-emerald-800">
                                                            ${Number(selected.predicted_total_price).toLocaleString()}
                                                        </span>
                                                    </li>

                                                    <li className="flex justify-between border-b border-gray-100 pb-1">
                                                        <span className="font-medium text-gray-600">Price per sqm:</span>
                                                        <span className="font-semibold">
                                                            ${Number(selected.predicted_price_per_sqm).toLocaleString()}
                                                        </span>
                                                    </li>

                                                    <li className="flex justify-between border-b border-gray-100 pb-1">
                                                        <span className="font-medium text-gray-600">Confidence Range:</span>
                                                        <span>
                                                            ${Number(selected.confidence_low).toLocaleString()} – $
                                                            {Number(selected.confidence_high).toLocaleString()}
                                                        </span>
                                                    </li>

                                                    <li className="flex justify-between border-b border-gray-100 pb-1">
                                                        <span className="font-medium text-gray-600">AI Confidence Level:</span>
                                                        <span className="font-semibold text-indigo-700">
                                                            {(Number(selected.confidence_score) * 100).toFixed(0)}%
                                                        </span>
                                                    </li>
                                                </ul>
                                            </div>
                                        )}


                                        <div className="flex gap-4 justify-end mt-6">
                                            <button
                                                onClick={() =>
                                                    approveProperty(selected.id)
                                                }
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

                        {/* Manage Dropdowns */}
                        <Section
                            title="Manage Dropdowns"
                            onViewAll={() => navigate("/admin/dropdowns")}
                        >
                            <ManageDropdowns />
                        </Section>

                        {/* Announcements */}
                        <Section
                            title="Announcements"
                            onViewAll={() => navigate("/admin/announcements")}
                        >
                            {annLoading ? (
                                <p className="text-sm text-gray-500">Loading…</p>
                            ) : annErr ? (
                                <p className="text-sm text-red-600">{annErr}</p>
                            ) : announcements.length === 0 ? (
                                <p className="text-sm text-gray-500">No announcements yet.</p>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 font-semibold text-gray-500">
                                                Title
                                            </th>
                                            <th className="p-3 font-semibold text-gray-500">
                                                Visibility
                                            </th>
                                            <th className="p-3 font-semibold text-gray-500">
                                                Date
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {announcements.map((a) => (
                                            <tr key={a.id} className="border-b hover:bg-gray-50">
                                                <td className="p-3">{a.title}</td>
                                                <td className="p-3">
                                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700">
                                                        {formatVisibility(a.roles)}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-gray-500">
                                                    {formatAnnDate(a.starts_at || a.created_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </Section>


                        {/* Manage Homepage Features */}
                        <Section
                            title="Manage Homepage Features"
                            onViewAll={() => navigate("/admin/features")}
                        >
                            <ManageFeatures />
                        </Section>

                        {/* Payment Page Settings */}
                        <Section
                            title="Payment Page Settings"
                            onViewAll={() => {}}
                        >
                            <ManagePaymentPage />
                        </Section>

                        {/* Subscription Plans */}
                        <Section
                            title="Subscription Plans"
                            onViewAll={() => {}}
                        >
                            <ManagePlans />
                        </Section>

                        {/* Pending Agent Approvals */}
                        <Section title="Pending Agent Approvals">
                            {pendingUsers.length === 0 ? (
                                <p className="text-sm text-gray-500">No pending agent accounts.</p>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 font-semibold text-gray-500">Name</th>
                                            <th className="p-3 font-semibold text-gray-500">Email</th>
                                            <th className="p-3 font-semibold text-gray-500">Role</th>
                                            <th className="p-3 font-semibold text-gray-500">Status</th>
                                            <th className="p-3 font-semibold text-gray-500">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingUsers.map((u) => (
                                            <tr key={u.id} className="border-b hover:bg-gray-50">
                                                <td className="p-3">{u.name || "—"}</td>
                                                <td className="p-3 text-gray-500">{u.email}</td>
                                                <td className="p-3 capitalize">{u.role}</td>
                                                <td className="p-3">
                                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                        {u.status}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <button
                                                        onClick={() => approveUser(u.id)}
                                                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                                                    >
                                                        Approve
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </Section>

                    </div>
                </div>
            </main>
        </div>
    );
}

function formatVisibility(roles) {
    if (!roles || roles.length === 0) return "Everyone";
    if (!Array.isArray(roles)) return String(roles);

    const pretty = roles.map((r) => {
        const v = String(r || "").toLowerCase();
        if (v === "agent") return "Agents";
        if (v === "homeowner") return "Homebuyers";
        if (v === "admin") return "Admins";
        return r;
    });
    return pretty.join(", ");
}

function formatAnnDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
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

/* Manage Dropdowns Component */
function ManageDropdowns() {
    const [type, setType] = useState("property_type");
    const [options, setOptions] = useState([]);

    useEffect(() => {
        fetchOptions();
    }, [type]);

    const fetchOptions = async () => {
        try {
            const res = await api.get(`/api/options/${type}`);
            setOptions(res.data.options || []);
        } catch (err) {
            console.error("Failed to fetch options", err);
        }
    };

    const addOption = async () => {
        const name = prompt("Enter new option:");
        if (!name) return;
        try {
            await api.post(`/api/options/${type}`, { name });
            fetchOptions();
        } catch (err) {
            console.error("Failed to add option", err);
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === "active" ? "inactive" : "active";
        try {
            await api.put(`/api/options/${id}/status`, { status: newStatus });
            fetchOptions();
        } catch (err) {
            console.error("Failed to update status", err);
        }
    };

    return (
        <div>
            <div className="flex items-center gap-4 mb-4">
                <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="border p-2 rounded"
                >
                    <option value="property_type">Property Types</option>
                    <option value="furnishing">Furnishing</option>
                    <option value="tenure">Tenures</option>
                    <option value="amenities">Amenities</option>
                </select>
                <button
                    onClick={addOption}
                    className="bg-emerald-600 text-white px-3 py-1 rounded"
                >
                    ➕ Add
                </button>
            </div>

            {/* List all options */}
            {options.length === 0 ? (
                <p className="text-sm text-gray-500">No options yet for {type}.</p>
            ) : (
                <table className="w-full text-left border rounded">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-2 text-gray-600 font-semibold">Name</th>
                            <th className="p-2 text-gray-600 font-semibold">Status</th>
                            <th className="p-2 text-gray-600 font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {options.map((opt) => (
                            <tr key={opt.id} className="border-b">
                                <td className="p-2">{opt.name}</td>
                                <td className="p-2">
                                    <span
                                        className={`px-2 py-1 text-xs font-semibold rounded-full ${opt.status === "active"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-red-100 text-red-700"
                                            }`}
                                    >
                                        {opt.status}
                                    </span>
                                </td>
                                <td className="p-2">
                                    <button
                                        onClick={() =>
                                            toggleStatus(opt.id, opt.status)
                                        }
                                        className="text-blue-600 hover:underline text-sm"
                                    >
                                        {opt.status === "active"
                                            ? "Disable"
                                            : "Enable"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

/* Manage Payment Page Component */
function ManagePaymentPage() {
    const [form, setForm] = useState({
        title: "",
        subtitle: "",
        disclaimer: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState("");

    // 1) Load current values from DB when component mounts
    useEffect(() => {
        const fetchPage = async () => {
            try {
                setStatus("");
                const res = await api.get("/api/admin/payment-page");
                const d = res.data || {};
                setForm({
                    title: d.title || "",
                    subtitle: d.subtitle || "",
                    disclaimer: d.disclaimer || "",
                });
            } catch (err) {
                console.error("Failed to fetch payment page:", err);
                setStatus("Failed to load current payment page.");
            } finally {
                setLoading(false);
            }
        };
        fetchPage();
    }, []);

    function handleChange(e) {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    }

    // 2) Save changes (this will update the DB via your PUT endpoint)
    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        setStatus("");
        try {
            const res = await api.put("/api/admin/payment-page", {
                title: form.title,
                subtitle: form.subtitle,
                disclaimer: form.disclaimer,
            });
            // Optional: re-sync with whatever DB actually stored
            const d = res.data || {};
            setForm({
                title: d.title || form.title,
                subtitle: d.subtitle || form.subtitle,
                disclaimer: d.disclaimer || form.disclaimer,
            });
            setStatus("Payment page saved successfully.");
        } catch (err) {
            console.error("Failed to save payment page:", err);
            setStatus("Failed to save payment page.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <p className="text-sm text-gray-500">Loading payment page…</p>;
    }

    return (
        <form onSubmit={handleSave} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                </label>
                <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    placeholder="Complete Subscription"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subtitle
                </label>
                <input
                    type="text"
                    name="subtitle"
                    value={form.subtitle}
                    onChange={handleChange}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    placeholder="Choose a plan to continue"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Disclaimer
                </label>
                <textarea
                    name="disclaimer"
                    value={form.disclaimer}
                    onChange={handleChange}
                    rows={3}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    placeholder="All payments are processed by Stripe in test mode."
                />
            </div>

            {status && (
                <p className="text-sm mt-1 text-gray-600">
                    {status}
                </p>
            )}

            <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
            >
                {saving ? "Saving…" : "Save Payment Page"}
            </button>
        </form>
    );
}

/* Manage Plans Component */
function ManagePlans() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("");

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            setStatus("");
            // ✅ use the new admin endpoint
            const res = await api.get("/api/admin/plans");
            const list = Array.isArray(res.data) ? res.data : [];
            setPlans(list);
        } catch (err) {
            console.error("Failed to fetch plans:", err);
            setStatus("Failed to load plans.");
        } finally {
            setLoading(false);
        }
    };

    const addPlan = async () => {
        const handle = prompt("Plan handle (e.g. PRO_MONTHLY):");
        if (!handle) return;
        const name = prompt("Display name (e.g. Pro Monthly):");
        if (!name) return;
        const description = prompt("Description (optional):") || null;
        const unitAmountStr = prompt(
            "Unit amount in cents (e.g. 9900 for $99.00):"
        );
        if (!unitAmountStr) return;
        const interval = prompt("Billing interval (month/year):", "month");
        if (!interval) return;
        const stripePriceId = prompt("Stripe price ID (e.g. price_123):");
        if (!stripePriceId) return;
        const currency = "sgd";

        try {
            const body = {
                handle,
                name,
                description,
                currency,
                unit_amount: parseInt(unitAmountStr, 10),
                interval,
                stripe_price_id: stripePriceId,
                is_active: true,
            };
            const res = await api.post("/api/admin/plans", body);
            setPlans((prev) => [...prev, res.data]);
            setStatus("Plan created.");
        } catch (err) {
            console.error("Failed to create plan:", err);
            setStatus("Failed to create plan.");
        }
    };

    const toggleActive = async (plan) => {
        try {
            const res = await api.patch(`/api/admin/plans/${plan.id}`, {
                is_active: !plan.is_active,
            });
            setPlans((prev) =>
                prev.map((p) => (p.id === plan.id ? res.data : p))
            );
            setStatus("Plan updated.");
        } catch (err) {
            console.error("Failed to update plan:", err);
            setStatus("Failed to update plan.");
        }
    };

    const editPrice = async (plan) => {
        const current = plan.unit_amount || 0;
        const next = prompt(
            `New unit amount in cents for ${plan.handle} (current: ${current}):`,
            String(current)
        );
        if (!next) return;
        const value = parseInt(next, 10);
        if (Number.isNaN(value)) return alert("Invalid amount.");

        try {
            const res = await api.patch(`/api/admin/plans/${plan.id}`, {
                unit_amount: value,
            });
            setPlans((prev) =>
                prev.map((p) => (p.id === plan.id ? res.data : p))
            );
            setStatus("Price updated.");
        } catch (err) {
            console.error("Failed to update price:", err);
            setStatus("Failed to update price.");
        }
    };

    if (loading) {
        return <p className="text-sm text-gray-500">Loading plans…</p>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                    Configure subscription plans linked to Stripe.
                </p>
                <button
                    onClick={addPlan}
                    className="bg-emerald-600 text-white px-3 py-1 rounded text-sm hover:bg-emerald-700"
                >
                    ➕ Add Plan
                </button>
            </div>

            {status && (
                <p className="text-sm text-gray-600">
                    {status}
                </p>
            )}

            {plans.length === 0 ? (
                <p className="text-sm text-gray-500">
                    No plans configured yet.
                </p>
            ) : (
                <table className="w-full text-left border rounded">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-2 text-gray-600 font-semibold">
                                Handle
                            </th>
                            <th className="p-2 text-gray-600 font-semibold">
                                Name
                            </th>
                            <th className="p-2 text-gray-600 font-semibold">
                                Amount (cents)
                            </th>
                            <th className="p-2 text-gray-600 font-semibold">
                                Interval
                            </th>
                            <th className="p-2 text-gray-600 font-semibold">
                                Active
                            </th>
                            <th className="p-2 text-gray-600 font-semibold">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {plans.map((plan) => (
                            <tr key={plan.id} className="border-b">
                                <td className="p-2 text-xs font-mono">
                                    {plan.handle}
                                </td>
                                <td className="p-2 text-sm">{plan.name}</td>
                                <td className="p-2 text-sm">
                                    {plan.unit_amount}
                                </td>
                                <td className="p-2 text-sm">
                                    {plan.interval}
                                </td>
                                <td className="p-2">
                                    <span
                                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            plan.is_active
                                                ? "bg-green-100 text-green-700"
                                                : "bg-red-100 text-red-700"
                                        }`}
                                    >
                                        {plan.is_active ? "Active" : "Inactive"}
                                    </span>
                                </td>
                                <td className="p-2 space-x-2">
                                    <button
                                        onClick={() => toggleActive(plan)}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        {plan.is_active ? "Disable" : "Enable"}
                                    </button>
                                    <button
                                        onClick={() => editPrice(plan)}
                                        className="text-sm text-indigo-600 hover:underline"
                                    >
                                        Edit Price
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}