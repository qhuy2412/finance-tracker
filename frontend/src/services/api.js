import axios from "axios";
import { translateError } from "../utils/errorMessages";

const baseURL = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");

const api = axios.create({
  baseURL,
  withCredentials: true,
});

/** Dedicated client for refresh — avoids nested interceptor edge cases; sends cookies like `api`. */
const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const redirectToAuth = () => {
  if (window.location.pathname !== "/auth") {
    window.location.href = "/auth";
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const reqUrl = originalRequest.url || "";
    const isRefreshCall = reqUrl.includes("refresh-token");

    if (error.response?.status === 401) {
      // Refresh endpoint failed → hết phiên, hoặc retry sau refresh mà vẫn 401 → không để user "treo" với user state cũ.
      if (isRefreshCall) {
        isRefreshing = false;
        redirectToAuth();
        return Promise.reject(error);
      }

      if (originalRequest._retry) {
        isRefreshing = false;
        redirectToAuth();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        originalRequest._retry = true;
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        await refreshClient.post("/auth/refresh-token", {});
        isRefreshing = false;
        processQueue(null);
        await new Promise((r) => setTimeout(r, 0));
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        redirectToAuth();
        return Promise.reject(refreshError);
      }
    }

    // Dịch message lỗi sang tiếng Việt trước khi reject
    if (error.response?.data) {
      const raw = error.response.data.message || error.response.data.error;
      error.response.data.message = translateError(raw);
    } else if (error.message === "Network Error") {
      error.translatedMessage = translateError("Network Error");
    }
    return Promise.reject(error);
  }
);

export default api;