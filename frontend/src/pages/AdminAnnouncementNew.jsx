// src/pages/AdminAnnouncementNew.jsx
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import api from "../api";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admins" },
  { value: "agent", label: "Agents" },
  { value: "homeowner", label: "Homebuyers" },
];

export default function AdminAnnouncementNew() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedRoles, setSelectedRoles] = useState(["admin", "agent", "homeowner"]); // default = everyone
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  function toggleRole(role) {
    setSelectedRoles((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      alert("Title and content are required.");
      return;
    }

    if (selectedRoles.length === 0) {
      alert("Select at least one audience (Admins, Agents, Homebuyers).");
      return;
    }

    setSaving(true);
    try {
      await api.post("/admin/announcements", {
        title: title.trim(),
        body_md: content.trim(),
        roles: selectedRoles,
      });

      setSuccess("Announcement created successfully.");
      // small delay or just navigate
      nav("/admin/announcements");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to create announcement.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pt-6">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-3xl font-bold text-gray-900">
            Create Announcement
          </h2>

          {success && (                                                   // <-- ADD THIS BLOCK
            <div className="mb-4 rounded-lg border border-emerald-200 
                  bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-lg bg-white p-6 shadow"
          >
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                className="mt-1 w-full rounded-md border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="e.g. Scheduled Maintenance – RDS (11pm–1am)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Audience (checkboxes) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Audience
              </label>
              <p className="mb-2 text-xs text-gray-500">
                Choose which user types will see this announcement when they log in.
              </p>
              <div className="flex flex-wrap gap-3">
                {ROLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="inline-flex items-center gap-2 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      checked={selectedRoles.includes(opt.value)}
                      onChange={() => toggleRole(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Content
              </label>
              <textarea
                rows={6}
                className="mt-1 w-full rounded-md border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="Short announcement text…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Publishing…" : "Publish"}
              </button>
              <Link
                to="/admin/announcements"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
                Cancel
              </Link>
            </div>
          </form>

          <div className="py-8">
            <Link
              to="/admin/dashboard"
              className="text-emerald-600 hover:underline text-sm"
            >
              ← Back to admin home page
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
