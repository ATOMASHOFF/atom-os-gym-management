import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { getErrorMessage } from '../utils/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem('atom_token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('atom_token');
    setToken(null);
    setUser(null);
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      // Handle both { success, data: user } and direct user object
      const userData = res.data?.data || res.data;
      setUser(userData);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (token) fetchMe();
    else setLoading(false);
  }, [token, fetchMe]);

  const login = async (email, password, gym_id) => {
    const res = await api.post('/auth/login', {
      email,
      password,
      ...(gym_id ? { gym_id } : {}),
    });

    // Backend returns: { success: true, token: "...", user: {...} }
    const { token: tok, user: usr } = res.data;

    if (!tok) throw new Error('No token received from server');

    localStorage.setItem('atom_token', tok);
    setToken(tok);
    setUser(usr);
    return usr;
  };

  const refreshUser = useCallback(() => fetchMe(), [fetchMe]);

  const can = (permission) => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    return user.permissions?.[permission] === true;
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, logout, refreshUser, can,
      isSuperAdmin: user?.role === 'super_admin',
      isAdmin:      user?.role === 'admin',
      isStaff:      user?.role === 'staff',
      isMember:     user?.role === 'member',
    }}>
      {children}
    </AuthContext.Provider>
  );
};
