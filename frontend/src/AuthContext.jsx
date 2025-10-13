import { createContext, useContext, useState, useEffect } from "react";
import api from "./api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true); // Add this

    useEffect(() => {
        const savedUser = localStorage.getItem("user");
        const savedToken = localStorage.getItem("token");
        if (savedUser && savedToken) {
            setUser(JSON.parse(savedUser));
            setToken(savedToken);
            api.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
        }
        setLoading(false); // Done checking
    }, []);

    const login = (userData, tokenData) => {
        setUser(userData);
        setToken(tokenData);
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("token", tokenData);
        api.defaults.headers.common["Authorization"] = `Bearer ${tokenData}`;
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        delete api.defaults.headers.common["Authorization"];
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
