import { Navigate } from "react-router-dom";

export default function RequireAdmin({ children }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (!token) return <Navigate to="/admin/login" replace />;
  if (user?.role !== "admin") return <Navigate to="/login" replace />;
  return children;
}
