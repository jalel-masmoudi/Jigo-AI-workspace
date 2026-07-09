import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  BellRing,
  CheckCircle2,
  Database,
  FileBarChart,
  FileText,
  HardDrive,
  Mail,
  MessageSquare,
  Plug,
  Plus,
  Table2,
  Workflow,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { QuickActionTile, SectionLabel, StatTile } from "@/components/shared/Workspace";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChatStore } from "@/store/chatStore";
import { useDocumentStore } from "@/store/documentStore";
import { useReportStore } from "@/store/reportStore";
import { useIntegrationStore } from "@/store/integrationStore";
import { useReminderStore } from "@/store/reminderStore";
import { useNotificationStore } from "@/store/notificationStore";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - Jigo AI Workspace" }] }),
  component: DashboardPage,
});

const quickActions = [
  { title: "Ask AI", description: "Start a workspace chat", icon: MessageSquare, to: "/chat" },
  {
    title: "Connect apps",
    description: "Meet, Notion, Slack, Jira",
    icon: Plug,
    to: "/integrations",
  },
  {
    title: "View reminders",
    description: "Follow up on action items",
    icon: BellRing,
    to: "/reminders",
  },
  {
    title: "Upload Document",
    description: "Add files to process",
    icon: FileText,
    to: "/documents",
  },
  {
    title: "Generate Report",
    description: "Create an analysis",
    icon: FileBarChart,
    to: "/reports",
  },
  { title: "Analyze ERP Data", description: "Query live systems", icon: Database, to: "/erp" },
  { title: "Create Workflow", description: "Automate a process", icon: Workflow, to: "/workflows" },
  { title: "Generate Email", description: "Draft from context", icon: Mail, to: "/chat" },
  { title: "Generate SQL Query", description: "Ask in plain language", icon: Table2, to: "/erp" },
];

function DashboardPage() {
  const conversations = useChatStore((s) => s.conversations).slice(0, 5);
  const reports = useReportStore((s) => s.reports).slice(0, 5);
  const documents = useDocumentStore((s) => s.documents).slice(0, 5);
  const syncedDocs = useIntegrationStore((s) => s.documents);
  const connected = useIntegrationStore(
    (s) => s.connections.filter((c) => c.status === "connected" || c.status === "syncing").length,
  );
  const openReminders = useReminderStore((s) => s.reminders.filter((r) => !r.completed).length);
  const unread = useNotificationStore((s) => s.unreadCount());

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Home"
        description="Your productivity overview across chat, documents, ERP, and reports."
        actions={
          <Button asChild size="sm">
            <Link to="/chat">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Ask AI
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Conversations"
          value={String(conversations.length)}
          hint={conversations.length ? "Recent chats" : "Start a chat"}
          icon={Zap}
        />
        <StatTile
          label="Synced docs"
          value={String(syncedDocs.length + documents.length)}
          hint={connected ? `${connected} apps connected` : "Connect integrations"}
          icon={HardDrive}
        />
        <StatTile
          label="Open reminders"
          value={String(openReminders)}
          hint={unread ? `${unread} unread alerts` : "All caught up"}
          icon={BellRing}
        />
        <StatTile
          label="Integrations"
          value={`${connected}/4`}
          hint="Meet · Notion · Slack · Jira"
          icon={CheckCircle2}
        />
      </div>

      <div className="mt-8">
        <SectionLabel>Quick actions</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
            >
              <QuickActionTile {...a} />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent chats</CardTitle>
            <Link to="/chat" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-1 p-2 pt-0">
            {conversations.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No chats yet. Ask AI to get started.
              </p>
            ) : (
              conversations.map((c) => (
                <Link
                  key={c.id}
                  to="/chat"
                  className="flex flex-col rounded-lg px-3 py-2 hover:bg-muted transition-colors"
                >
                  <span className="truncate text-sm text-foreground">{c.title}</span>
                  <span className="text-[11px] text-muted-foreground">{c.updatedAt}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent documents</CardTitle>
            <Link to="/documents" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-1 p-2 pt-0">
            {documents.length === 0 && syncedDocs.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No documents yet. Upload files or sync integrations.
              </p>
            ) : (
              [
                ...documents,
                ...syncedDocs.map((d) => ({
                  id: d.id,
                  name: d.title,
                  type: d.provider,
                  size: "synced",
                  status: "processed" as const,
                })),
              ]
                .slice(0, 5)
                .map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm">{d.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {d.type} · {"size" in d ? d.size : "synced"}
                      </div>
                    </div>
                    <StatusBadge status={"status" in d ? d.status : "processed"} />
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent reports</CardTitle>
            <Link to="/reports" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-1 p-2 pt-0">
            {reports.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No reports yet.</p>
            ) : (
              reports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.type} · {r.createdAt}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
