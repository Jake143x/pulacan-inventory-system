import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, User } from '../api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState & {
  login: (email: string, password: string) => Promise<{ user: User | null; mustChangePassword?: boolean }>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem('token');
    if (!t) { setUser(null); setLoading(false); return; }
    const AUTH_TIMEOUT_MS = 10000;
    try {
      const u = await Promise.race([
        auth.me(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Auth check timed out')), AUTH_TIMEOUT_MS)
        ),
      ]);
      setUser(u);
      setToken(t);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<{ user: User | null; mustChangePassword?: boolean }> => {
    const data = await auth.login(email, password);
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return { user: data.user, mustChangePassword: data.mustChangePassword };
  };

  const register = async (email: string, password: string, fullName: string) => {
    const { token: t, user: u } = await auth.register(email, password, fullName);
    localStorage.setItem('token', t);
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
