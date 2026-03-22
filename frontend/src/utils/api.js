import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor ───────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('atom_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Bust browser HTTP cache on every GET request
    // Prevents 304 Not Modified returning stale empty responses
    if (config.method === 'get' || !config.method) {
      config.params = { ...config.params, _t: Date.now() };
    }

    // Tell browser not to cache API responses
    config.headers['Cache-Control'] = 'no-cache';
    config.headers['Pragma'] = 'no-cache';

    return config;
  },
  (err) => Promise.reject(err)
);

// ── Response interceptor ──────────────────────────────────────
// IMPORTANT: We do NOT auto-unwrap responses here anymore.
// Each page reads r.data and handles the shape itself.
// Reason: login returns { success, token, user } — no "data" key.
// Unwrapping that breaks token extraction in AuthContext.

// FIXED: use sessionStorage so flag resets on hot reload in dev
const getRedirecting = () => sessionStorage.getItem('__atom_redirecting') === '1';
const setRedirecting = () => sessionStorage.setItem('__atom_redirecting', '1');
const clearRedirecting = () => sessionStorage.removeItem('__atom_redirecting');

api.interceptors.response.use(
  (res) => {
    clearRedirecting(); // reset on any success
    return res;
  },
  async (err) => {
    const config = err.config;

    // 401 — expired or invalid token
    if (err.response?.status === 401 && !getRedirecting()) {
      setRedirecting();
      localStorage.removeItem('atom_token');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    // Retry once on network errors or 5xx GET requests
    const shouldRetry =
      !config._retried &&
      (!err.response || err.response.status >= 500) &&
      config.method?.toLowerCase() === 'get';

    if (shouldRetry) {
      config._retried = true;
      await new Promise(r => setTimeout(r, 800));
      return api(config);
    }

    return Promise.reject(err);
  }
);

// Helper: safely extract gym list from any response shape
export const extractGyms = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.gyms)) return data.gyms;
  if (Array.isArray(data?.data?.gyms)) return data.data.gyms;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

// Helper: extract error message
export const getErrorMessage = (err, fallback = 'An error occurred') => {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
};

export default api;
