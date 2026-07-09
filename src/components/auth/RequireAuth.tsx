import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { useAuthStore } from "@/store/authStore";

/** Client-side gate for authenticated app routes. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, isLoading, waitUntilReady } = useAuthStore();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await waitUntilReady();
      if (cancelled) return;
      const current = useAuthStore.getState().user;
      if (!current) {
        void navigate({
          to: "/login",
          search: { redirect: pathname },
          replace: true,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [waitUntilReady, navigate, pathname, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading workspace…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Redirecting to sign in…</div>
      </div>
    );
  }

  return <>{children}</>;
}
