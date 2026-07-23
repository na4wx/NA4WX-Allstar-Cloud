import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { apiFetch, registerAuthFailureHandler, setAccessToken } from "../api/client";

interface AuthState {
  email: string | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    registerAuthFailureHandler(() => {
      setAccessToken(null);
      setEmail(null);
    });

    // Silent refresh on first load: the access token only ever lives in
    // memory (see api/client.ts), so a page reload always starts here
    // -- if the httpOnly refresh cookie is still valid, this restores
    // the session without the operator re-entering a password.
    (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { accessToken: string };
          setAccessToken(data.accessToken);
          const me = await apiFetch<{ email: string }>("/api/auth/me");
          setEmail(me.email);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (loginEmail: string, password: string) => {
    const data = await apiFetch<{ accessToken: string; email: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: loginEmail, password }),
    });
    setAccessToken(data.accessToken);
    setEmail(data.email);
  };

  const register = async (registerEmail: string, password: string) => {
    const data = await apiFetch<{ accessToken: string; email: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: registerEmail, password }),
    });
    setAccessToken(data.accessToken);
    setEmail(data.email);
  };

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setAccessToken(null);
    setEmail(null);
  };

  return <AuthContext.Provider value={{ email, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
