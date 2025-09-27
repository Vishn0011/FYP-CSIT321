import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function RequireHomebuyer
    ({ children }) {
    const { user } = useAuth();

    if (!user) {
        // not logged in ¡÷ go to login
        return <Navigate to="/login" replace />;
    }

    if (user.role !== "homeowner") {
        // logged in but not a homebuyer ¡÷ block access
        return <Navigate to="/" replace />;
    }

    return children;
}
