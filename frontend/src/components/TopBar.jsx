// src/components/TopBar.jsx
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { logout } from "../services/auth";

export default function TopBar() {
  const { user } = useAuth();
  const nav = useNavigate();

  function doLogout() {
    logout();                // clears token + notifies app
    nav("/login", { replace: true });
  }

  return (
    <div style={styles.bar}>
      <div style={styles.inner}>
        <div style={styles.brand}>FYP Frontend</div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {user && (
            <>
              <Link to="/homebuyer/dashboard" style={styles.link}>HB: Dashboard</Link>
              <Link to="/homebuyer/search" style={styles.link}>HB: Search</Link>
              <Link to="/homebuyer/favourites" style={styles.link}>HB: Favourites</Link>
            </>
          )}

          {!user ? (
            <Link to="/login" style={styles.loginBtn}>Login</Link>
          ) : (
            <button onClick={doLogout} style={styles.logoutBtn}>
              Logout {user?.email ? `(${user.email})` : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  bar: {
    background: "#0b5a47",
    borderBottom: "1px solid #0a4e3e",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  inner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { color: "#fff", fontWeight: 800, fontSize: 22 },
  link: {
    color: "#e6fff7",
    textDecoration: "none",
    padding: "6px 8px",
    borderRadius: 8,
  },
  loginBtn: {
    color: "#0b5a47",
    background: "#fff",
    border: "1px solid #bcd8cf",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  logoutBtn: {
    color: "#0b5a47",
    background: "#fff",
    border: "1px solid #bcd8cf",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 600,
    cursor: "pointer",
  },
};
