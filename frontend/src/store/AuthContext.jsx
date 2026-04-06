import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import authApi from "../services/authApi";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        authApi.getMe()
            .then(res => setUser(res.data.user))
            .catch(() => {
                setUser(null);
            })
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
    
    // register now only sends OTP — does NOT set user
    const handleRegister = useCallback(async (username, email, password) => {
        const res = await authApi.register(username, email, password);
        return res.data;
    }, []);

    const handleVerifyEmail = useCallback(async (email, code) => {
        const res = await authApi.verifyEmail(email, code);
        return res.data;
    }, []);
    
    const value = useMemo(() => ({
        user,
        loading,
        login: handleLogin,
        logout: handleLogout,
        register: handleRegister,
        verifyEmail: handleVerifyEmail,
    }), [user, loading, handleLogin, handleLogout, handleRegister, handleVerifyEmail]);
    
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);