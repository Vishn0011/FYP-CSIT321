import { useEffect, useMemo, useState } from "react";

/**
 * Drop this file at: frontend/src/pages/AdminUsers.jsx
 * Prereq:
 *   - Tailwind already set up (your HTML used Tailwind)
 *   - .env.local → VITE_API_URL=http://localhost:8000
 * Route:
 *   - In App.jsx add: <Route path="/admin/users" element={<AdminUsers/>} />
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
;


export default function AdminUsers() {
  // ---------- URL/State ----------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Controls visible in the UI (search/filters exist visually; server wiring will come in Step 2)
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all"); // admin|agent|homeowner|all
  const [status, setStatus] = useState("all"); // active|inactive|all

  // sorting
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState("desc")

  // ---------- Data ----------
  const [data, setData] = useState({ data: [], page: 1, page_size: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Selection (for future bulk actions)
  const [selected, setSelected] = useState(new Set());
  const allChecked = useMemo(() => data.data.length > 0 && data.data.every(u => selected.has(u.id)), [data, selected]);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError("");

    const url = new URL("/api/users", API_BASE);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (query.trim()) url.searchParams.set("query", query.trim());
    if (role !== "all") url.searchParams.set("role", role);
    if (status !== "all") url.searchParams.set("status", status);
    url.searchParams.set("sort", sort);
    url.searchParams.set("order", order);

    fetch(url.toString(), { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!ignore) setData(json);
      })
      .catch((e) => !ignore && setError(e.message))
      .finally(() => !ignore && setLoading(false));

    return () => { ignore = true; };
  }, [page, pageSize, query, role, status, sort, order]);

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.page_size || pageSize)));

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.data.map(u => u.id)));
    }
  }

  function sortBy(col) {
    if (sort === col) {
      setOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setOrder("asc");
    }
    setPage(1);
  }

  const caret = (col) => (
    <span className="ml-1 text-gray-400">
      {sort === col ? (order === "asc" ? "▲" : "▼") : "↕"}
    </span>
  );


  // UI helpers
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#111827]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-emerald-500 text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl">home</span>
            <h1 className="text-xl font-bold">AgentPro</h1>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a className="text-sm font-medium text-white hover:opacity-90" href="#">Dashboard</a>
            <a className="text-sm font-medium text-white hover:opacity-90" href="#">Users</a>
            <a className="text-sm font-medium text-white hover:opacity-70" href="#">Listings</a>
            <a className="text-sm font-medium text-white hover:opacity-70" href="#">Announcements</a>
          </nav>
          <div className="flex items-center gap-4">
            <button className="bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-xl font-semibold flex items-center gap-2 h-10 px-4">
              <span className="material-symbols-outlined text-lg">add</span>
              <span>New User</span>
            </button>
            <div className="h-10 w-10 rounded-full bg-cover bg-center" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=200&auto=format&fit=crop)" }} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Title + Actions Row */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Manage Users</h2>
            <p className="text-sm text-gray-500">List, search, filter, and manage user accounts.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="bg-white hover:bg-gray-50 border border-emerald-700 text-emerald-700 rounded-xl font-semibold h-10 px-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">download</span>
              <span>Export</span>
            </button>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold h-10 px-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">add</span>
              <span>New User</span>
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Filters (visual only for now) */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            <input
              className="w-full pl-10 pr-3 h-10 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Search by name or email (coming in Step 2)"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
          <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="agent">Agent</option>
            <option value="homeowner">homeowner</option>
          </select>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              className="h-10 px-4 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={() => {
                setQuery("");
                setRole("all");
                setStatus("all");
                setSort("created_at");
                setOrder("desc");
                setPage(1);
                setPageSize(20);
              }}
            >
              Reset
            </button>

          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700">
              <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                <tr>
                  <th className="p-4">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                      checked={allChecked} onChange={toggleAll} />
                  </th>
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => sortBy("name")}>
                    Name {caret("name")}
                  </th>
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => sortBy("email")}>
                    Email {caret("email")}
                  </th>
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => sortBy("role")}>
                    Role {caret("role")}
                  </th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => sortBy("created_at")}>
                    Created {caret("created_at")}
                  </th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr><td className="px-6 py-6" colSpan={7}>Loading…</td></tr>
                )}
                {!loading && error && (
                  <tr><td className="px-6 py-6 text-red-600" colSpan={7}>Error: {error}</td></tr>
                )}
                {!loading && !error && data.data.length === 0 && (
                  <tr><td className="px-6 py-6 text-gray-500" colSpan={7}>No users found.</td></tr>
                )}
                {!loading && !error && data.data.map((u) => (
                  <tr key={u.id} className="bg-white border-t hover:bg-gray-50">
                    <td className="p-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} /></td>
                    <td className="px-6 py-4 font-medium text-gray-900">{u.name || "—"}</td>
                    <td className="px-6 py-4">{u.email}</td>
                    <td className="px-6 py-4 capitalize">{u.role || "—"}</td>
                    <td className="px-6 py-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs font-semibold">Active</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1 text-xs font-semibold">Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{fmtDate(u.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button className="h-9 px-3 rounded-lg border border-gray-200 hover:bg-gray-50">View</button>
                        <button className="h-9 px-3 rounded-lg border border-gray-200 hover:bg-gray-50">Edit</button>
                        <button className="h-9 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer: pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t bg-white">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium">{Math.min((page - 1) * pageSize + 1, data.total)}</span>–
              <span className="font-medium">{Math.min(page * pageSize, data.total)}</span> of <span className="font-medium">{data.total}</span>
            </div>

            <div className="flex items-center gap-3">
              <select
                className="h-9 rounded-lg border border-gray-200 px-2"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
              </select>

              <div className="flex items-center gap-2">
                <button
                  className="h-9 px-3 rounded-lg border border-gray-200 disabled:opacity-50"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >Prev</button>
                <span className="text-sm">Page {page} / {totalPages}</span>
                <button
                  className="h-9 px-3 rounded-lg border border-gray-200 disabled:opacity-50"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >Next</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
