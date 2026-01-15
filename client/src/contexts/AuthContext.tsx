import React, { createContext, useContext, useState, ReactNode } from 'react';

type User = { username?: string; role?: string } | null;

type AuthContextValue = {
  user: User;
  login: (user: User) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);

  const login = async (u: User) => {
    // Minimal placeholder — replace with real auth (API call / token storage) as needed.
    setUser(u);
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
