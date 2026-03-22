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
    const token = localStorage.getItem('atom_token');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;

    // Bust cache on every GET request
    if (!config.method || config.method.toLowerCase() === 'get') {
      config.params = { ...(config.params || {}), _t: Date.now() };
    }

    config.headers['Cache-Control'] = 'no-cache, no-store';
    config.headers['Pragma'] = 'no-cache';

    return config;
  },
  (err) => Promise.reject(err)
);

// ── Response interceptor ───────────────────────────────────────
// Unwrap { success: true, data: X } → X
// Skip unwrap for login (returns { success, token, user })
const SKIP_UNWRAP = ['/auth/login', '/auth/me'];

const getRedirecting = () => sessionStorage.getItem('__atom_redir') === '1';
const setRedirecting = () => sessionStorage.setItem('__atom_redir', '1');
const clearRedirecting = () => sessionStorage.removeItem('__atom_redir');

api.interceptors.response.use(
  (res) => {
    clearRedirecting();

    // Unwrap { success, data } envelope for all non-auth endpoints
    const url = res.config?.url || '';
    const skip = SKIP_UNWRAP.some(path => url.includes(path));

    if (
      !skip &&
      res.data &&
      typeof res.data === 'object' &&
      'success' in res.data &&
      'data' in res.data
    ) {
      res.data = res.data.data;
    }

    return res;
  },
  async (err) => {
    const config = err.config;

    if (err.response?.status === 401 && !getRedirecting()) {
      setRedirecting();
      localStorage.removeItem('atom_token');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    // Retry once on 5xx or network error (GET only)
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

export const extractGyms = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.gyms)) return data.gyms;
  if (Array.isArray(data?.data?.gyms)) return data.data.gyms;
  return [];
};

export const getErrorMessage = (err, fallback = 'An error occurred') => {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
};

export default api;
