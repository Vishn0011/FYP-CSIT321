// frontend/src/lib/api.js
// Centralized API client using Vite env
// Usage: import api from "@/lib/api";  then api.get("/api/properties")

const BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "") || "";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("authToken"); // we'll set this after login
  return token
    ? { ...extra, Authorization: `Bearer ${token}` }
    : { ...extra };
}

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const url = `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const opts = {
    method,
    headers: authHeaders({
      "Content-Type": "application/json",
      ...headers,
    }),
  };
  if (body !== undefined) opts.body = typeof body === "string" ? body : JSON.stringify(body);

  // 👇 Add this debug log (new line)
  console.debug("API ->", method, url);

  const res = await fetch(url, opts);
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = isJson && data?.error ? data.error : res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

// Shorthands
const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: "POST", body }),
  patch: (p, body) => request(p, { method: "PATCH", body }),
  del: (p) => request(p, { method: "DELETE" }),
};

export default api;
