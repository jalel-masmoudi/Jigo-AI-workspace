import { useEffect } from "react";

import { useAuthStore } from "@/store/authStore";

/** Boots auth once on the client. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return <>{children}</>;
}
