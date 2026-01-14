import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { login as apiLogin } from '@/services/auth';

type User = { id: number; username: string; role: string } | null;

interface AuthContextValue {
  user: User;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(() => {
    try {
      const raw = localStorage.getItem('auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) localStorage.setItem('auth_user', JSON.stringify(user));
    else localStorage.removeItem('auth_user');
  }, [user]);

  useEffect(() => {
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  }, [token]);

  async function login(username: string, password: string) {
    const res = await apiLogin(username, password);
    setToken(res.token);
    setUser(res.user);
    setLocation('/');
  }

  function logout() {
    setToken(null);
    setUser(null);
    setLocation('/login');
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
