import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "./api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem("user");
        const savedToken = localStorage.getItem("token");

        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch {
                localStorage.removeItem("user");
            }
        }

        if (savedToken) {
            setToken(savedToken);
            api.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
        }

        setLoading(false);
    }, []);

    const clearWelcomeFlags = useCallback(() => {
        try {
            const keys = [];
            for (let i = 0; i < sessionStorage.length; i += 1) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith("welcome_seen:")) {
                    keys.push(key);
                }
            }
            keys.forEach((key) => sessionStorage.removeItem(key));
        } catch {
            // swallow storage errors
        }
    }, []);

    const setUserData = useCallback((nextUserOrUpdater) => {
        setUser((prev) => {
            const resolved =
                typeof nextUserOrUpdater === "function"
                    ? nextUserOrUpdater(prev)
                    : nextUserOrUpdater;

            if (resolved) {
                localStorage.setItem("user", JSON.stringify(resolved));
                return resolved;
            }

            localStorage.removeItem("user");
            return null;
        });
    }, []);

    const login = (userData, tokenData) => {
        clearWelcomeFlags(); // ensure next session shows welcome flow again
        if (userData) {
            setUserData(userData);
        }

        if (tokenData) {
            setToken(tokenData);
            localStorage.setItem("token", tokenData);
            api.defaults.headers.common["Authorization"] = `Bearer ${tokenData}`;
        } else {
            setToken(null);
            localStorage.removeItem("token");
            delete api.defaults.headers.common["Authorization"];
        }
    };

    const logout = () => {
        setUserData(null);
        setToken(null);
        localStorage.removeItem("token");
        delete api.defaults.headers.common["Authorization"];
        clearWelcomeFlags();
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser: setUserData }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
