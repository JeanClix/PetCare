import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type AccountRole,
  loginAccount,
  registerAccount,
  verifyAccountSession,
  type AccountSession,
} from "@/lib/adminAuth";

export type AuthUser = {
  token: string;
  role: AccountRole;
  email: string;
  firstname: string;
  lastname: string;
  phone: string;
  expiresAt: number;
};

type StoredSession = AccountSession & { expiresAt: number };

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const SESSION_KEY = "petcare.account.session";
const AuthContext = createContext<AuthContextValue | null>(null);

function toUser(session: StoredSession): AuthUser {
  return {
    token: session.token,
    role: session.role,
    email: session.email,
    firstname: session.firstname,
    lastname: session.lastname,
    phone: session.phone,
    expiresAt: session.expiresAt,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) {
      setReady(true);
      return () => { active = false; };
    }

    void (async () => {
      try {
        const session = JSON.parse(stored) as StoredSession;
        if (!session.token || !session.email || session.expiresAt <= Date.now()) {
          throw new Error("La sesión venció.");
        }
        const verified = await verifyAccountSession(session.token, session.email);
        if (!active) return;
        const refreshed = { ...session, ...verified };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
        setUser(toUser(refreshed));
      } catch {
        if (active) {
          sessionStorage.removeItem(SESSION_KEY);
          setUser(null);
        }
      } finally {
        if (active) setReady(true);
      }
    })();

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    const remaining = Math.max(0, user.expiresAt - Date.now());
    const timeout = window.setTimeout(() => {
      sessionStorage.removeItem(SESSION_KEY);
      setUser(null);
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [user]);

  const saveSession = useCallback((session: AccountSession) => {
    const stored: StoredSession = { ...session, expiresAt: Date.now() + session.expiresIn * 1000 };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));
    const next = toUser(stored);
    setUser(next);
    return next;
  }, []);

  const login = useCallback(async (email: string, password: string) => saveSession(await loginAccount(email, password)), [saveSession]);
  const register = useCallback(async (name: string, email: string, password: string) =>
    saveSession(await registerAccount(name, email, password)), [saveSession]);
  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return context;
}
