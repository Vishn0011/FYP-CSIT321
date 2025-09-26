import api from "../lib/api";
import { emitAuthChanged } from "../lib/authBus";

// POST /auth/login -> { token, user? }
export async function login({ email, password, role }) {
  const payload = { email, password };
  if (role) payload.role = role;
  const data = await api.post("/auth/login", payload);

  if (data?.token) {
    localStorage.setItem("authToken", data.token);
    emitAuthChanged(); // notify app immediately
  }
  return data;
}

export function logout() {
  localStorage.removeItem("authToken");
  emitAuthChanged(); // notify app immediately
}

export const getMe = () => api.get("/me");
