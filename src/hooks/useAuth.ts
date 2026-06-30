import { trpc } from "@/providers/trpc";
import { useCallback, useMemo } from "react";

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

  const {
    data: oauthUser,
    isLoading: oauthLoading,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const {
    data: localUser,
    isLoading: localLoading,
  } = trpc.localAuth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

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

  const isLoading = oauthLoading || localLoading;
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
