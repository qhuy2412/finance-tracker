import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import authApi from "../services/authApi";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        authApi.getMe()
            .then(res => setUser(res.data.user))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);
    
    const handleLogin = useCallback(async (email, password) => {
        const res = await authApi.login(email, password);
        setUser(res.data.user);
        return res.data.user;
    }, []);
    
    const handleLogout = useCallback(async () => {
        await authApi.logout();
        setUser(null);
    }, []);
    
    const handleRegister = useCallback(async (username, email, password) => {
        const res = await authApi.register(username, email, password);
        setUser(res.data.user);
        return res.data.user;
    }, []);
    
    const value = useMemo(() => ({
        user,
        loading,
        login: handleLogin,
        logout: handleLogout,
        register: handleRegister
    }), [user, loading, handleLogin, handleLogout, handleRegister]);
    
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);