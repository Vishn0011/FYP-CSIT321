import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function ManageFeatures() {
    const [features, setFeatures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ title: "", description: "", icon: "", category: "ai", is_visible: true });

    const [message, setMessage] = useState(""); // success/error message

    async function fetchFeatures() {
        try {
            setErr("");
            const res = await fetch(`${API_BASE}/api/admin/features`, { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setFeatures(await res.json());
        } catch (e) {
            console.error(e);
            setErr("Failed to load features");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchFeatures(); }, []);

    function openEdit(f) {
        setEditing(f);
        setForm({ ...f });
    }

    async function saveEdit() {
        try {
            const res = await fetch(`${API_BASE}/api/admin/features/${editing.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error("Failed to save");
            setEditing(null);
            fetchFeatures();

            // show success message
            setMessage("Feature updated successfully");
            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            console.error("Failed to update feature", err);
            setMessage("Failed to save changes");
            setTimeout(() => setMessage(""), 3000);
        }
    }

    return (
        <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-700">Manage Features</h2>
            </div>

            {/* Feedback message */}
            {message && (
                <div className="mb-4 p-3 rounded bg-emerald-50 text-emerald-800 text-sm font-medium">
                    {message}
                </div>
            )}

            {loading ? (
                <div className="text-sm text-gray-500">Loading</div>
            ) : err ? (
                <div className="text-sm text-red-600">{err}</div>
            ) : (
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200">
                        <tr>
                            <th className="p-3">Title</th>
                            <th className="p-3">Category</th>
                            <th className="p-3">Icon</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {features.map((f) => (
                            <tr key={f.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">{f.title}</td>
                                <td className="p-3 capitalize">{f.category}</td>
                                <td className="p-3">{f.icon}</td>
                                <td className="p-3">
                                    {f.is_visible ? (
                                        <span className="text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs font-semibold">
                                            Active
                                        </span>
                                    ) : (
                                        <span className="text-gray-700 bg-gray-200 px-2 py-1 rounded-full text-xs font-semibold">
                                            Inactive
                                        </span>
                                    )}
                                </td>
                                <td className="p-3 space-x-2">
                                    <button
                                        onClick={() => openEdit(f)}
                                        className="text-blue-600 hover:underline"
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Edit Modal */}
            {editing && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Edit Feature</h3>

                        <label className="block mb-2">
                            <span className="text-sm font-medium">Title</span>
                            <input
                                className="w-full border rounded p-2 mt-1"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </label>

                        <label className="block mb-2">
                            <span className="text-sm font-medium">Description</span>
                            <textarea
                                className="w-full border rounded p-2 mt-1"
                                rows="3"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </label>

                        <label className="block mb-2">
                            <span className="text-sm font-medium">Icon</span>
                            <input
                                className="w-full border rounded p-2 mt-1"
                                value={form.icon}
                                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                            />
                        </label>

                        <label className="block mb-4">
                            <span className="text-sm font-medium">Category</span>
                            <select
                                className="w-full border rounded p-2 mt-1"
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                            >
                                <option value="ai">AI</option>
                                <option value="traditional">Traditional</option>
                            </select>
                        </label>

                        <div className="flex items-center mb-4">
                            <input
                                type="checkbox"
                                checked={form.is_visible}
                                onChange={(e) => setForm({ ...form, is_visible: e.target.checked })}
                                className="mr-2"
                            />
                            <span className="text-sm">
                                {form.is_visible ? "Active (shown on homepage)" : "Inactive (hidden on homepage)"}
                            </span>
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setEditing(null)}
                                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveEdit}
                                className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
