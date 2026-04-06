import api from "./api";

const authApi = {
    register: (username, email, password) => api.post("/auth/register", { username, email, password }),
    verifyEmail: (email, code) => api.post("/auth/verify-email", { email, code }),
    login: (email, password) => api.post("/auth/login", { email, password }),
    logout: () => api.post("/auth/logout"),
    refreshToken: () => api.post("/auth/refresh-token"),
    getMe: () => api.get("/auth/me"),
}
export default authApi;
