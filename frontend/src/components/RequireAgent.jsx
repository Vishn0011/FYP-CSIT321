import { Navigate, useLocation, useParams } from "react-router-dom";

export default function RequireAgent({ children }) {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const { id } = useParams(); // eg from /properties/:id
    const location = useLocation();

    const hasSeenWelcome = (role) => sessionStorage.getItem(`welcome_seen:${role || "unknown"}`) === "1";

    if (!token) return <Navigate to="/admin/login" replace />;

    if (user?.role !== "agent") return <Navigate to="/login" replace />;

    //If the URL includes an id and user.agent_id doesn't match, block
    if (id && user?.agent_id && user.agent_id.toString() !== id.toString()) {
        return <Navigate to="/unauthorized" replace />;
    }

    if (!hasSeenWelcome(user.role) && location.pathname !== "/welcome") {
        return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
    }

    return children;
}
