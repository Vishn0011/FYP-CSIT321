// src/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
            try {
                setUser(JSON.parse(storedUser));
            } catch (err) {
                console.error("Invalid user in localStorage:", storedUser, err);
                localStorage.removeItem("user");
            }
        }
    }, []);

    const setUserData = useCallback((nextUserOrUpdater) => {
        if (typeof nextUserOrUpdater === "function") {
            setUser((prev) => {
                const resolved = nextUserOrUpdater(prev);
                if (resolved) {
                    localStorage.setItem("user", JSON.stringify(resolved));
                    return resolved;
                }
                localStorage.removeItem("user");
                return null;
            });
            return;
        }

        if (nextUserOrUpdater) {
            localStorage.setItem("user", JSON.stringify(nextUserOrUpdater));
            setUser(nextUserOrUpdater);
        } else {
            localStorage.removeItem("user");
            setUser(null);
        }
    }, [setUser]);

    const login = (user, token) => {
        if (user) {
            setUserData(user);
        }
        if (token) {
            localStorage.setItem("token", token);
        } else {
            localStorage.removeItem("token"); // don't store "undefined"
        }
    };

    const logout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, updateUser: setUserData }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
