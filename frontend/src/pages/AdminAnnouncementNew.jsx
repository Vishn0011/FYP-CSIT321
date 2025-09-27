import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";

export default function AdminAnnouncementNew() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("Public");
  const [content, setContent] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    // demo only
    alert("Announcement created (demo).");
    nav("/admin/announcements");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* <header className="bg-emerald-500 text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-14">
          <h1 className="text-lg font-bold">AgentPro</h1>
          <nav className="text-sm">
            <Link to="/admin/announcements" className="hover:underline">Announcements</Link>
          </nav>
        </div>
      </header> */}

      <main className="pt-6">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-3xl font-bold text-gray-900">Create Announcement</h2>

          <form onSubmit={handleSubmit} className="space-y-6 rounded-lg bg-white p-6 shadow">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                className="mt-1 w-full rounded-md border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="e.g., Scheduled Maintenance – RDS (11pm–1am)"
                value={title}
                onChange={(e)=>setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Visibility</label>
              <select
                className="mt-1 w-full rounded-md border-gray-300 text-gray-700 focus:border-emerald-500 focus:ring-emerald-500"
                value={visibility}
                onChange={(e)=>setVisibility(e.target.value)}
              >
                <option>Public</option>
                <option>Agents Only</option>
                <option>Admins Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Content</label>
              <textarea
                rows={6}
                className="mt-1 w-full rounded-md border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="Short announcement text…"
                value={content}
                onChange={(e)=>setContent(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">Demo page – not saving to backend (yet).</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Publish
              </button>
              <Link
                to="/admin/announcements"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
          </form>

          {/* Back to dashboard */}
          <div className="py-8">
            <Link to="/admin/dashboard" className="text-emerald-600 hover:underline text-sm">← Back to admin home page</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
