import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { NAV_ITEMS, NAV_SECTIONS } from "@/constants/nav";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AppSidebar() {
  const navigate = useNavigate();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const handleLogout = async () => {
    await logout();
    void navigate({ to: "/login", replace: true });
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden md:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[64px]" : "w-[240px]",
      )}
    >
      <div className="flex h-14 items-center px-3 border-b border-sidebar-border">
        <BrandLogo collapsed={collapsed} markClassName="h-7 w-7" />
      </div>

      <ScrollArea className="flex-1">
        <nav className="py-3 px-2 space-y-4">
          {NAV_SECTIONS.map((section) => {
            const items = NAV_ITEMS.filter((i) => i.section === section.id);
            if (!items.length) return null;
            return (
              <div key={section.id}>
                {section.label && !collapsed && (
                  <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = pathname === item.url || pathname.startsWith(item.url + "/");
                    const Icon = item.icon;
                    return (
                      <li key={item.url}>
                        <Link
                          to={item.url}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/80 hover:bg-muted hover:text-foreground",
                            collapsed && "justify-center px-2",
                          )}
                          title={collapsed ? item.title : undefined}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              active ? "text-primary" : "text-muted-foreground",
                            )}
                          />
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-2 space-y-1">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-2",
            !collapsed && "hover:bg-muted",
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2) || "U"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user?.name || "Guest"}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {user?.email || "Sign in"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Sign out"
                onClick={() => void handleLogout()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        <button
          onClick={toggle}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <>
              <PanelLeftClose className="h-3.5 w-3.5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
