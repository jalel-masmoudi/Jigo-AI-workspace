import { useRouterState, Link } from "@tanstack/react-router";
import { Bell, Building2, ChevronDown, Clock, Search } from "lucide-react";

import { NAV_ITEMS } from "@/constants/nav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useReminderStore } from "@/store/reminderStore";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { BrandMark } from "@/components/brand/BrandLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const user = useAuthStore((s) => s.user);
  const { items, markRead, markAllRead, unreadCount } = useNotificationStore();
  const openReminders = useReminderStore((s) => s.reminders.filter((r) => !r.completed).length);
  const current = NAV_ITEMS.find((i) => pathname === i.url || pathname.startsWith(i.url + "/"));
  const title = current?.title || "Workspace";
  const unread = unreadCount();

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="flex h-full items-center gap-3 px-4 md:px-6">
        <div className="flex items-center gap-2 md:hidden">
          <BrandMark className="h-7 w-7" />
        </div>

        <div className="min-w-0 hidden sm:block">
          <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1>
        </div>

        <div className="ml-2 flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search workspace…"
              className="h-9 pl-8 text-sm bg-background border-border shadow-none"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden lg:inline-flex h-8 gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {user?.name?.split(" ")[0] || "Workspace"}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Organization</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                {user?.email ? user.email.split("@")[1] || "My workspace" : "My workspace"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 relative"
            title="Reminders"
            asChild
          >
            <Link to="/reminders">
              <Clock className="h-4 w-4" />
              {openReminders > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                  {openReminders > 9 ? "9+" : openReminders}
                </span>
              )}
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                <button
                  className="text-xs font-normal text-primary hover:underline"
                  onClick={() => markAllRead()}
                >
                  Mark all read
                </button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {items.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No notifications
                </div>
              ) : (
                items.slice(0, 8).map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex flex-col items-start gap-0.5 py-2"
                    onClick={() => markRead(n.id)}
                    asChild={Boolean(n.href)}
                  >
                    {n.href ? (
                      <Link to={n.href}>
                        <span
                          className={`text-sm ${n.read ? "text-muted-foreground" : "font-medium"}`}
                        >
                          {n.title}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {n.description}
                        </span>
                      </Link>
                    ) : (
                      <>
                        <span
                          className={`text-sm ${n.read ? "text-muted-foreground" : "font-medium"}`}
                        >
                          {n.title}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {n.description}
                        </span>
                      </>
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />
          <Avatar className="h-8 w-8 ml-1 border border-border">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2) || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
