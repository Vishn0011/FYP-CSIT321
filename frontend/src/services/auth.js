// frontend/src/services/auth.js
import api from "../lib/api";
import { emitAuthChanged } from "../lib/authBus";

/**
 * Save the session and notify the app.
 * We use a fetch-based client that reads the token from localStorage
 * on every request, so there's no global header to set here.
 */
export function setSession(token, user) {
  if (!token) return;

  localStorage.setItem("authToken", token);
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  }

  // If your project ALSO loads axios elsewhere, set it safely (optional).
  try {
    if (window?.axios) {
      window.axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    /* no-op */
  }

  emitAuthChanged();
}

export function clearSession() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  emitAuthChanged();
}

export function getToken() {
  return localStorage.getItem("authToken");
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export const getMe = () => api.get("/me");
