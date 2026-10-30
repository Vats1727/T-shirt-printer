import React, { createContext, useContext, useState } from 'react';
import * as authService from '@/services/auth';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const loginWithCredentials = async (email, password) => {
    const res = await authService.login(email, password);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    return res;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateUser = (data) => {
    setUser((prev) => {
      const newUser = prev ? { ...prev, ...data } : null;
      if (newUser) localStorage.setItem('user', JSON.stringify(newUser));
      return newUser;
    });
  };

  React.useEffect(() => {
    if (!token || !user || !['designer', 'supplier'].includes(user.role)) return;
    (async () => {
      try {
        const res = await fetch('/api/supplier/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const profile = await res.json();
          if (profile && profile.id) {
            updateUser({
              associated_provider_id: profile.associated_provider_id,
              name: profile.name || undefined,
              email: profile.email || undefined
            });
          }
        }
      } catch (e) {
        // ignore background refresh errors
      }
    })();
  }, [token, user?.role]);

  return (
    <AuthContext.Provider value={{ user, token, loginWithCredentials, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
