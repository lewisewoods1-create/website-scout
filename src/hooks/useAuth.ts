import { useCallback, useState, useEffect } from "react";

export type UnifiedUser = {
  id: number;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  role: "user" | "admin";
  authType: "oauth" | "local";
};

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/trpc/${path}`, {
      method: "GET",
      credentials: "include",
    });
    if (res.status === 401) return null;
    if (!res.ok) {
      console.warn(`[Auth] ${path} failed:`, res.status);
      return null;
    }
    const data = await res.json();
    const result = data.result?.data?.json ?? data[0]?.result?.data?.json ?? null;
    return result;
  } catch (err) {
    console.warn(`[Auth] ${path} error:`, err);
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checked, setChecked] = useState(false);

  const checkAuth = useCallback(async () => {
    setIsLoading(true);

    // Try local auth first
    const local = await apiGet<{
      id: number; name?: string; email?: string; role: string;
    }>("localAuth.me");

    if (local) {
      setUser({
        id: local.id,
        name: local.name,
        email: local.email,
        role: local.role as "user" | "admin",
        authType: "local",
      });
      setIsLoading(false);
      setChecked(true);
      return;
    }

    // Try OAuth
    const oauth = await apiGet<{
      id: number; name?: string; email?: string; avatar?: string; role: string;
    }>("auth.me");

    if (oauth) {
      setUser({
        id: oauth.id,
        name: oauth.name,
        email: oauth.email,
        avatar: oauth.avatar,
        role: oauth.role as "user" | "admin",
        authType: "oauth",
      });
      setIsLoading(false);
      setChecked(true);
      return;
    }

    setUser(null);
    setIsLoading(false);
    setChecked(true);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await fetch("/api/trpc/localAuth.logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    }).catch(() => {});
    await fetch("/api/trpc/auth.logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    }).catch(() => {});
    setUser(null);
    window.location.href = "/login";
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading: isLoading && !checked,
    isAdmin: user?.role === "admin",
    logout,
    refresh: checkAuth,
  };
}
