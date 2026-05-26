import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface User {
  user_id: string;
  username: string;
  role: 'user' | 'admin';
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  isGuest: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email: string, phone: string) => Promise<void>;
  logout: () => void;
  enterGuest: () => void;
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const applyToken = useCallback((t: string, u: User) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    setIsGuest(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setIsGuest(false);
  }, []);

  const enterGuest = useCallback(() => {
    setIsGuest(true);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setLoading(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${saved}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: User) => { setToken(saved); setUser(d); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '로그인 실패');
    applyToken(data.token, { user_id: data.user_id, username: data.username, role: data.role ?? 'user' });
  }, [applyToken]);

  const register = useCallback(async (username: string, password: string, email: string, phone: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email, phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '가입 실패');
    applyToken(data.token, { user_id: data.user_id, username: data.username, role: data.role ?? 'user' });
  }, [applyToken]);

  const authFetch = useCallback((input: RequestInfo, init: RequestInit = {}) => {
    const t = localStorage.getItem(TOKEN_KEY);
    const headers = new Headers(init.headers);
    if (t) headers.set('Authorization', `Bearer ${t}`);
    return fetch(input, { ...init, headers });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, isGuest, login, register, logout, enterGuest, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
