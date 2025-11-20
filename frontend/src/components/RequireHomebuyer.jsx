import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function RequireHomebuyer({ children }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    const hasSeenWelcome = (role) => sessionStorage.getItem(`welcome_seen:${role || "unknown"}`) === "1";

    if (loading) {
        // still checking localStorage — temporarily show nothing or spinner
        return <div>Loading...</div>;
    }

    if (!user) {
        // not logged in — go to login
        return <Navigate to="/login" replace />;
    }

    if (user.role !== "homeowner") {
        // logged in but not a homebuyer — block access
        return <Navigate to="/" replace />;
    }

    return children;
}
