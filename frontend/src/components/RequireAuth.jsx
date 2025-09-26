// frontend/src/components/RequireAuth.jsx
import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();

  if (!ready) return null; // spinner placeholder if needed
  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return children;
}
