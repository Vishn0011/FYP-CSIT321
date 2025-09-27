// src/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

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

    const login = (user, token) => {
        if (user) {
            localStorage.setItem("user", JSON.stringify(user));
            setUser(user);
        }
        if (token) {
            localStorage.setItem("token", token);
        } else {
            localStorage.removeItem("token"); // don’t store "undefined"
        }
    };

    const logout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
