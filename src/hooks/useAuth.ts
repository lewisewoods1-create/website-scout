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

  const checkAuth = useCallback(async () => {
    console.log("[Auth] checkAuth starting...");
    setIsLoading(true);

    // Try local auth first
    console.log("[Auth] Trying localAuth.me...");
    const local = await apiGet<{
      id: number; name?: string; email?: string; role: string;
    }>("localAuth.me");
    console.log("[Auth] localAuth.me result:", local);

    if (local) {
      console.log("[Auth] Local user found:", local.email);
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
    console.log("[Auth] Trying auth.me...");
    const oauth = await apiGet<{
      id: number; name?: string; email?: string; avatar?: string; role: string;
    }>("auth.me");
    console.log("[Auth] auth.me result:", oauth);

    if (oauth) {
      console.log("[Auth] OAuth user found:", oauth.email);
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

    console.log("[Auth] No user logged in");
    setUser(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    console.log("[Auth] Mount effect running");
    checkAuth();
  }, [checkAuth]);

  // Re-check auth when window gains focus
  useEffect(() => {
    const onFocus = () => {
      console.log("[Auth] Window focus, re-checking...");
      checkAuth();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
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

  console.log(`[Auth] Render: isLoading=${isLoading}, user=${user ? user.email : 'null'}`);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    isAdmin: user?.role === "admin",
    logout,
    refresh: checkAuth,
  };
}
