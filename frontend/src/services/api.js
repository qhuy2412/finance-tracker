import axios from "axios";


const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ,
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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Use .includes to be safer against different API URL structures
    const isRefreshTokenRequest = originalRequest.url?.includes('/auth/refresh-token');
    const isAuthRequest = originalRequest.url?.includes('/auth/me') || originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register');
    
    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshTokenRequest && !isAuthRequest) {
      

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise((resolve, reject) => {
        axios
          .post(
            `${api.defaults.baseURL}/auth/refresh-token`,
            {},
            { withCredentials: true }
          )
          .then(() => {
            processQueue(null);
            resolve(api(originalRequest));
          })
          .catch((err) => {
            processQueue(err, null);
            isRefreshing = false;
            // Prevent infinite redirect loops if already on auth page
            if (window.location.pathname !== "/auth") {
              window.location.href = "/auth";
            }
            reject(err);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    return Promise.reject(error);
  }
);

export default api;