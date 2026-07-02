import { useCallback, useState, useEffect } from "react";

export type UnifiedUser = {
  id: number;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  role: "user" | "admin";
  authType: "oauth" | "local";
};

async function apiCall<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/trpc/${path}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result?.data?.json ?? data[0]?.result?.data?.json ?? data ?? null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      // Try local auth first
      const local = await apiCall<{
        id: number; name?: string; email?: string; role: string;
      }>("localAuth.me");
      if (local && !cancelled) {
        setUser({
          id: local.id,
          name: local.name,
          email: local.email,
          role: local.role as "user" | "admin",
          authType: "local",
        });
        setIsLoading(false);
        return;
      }
      // Try OAuth
      const oauth = await apiCall<{
        id: number; name?: string; email?: string; avatar?: string; role: string;
      }>("auth.me");
      if (oauth && !cancelled) {
        setUser({
          id: oauth.id,
          name: oauth.name,
          email: oauth.email,
          avatar: oauth.avatar,
          role: oauth.role as "user" | "admin",
          authType: "oauth",
        });
        setIsLoading(false);
        return;
      }
      if (!cancelled) {
        setUser(null);
        setIsLoading(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/trpc/auth.logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    }).catch(() => {});
    await fetch("/api/trpc/localAuth.logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    }).catch(() => {});
    window.location.reload();
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    isAdmin: user?.role === "admin",
    logout,
  };
}
