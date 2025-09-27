import { Link } from "react-router-dom";

export default function AdminListings() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar placeholder – keep your real layout if you have one */}
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
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Manage Listings</h2>
            <p className="text-gray-500">Review, approve, hide, or remove property listings (hard-coded demo).</p>
          </div>

          {/* Filters (visual only) */}
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
              <div className="md:col-span-4">
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                  <input className="w-full rounded-md border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-emerald-500 focus:ring-emerald-500" placeholder="Search listings..." />
                </div>
              </div>
              <div className="md:col-span-2">
                <select className="w-full rounded-md border-gray-300 text-sm text-gray-500 focus:border-emerald-500 focus:ring-emerald-500">
                  <option>Status</option><option>Active</option><option>Pending</option><option>Hidden</option><option>Removed</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <select className="w-full rounded-md border-gray-300 text-sm text-gray-500 focus:border-emerald-500 focus:ring-emerald-500">
                  <option>Property Type</option><option>HDB</option><option>Condo</option><option>Landed</option>
                </select>
              </div>
              <div className="flex gap-4 md:col-span-3">
                <input className="w-full rounded-md border-gray-300 text-sm text-gray-500 focus:border-emerald-500 focus:ring-emerald-500" placeholder="Min Price (S$)" type="number"/>
                <input className="w-full rounded-md border-gray-300 text-sm text-gray-500 focus:border-emerald-500 focus:ring-emerald-500" placeholder="Max Price (S$)" type="number"/>
              </div>
              <div className="flex items-center justify-end md:col-span-1">
                <button className="text-sm font-medium text-gray-500 hover:text-emerald-600">Reset</button>
              </div>
            </div>
          </div>

          {/* Table (hard-coded, SG names) */}
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1024px] text-left text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                  <tr>
                    <th className="p-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"/></th>
                    <th className="px-6 py-3">Property Title</th>
                    <th className="px-6 py-3">Agent</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date Added</th>
                    <th className="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 1 */}
                  <tr className="h-14 border-b bg-white hover:bg-gray-50">
                    <td className="w-16 p-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"/></td>
                    <td className="px-6 py-4 font-medium text-gray-900">Bukit Timah Terrace Home</td>
                    <td className="px-6 py-4">Tan Wei Ling</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">Pending Approval</span>
                    </td>
                    <td className="px-6 py-4">2025-08-15</td>
                    <td className="flex items-center justify-center gap-2 px-6 py-4">
                      <button className="rounded p-1 text-gray-500 hover:bg-gray-200"><span className="material-symbols-outlined text-lg">visibility</span></button>
                      <button className="rounded p-1 text-gray-500 hover:bg-gray-200"><span className="material-symbols-outlined text-lg">visibility_off</span></button>
                      <button className="rounded p-1 text-green-600 hover:bg-green-100"><span className="material-symbols-outlined text-lg">check_circle</span></button>
                      <button className="rounded p-1 text-red-500 hover:bg-red-100"><span className="material-symbols-outlined text-lg">delete</span></button>
                    </td>
                  </tr>
                  {/* 2 */}
                  <tr className="h-14 border-b bg-gray-50/50 hover:bg-gray-50">
                    <td className="w-16 p-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"/></td>
                    <td className="px-6 py-4 font-medium text-gray-900">Punggol 4-Room HDB (Sea View)</td>
                    <td className="px-6 py-4">Muhd Firdaus</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Active</span>
                    </td>
                    <td className="px-6 py-4">2025-07-22</td>
                    <td className="flex items-center justify-center gap-2 px-6 py-4">
                      <button className="rounded p-1 text-gray-500 hover:bg-gray-200"><span className="material-symbols-outlined text-lg">visibility</span></button>
                      <button className="rounded p-1 text-gray-500 hover:bg-gray-200"><span className="material-symbols-outlined text-lg">visibility_off</span></button>
                      <button className="rounded p-1 text-green-600 hover:bg-green-100"><span className="material-symbols-outlined text-lg">check_circle</span></button>
                      <button className="rounded p-1 text-red-500 hover:bg-red-100"><span className="material-symbols-outlined text-lg">delete</span></button>
                    </td>
                  </tr>
                  {/* 3 */}
                  <tr className="h-14 border-b bg-white hover:bg-gray-50">
                    <td className="w-16 p-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"/></td>
                    <td className="px-6 py-4 font-medium text-gray-900">Tampines Executive Maisonette</td>
                    <td className="px-6 py-4">Siti Nur Aisyah</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-800">Hidden</span>
                    </td>
                    <td className="px-6 py-4">2025-06-10</td>
                    <td className="flex items-center justify-center gap-2 px-6 py-4">
                      <button className="rounded p-1 text-gray-500 hover:bg-gray-200"><span className="material-symbols-outlined text-lg">visibility</span></button>
                      <button className="rounded p-1 text-gray-500 hover:bg-gray-200"><span className="material-symbols-outlined text-lg">visibility_off</span></button>
                      <button className="rounded p-1 text-green-600 hover:bg-green-100"><span className="material-symbols-outlined text-lg">check_circle</span></button>
                      <button className="rounded p-1 text-red-500 hover:bg-red-100"><span className="material-symbols-outlined text-lg">delete</span></button>
                    </td>
                  </tr>
                  {/* 4 */}
                  <tr className="h-14 border-b bg-gray-50/50 hover:bg-gray-50">
                    <td className="w-16 p-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"/></td>
                    <td className="px-6 py-4 font-medium text-gray-900">Marina Bay Residences Condo (2-Bed)</td>
                    <td className="px-6 py-4">Benjamin Lim</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Removed</span>
                    </td>
                    <td className="px-6 py-4">2025-05-05</td>
                    <td className="flex items-center justify-center gap-2 px-6 py-4">
                      <button className="rounded p-1 text-gray-500 hover:bg-gray-200"><span className="material-symbols-outlined text-lg">visibility</span></button>
                      <button className="rounded p-1 text-gray-500 hover:bg-gray-200"><span className="material-symbols-outlined text-lg">visibility_off</span></button>
                      <button className="rounded p-1 text-green-600 hover:bg-green-100"><span className="material-symbols-outlined text-lg">check_circle</span></button>
                      <button className="rounded p-1 text-red-500 hover:bg-red-100"><span className="material-symbols-outlined text-lg">delete</span></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pagination (static) */}
            <nav className="flex items-center justify-between p-4">
              <span className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-900">1–4</span> of <span className="font-semibold text-gray-900">25</span>
              </span>
              <ul className="inline-flex items-center -space-x-px">
                <li><button className="ml-0 rounded-l-lg border border-gray-300 bg-white px-3 py-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"><span className="material-symbols-outlined text-lg">chevron_left</span></button></li>
                <li><button className="z-10 border border-emerald-500 bg-emerald-50 px-3 py-2 text-emerald-600 hover:bg-emerald-100">1</button></li>
                <li><button className="border border-gray-300 bg-white px-3 py-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700">2</button></li>
                <li><button className="border border-gray-300 bg-white px-3 py-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700">3</button></li>
                <li><button className="rounded-r-lg border border-gray-300 bg-white px-3 py-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"><span className="material-symbols-outlined text-lg">chevron_right</span></button></li>
              </ul>
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
