import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import ThemeToggle from "./ThemeToggle";

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="flex justify-between items-center px-6 py-4 bg-emerald-700 dark:bg-emerald-900 text-white shadow-md">
      <div className="font-bold text-xl tracking-wide">Aspect Real Estate</div>

      <div className="flex gap-6 items-center">
        <Link to="/agents" className="hover:text-emerald-200 dark:hover:text-emerald-100 transition">
          Agents
        </Link>
        <Link to="/predict" className="hover:text-emerald-200 dark:hover:text-emerald-100 transition">
          Predict
        </Link>
        <Link to="/dashboard" className="hover:text-emerald-200 dark:hover:text-emerald-100 transition">
          Dashboard
        </Link>
        <Link to="/compare" className="hover:text-emerald-200 dark:hover:text-emerald-100 transition">
          Compare
        </Link>
        <Link to="/reports" className="hover:text-emerald-200 dark:hover:text-emerald-100 transition">
          Reports
        </Link>
        <Link to="/properties" className="hover:text-emerald-200 dark:hover:text-emerald-100 transition">
          Properties
        </Link>

        {/* Right side: theme toggle + auth actions */}
        <div className="ml-6 flex items-center gap-3">
          <ThemeToggle />
          {!user ? (
            <div className="flex gap-3">
              <Link
                to="/login"
                className="bg-white text-emerald-700 dark:text-emerald-900 px-4 py-2 rounded-lg font-semibold shadow hover:bg-gray-100 transition"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-emerald-600 transition"
              >
                Sign Up
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="bg-white text-emerald-700 dark:text-emerald-900 px-3 py-2 rounded-lg font-semibold shadow">
                {user.name || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-red-600 transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
