import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Fetch current user profile on mount if token exists
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const { data } = await api.get('/auth/me');
          if (data.success) setUser(data.user);
        } catch {
          localStorage.removeItem('token');
          setToken(null);
          delete api.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  const login = useCallback((userData, authToken) => {
    localStorage.setItem('token', authToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    setToken(authToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const isCitizen = user?.role === 'citizen';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isCitizen }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
