import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background text-foreground">
        <AppSidebar />
        <div
          className={cn(
            "flex min-h-screen flex-col transition-[padding] duration-200",
            collapsed ? "md:pl-[64px]" : "md:pl-[240px]",
          )}
        >
          <AppHeader />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}
