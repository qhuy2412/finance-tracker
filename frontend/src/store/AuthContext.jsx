import { createContext, useContext, useState, useEffect } from "react";
import authApi from "../services/authApi";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        authApi.getMe()
            .then(res => setUser(res.data))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);
    const handleLogin = async (email, password) => {
        const res = await authApi.login(email, password);
        setUser(res.data);
    };
    const handleLogout = async () => {
        await authApi.logout();
        setUser(null);
    };
    const handleRegister = async (username, email, password) => {
        const res = await authApi.register(username, email, password);
        setUser(res.data);
    }
    return (
        <AuthContext.Provider value={{ user, loading, login: handleLogin, logout: handleLogout, register: handleRegister }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);