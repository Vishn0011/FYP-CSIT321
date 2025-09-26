import { useEffect, useState } from "react";
import { getMe } from "../services/auth";
import { onAuthChanged } from "../lib/authBus";

async function fetchUser() {
  try {
    const res = await getMe();
    return res?.user || null;
  } catch {
    return null;
  }
}

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // initial load
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    let active = true;
    fetchUser().then((u) => {
      if (active) {
        setUser(u);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // react to login/logout events (and cross-tab changes)
  useEffect(() => {
    let cancelled = false;

    const handle = async () => {
      if (cancelled) return;
      const token = localStorage.getItem("authToken");
      if (!token) {
        setUser(null);
        return;
      }
      const u = await fetchUser();
      if (!cancelled) setUser(u);
    };

    // custom bus
    const off = onAuthChanged(handle);
    // browser storage (other tabs)
    const storageListener = (e) => {
      if (e.key === "authToken") handle();
    };
    window.addEventListener("storage", storageListener);

    return () => {
      cancelled = true;
      off();
      window.removeEventListener("storage", storageListener);
    };
  }, []);

  return { user, ready };
}
