"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/types";

interface AuthApi {
  user: PublicUser | null;
  loading: boolean;
  refresh: () => Promise<PublicUser | null>;
  login: (email: string, password: string) => Promise<PublicUser>;
  guest: () => Promise<PublicUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

async function readMe() {
  const response = await fetch("/api/auth/me", { cache: "no-store" });
  const data = (await response.json()) as { user?: PublicUser | null };
  return data.user ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    const next = await readMe();
    setUser(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json()) as { user?: PublicUser; error?: string };
    if (!response.ok || !data.user) throw new Error(data.error || "Не войти");
    setUser(data.user);
    return data.user;
  }, []);

  const guest = useCallback(async () => {
    const response = await fetch("/api/auth/guest", { method: "POST" });
    const data = (await response.json()) as { user?: PublicUser; error?: string };
    if (!response.ok || !data.user) throw new Error(data.error || "Не войти гостем");
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.replace("/login");
  }, [router]);

  const open = pathname.startsWith("/login") || pathname.startsWith("/register");

  const value = useMemo(
    () => ({ user, loading, refresh, login, guest, logout }),
    [user, loading, refresh, login, guest, logout],
  );

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Проверяю сессию…</p>;
  }
  if (!user && !open) {
    if (typeof window !== "undefined") router.replace("/login");
    return <p className="p-6 text-sm text-muted-foreground">Нужен вход…</p>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
