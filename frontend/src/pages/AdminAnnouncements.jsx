import { Link } from "react-router-dom";

export default function AdminAnnouncements() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* <header className="bg-emerald-500 text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-14">
          <h1 className="text-lg font-bold">AgentPro</h1>
          <nav className="text-sm">
            <Link to="/admin" className="hover:underline">Dashboard</Link>
          </nav>
        </div>
      </header> */}

      <main className="pt-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Announcements</h2>
              <p className="text-gray-500">Company-wide updates (demo data).</p>
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
              <table className="w-full min-w-[768px] text-left text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">Visibility</th>
                    <th className="px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Scheduled Maintenance – RDS (11pm–1am)
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">Agents Only</span>
                    </td>
                    <td className="px-6 py-4">Sep 28, 2025</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      New Feature: Manage Listings (Beta)
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Public</span>
                    </td>
                    <td className="px-6 py-4">Sep 18, 2025</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Hari Raya Office Closure
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">Admins Only</span>
                    </td>
                    <td className="px-6 py-4">Apr 10, 2025</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <nav className="flex items-center justify-between p-4">
              <span className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-900">1–3</span> of{" "}
                <span className="font-semibold text-gray-900">3</span>
              </span>
            </nav>
          </div>

          {/* Back to dashboard */}
          <div className="py-8">
            <Link to="/admin/dashboard" className="text-emerald-600 hover:underline text-sm">← Back to admin home page</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
