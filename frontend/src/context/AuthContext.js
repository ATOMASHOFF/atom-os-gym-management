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
      setUser(res.data);
    } catch { logout(); }
    finally { setLoading(false); }
  }, [logout]);

  useEffect(() => {
    if (token) fetchMe();
    else setLoading(false);
  }, [token, fetchMe]);

  const login = async (email, password, gym_id) => {
    const res = await api.post('/auth/login', { email, password, gym_id });
    const { token: tok, user: usr } = res.data;
    localStorage.setItem('atom_token', tok);
    setToken(tok);
    setUser(usr);
    return usr;
  };

  const refreshUser = () => fetchMe();

  const can = (permission) => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    return user.permissions?.[permission] === true;
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin      = user?.role === 'admin';
  const isStaff      = user?.role === 'staff';
  const isMember     = user?.role === 'member';

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, logout, refreshUser, can,
      isSuperAdmin, isAdmin, isStaff, isMember,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
