import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  FileText,
  FileBarChart,
  Database,
  Zap,
  GitBranch,
  Users,
  Settings,
  Plug,
  BellRing,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { title: string; url: string; icon: LucideIcon; section?: string };

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, section: "main" },
  { title: "AI Chat", url: "/chat", icon: MessageSquare, section: "main" },
  { title: "Reminders", url: "/reminders", icon: BellRing, section: "main" },
  { title: "Knowledge Base", url: "/knowledge", icon: BookOpen, section: "work" },
  { title: "Documents", url: "/documents", icon: FileText, section: "work" },
  { title: "Reports", url: "/reports", icon: FileBarChart, section: "work" },
  { title: "Integrations", url: "/integrations", icon: Plug, section: "systems" },
  { title: "ERP Data", url: "/erp", icon: Database, section: "systems" },
  { title: "Automations", url: "/automations", icon: Zap, section: "systems" },
  { title: "Workflows", url: "/workflows", icon: GitBranch, section: "systems" },
  { title: "Team", url: "/team", icon: Users, section: "org" },
  { title: "Settings", url: "/settings", icon: Settings, section: "org" },
];

export const NAV_SECTIONS: { id: string; label?: string }[] = [
  { id: "main" },
  { id: "work", label: "Work" },
  { id: "systems", label: "Systems" },
  { id: "org", label: "Organization" },
];
