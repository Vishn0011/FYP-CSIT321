import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api";

export default function AdminAnnouncements() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await api.get("/admin/announcements");
        if (!cancelled) {
          setItems(Array.isArray(res.data) ? res.data : []);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setErr(
            e?.response?.data?.error || "Failed to load announcements from API."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function formatVisibility(row) {
    const roles = row.roles || [];
    if (!roles || roles.length === 0) return "Everyone";
    const pretty = roles.map((r) => {
      const v = String(r || "").toLowerCase();
      if (v === "agent") return "Agents";
      if (v === "homeowner") return "Homebuyers";
      if (v === "admin") return "Admins";
      return r;
    });
    return pretty.join(", ");
  }

  function formatDate(row) {
    const src = row.starts_at || row.created_at;
    if (!src) return "-";
    const d = new Date(src);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pt-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Announcements
              </h2>
              <p className="text-gray-500">
                Company-wide updates created by admins.
              </p>
            </div>
            <Link
              to="/admin/announcements/new"
              className="rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              + Create Announcement
            </Link>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-4 text-sm text-gray-500">Loading…</div>
              ) : err ? (
                <div className="p-4 text-sm text-red-600">{err}</div>
              ) : items.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  No announcements yet.
                </div>
              ) : (
                <table className="w-full min-w-[768px] text-left text-sm text-gray-700">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                    <tr>
                      <th className="px-6 py-3">Title</th>
                      <th className="px-6 py-3">Visibility</th>
                      <th className="px-6 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {row.title}
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            {formatVisibility(row)}
                          </span>
                        </td>
                        <td className="px-6 py-4">{formatDate(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

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
