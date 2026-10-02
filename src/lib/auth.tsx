import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { api, authSchema, type AuthUser } from './api';
import { useQueryClient } from '@tanstack/react-query';

type AuthContextValue = { user: AuthUser | null; ready: boolean; login: (phone: string, password: string) => Promise<AuthUser>; logout: () => void };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(() => {
    try { const stored = sessionStorage.getItem('poshanscan_user'); if (stored && localStorage.getItem('poshanscan_token')) setUser(authSchema.parse(JSON.parse(stored))); } catch { sessionStorage.removeItem('poshanscan_user'); }
    setReady(true);
  }, []);
  async function login(phone: string, password: string) {
    const { data } = await api.post('/auth/login', { phone, password });
    const next = authSchema.parse(data);
    localStorage.setItem('poshanscan_token', next.access_token);
    sessionStorage.setItem('poshanscan_user', JSON.stringify(next));
    setUser(next);
    return next;
  }
  function logout() {
    queryClient.cancelQueries().then(() => queryClient.clear());
    localStorage.removeItem('poshanscan_token'); sessionStorage.removeItem('poshanscan_user'); setUser(null);
    navigate({ to: "/login", search: { role: "worker" }, replace: true });
  }
  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('AuthProvider missing'); return context; }
