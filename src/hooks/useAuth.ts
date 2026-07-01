import { trpc } from "@/providers/trpc";
import { useCallback, useMemo, useState, useEffect } from "react";

export type UnifiedUser = {
  id: number;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  role: "user" | "admin";
  authType: "oauth" | "local";
};

export function useAuth() {
  const utils = trpc.useUtils();
  const [timedOut, setTimedOut] = useState(false);

  const {
    data: oauthUser,
    isLoading: oauthLoading,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: !timedOut,
  });

  const {
    data: localUser,
    isLoading: localLoading,
  } = trpc.localAuth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: !timedOut,
  });

  // Timeout after 5 seconds to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (oauthLoading || localLoading) {
        setTimedOut(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [oauthLoading, localLoading]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      window.location.reload();
    },
  });

  const localLogoutMutation = trpc.localAuth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      window.location.reload();
    },
  });

  const logout = useCallback(() => {
    if (oauthUser) {
      logoutMutation.mutate();
    } else if (localUser) {
      localLogoutMutation.mutate();
    } else {
      logoutMutation.mutate();
    }
  }, [oauthUser, localUser, logoutMutation, localLogoutMutation]);

  const user: UnifiedUser | null = useMemo(() => {
    if (oauthUser) {
      return {
        id: oauthUser.id,
        name: oauthUser.name,
        email: oauthUser.email,
        avatar: oauthUser.avatar,
        role: oauthUser.role as "user" | "admin",
        authType: "oauth" as const,
      };
    }
    if (localUser) {
      return {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        role: localUser.role as "user" | "admin",
        authType: "local" as const,
      };
    }
    return null;
  }, [oauthUser, localUser]);

  const isLoading = !timedOut && (oauthLoading || localLoading);
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";

  return {
    user,
    isAuthenticated,
    isLoading,
    isAdmin,
    logout,
  };
}
