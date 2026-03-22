import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor ────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // Auth token
    const token = localStorage.getItem('atom_token');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;

    // Force no-cache on every request — prevents 304 returning empty stale data
    config.headers['Cache-Control'] = 'no-cache, no-store';
    config.headers['Pragma'] = 'no-cache';

    // Add timestamp param to all GET requests — busts Vercel edge cache
    if (!config.method || config.method.toLowerCase() === 'get') {
      config.params = { ...(config.params || {}), _t: Date.now() };
    }

    return config;
  },
  (err) => Promise.reject(err)
);

// ── Response interceptor ───────────────────────────────────────
const getRedirecting = () => sessionStorage.getItem('__atom_redir') === '1';
const setRedirecting = () => sessionStorage.setItem('__atom_redir', '1');
const clearRedirecting = () => sessionStorage.removeItem('__atom_redir');

api.interceptors.response.use(
  (res) => {
    clearRedirecting();
    return res;
  },
  async (err) => {
    const config = err.config;

    // 401 — token expired or invalid
    if (err.response?.status === 401 && !getRedirecting()) {
      setRedirecting();
      localStorage.removeItem('atom_token');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    // Retry once on 5xx or network errors (GET only)
    if (
      !config._retried &&
      (!err.response || err.response.status >= 500) &&
      config.method?.toLowerCase() === 'get'
    ) {
      config._retried = true;
      await new Promise(r => setTimeout(r, 1000));
      return api(config);
    }

    return Promise.reject(err);
  }
);

// ─── Helpers ──────────────────────────────────────────────────

// Safely extract gyms array from any response shape
export const extractGyms = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.gyms)) return data.gyms;
  if (Array.isArray(data?.data?.gyms)) return data.data.gyms;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

// Safely unwrap { success, data: X } envelope OR return data directly
export const unwrap = (responseData) => {
  if (responseData && 'success' in responseData && 'data' in responseData) {
    return responseData.data;
  }
  return responseData;
};

// Extract error message from any error shape
export const getErrorMessage = (err, fallback = 'An error occurred') => {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
};

export default api;
