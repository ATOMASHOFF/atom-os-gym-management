import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach token ───────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('atom_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

// ── Response interceptor — normalize + auto-retry ────────────
let isRedirecting = false;

api.interceptors.response.use(
  // Normalize: unwrap { success, data } envelope
  (res) => {
    if (res.data?.success !== undefined && res.data?.data !== undefined) {
      res.data = res.data.data;
    }
    return res;
  },
  async (err) => {
    const config = err.config;

    // 401 — expired or invalid token
    if (err.response?.status === 401 && !isRedirecting) {
      isRedirecting = true;
      localStorage.removeItem('atom_token');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    // Retry once on network errors or 5xx (but not on 4xx client errors)
    const shouldRetry =
      !config._retried &&
      (!err.response || err.response.status >= 500) &&
      config.method?.toLowerCase() === 'get'; // Only retry GETs safely

    if (shouldRetry) {
      config._retried = true;
      await new Promise(r => setTimeout(r, 800));
      return api(config);
    }

    return Promise.reject(err);
  }
);

// Helper to extract error message from any error shape
export const getErrorMessage = (err, fallback = 'An error occurred') => {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
};

export default api;
