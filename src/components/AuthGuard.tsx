import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

function LoadingScreen() {
  console.log('[RENDER] LoadingScreen');
  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
    </div>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  console.log(`[AuthGuard] isLoading=${isLoading}, user=${user ? 'yes' : 'no'}, path=${location.pathname}`);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    console.log('[AuthGuard] Redirecting to login');
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  console.log('[AuthGuard] Rendering children');
  return <>{children}</>;
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
