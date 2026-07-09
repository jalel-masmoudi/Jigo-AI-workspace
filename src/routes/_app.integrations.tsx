import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Link2, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIntegrationStore } from "@/store/integrationStore";
import { useReminderStore } from "@/store/reminderStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useDocumentStore } from "@/store/documentStore";
import { INTEGRATION_CATALOG } from "@/lib/integrations/registry";
import type { ExtractedDocument, IntegrationProviderId, Reminder } from "@/types/integrations";
import type { IntegrationCredentials } from "@/lib/integrations/types";

export const Route = createFileRoute("/_app/integrations")({
  head: () => ({ meta: [{ title: "Integrations - Jigo AI Workspace" }] }),
  component: IntegrationsPage,
});

type ProviderStatus = {
  id: IntegrationProviderId;
  name: string;
  description: string;
  configured: boolean;
  authType: "oauth" | "api_key";
  envHint: string;
  supportsOAuth: boolean;
};

async function syncWithAi(provider: IntegrationProviderId, credentials?: IntegrationCredentials) {
  const res = await fetch("/api/integrations/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, credentials }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Sync failed");
  return data as {
    items: Array<{
      document: {
        id: string;
        title: string;
        content: string;
        summary?: string;
        actionItems?: string[];
        tags?: string[];
        provider: IntegrationProviderId;
        author?: string;
        extractedAt?: string;
      };
      reminders: Reminder[];
    }>;
  };
}

function IntegrationsPage() {
  const search = useRouterState({ select: (r) => r.location.search as Record<string, string> });
  const {
    connections,
    documents,
    jobs,
    setCredentials,
    connectLocal,
    disconnect,
    setStatus,
    markSynced,
    upsertDocuments,
    updateDocument,
    addJob,
    updateJob,
    getCredentials,
  } = useIntegrationStore();
  const addMany = useReminderStore((s) => s.addMany);
  const addNotification = useNotificationStore((s) => s.add);
  const addDocument = useDocumentStore((s) => s.add);

  const [busy, setBusy] = useState<IntegrationProviderId | null>(null);
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [connectId, setConnectId] = useState<IntegrationProviderId | null>(null);
  const [form, setForm] = useState({ apiKey: "", email: "", baseUrl: "" });

  useEffect(() => {
    void fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((d) => setStatuses(d.providers || []))
      .catch(() => setStatuses([]));
  }, []);

  // Handle OAuth redirect payload
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (oauth === "success") {
      try {
        const payload = JSON.parse(decodeURIComponent(params.get("payload") || "{}")) as {
          provider: IntegrationProviderId;
          credentials: IntegrationCredentials;
          accountLabel?: string;
        };
        if (payload.provider && payload.credentials) {
          setCredentials(payload.provider, payload.credentials, payload.accountLabel);
          toast.success(`${payload.accountLabel || payload.provider} connected`);
        }
      } catch {
        toast.error("Could not save OAuth credentials");
      }
      window.history.replaceState({}, "", "/integrations");
    } else if (oauth === "error") {
      toast.error(params.get("message") || "OAuth failed");
      window.history.replaceState({}, "", "/integrations");
    }
  }, [search, setCredentials]);

  const statusFor = (id: IntegrationProviderId) =>
    statuses.find((s) => s.id === id) || INTEGRATION_CATALOG.find((c) => c.id === id)!;

  const startConnect = (id: IntegrationProviderId) => {
    const meta = statusFor(id);
    if (meta.authType === "oauth" || ("supportsOAuth" in meta && meta.supportsOAuth)) {
      void startOAuth(id);
      return;
    }
    setForm({ apiKey: "", email: "", baseUrl: "" });
    setConnectId(id);
  };

  const startOAuth = async (id: IntegrationProviderId) => {
    setBusy(id);
    try {
      const redirectUri = `${window.location.origin}/api/integrations/oauth/callback`;
      const res = await fetch("/api/integrations/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id, redirectUri }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authorize failed");
      window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "OAuth start failed");
      setBusy(null);
    }
  };

  const saveApiKeyConnect = () => {
    if (!connectId) return;
    const creds: IntegrationCredentials = {};
    if (form.apiKey) creds.apiKey = form.apiKey;
    if (form.email) creds.email = form.email;
    if (form.baseUrl) creds.baseUrl = form.baseUrl;

    const meta = statusFor(connectId);
    // Server env may already hold keys — allow connect without pasting
    if (!form.apiKey && !("configured" in meta && meta.configured)) {
      toast.error(`Enter credentials or set ${meta.envHint} on the server.`);
      return;
    }

    if (Object.keys(creds).length > 0) {
      setCredentials(connectId, creds, meta.name);
    } else {
      connectLocal(connectId, `${meta.name} (server env)`);
    }
    setConnectId(null);
    toast.success(`${meta.name} connected`);
  };

  const runSync = async (id: IntegrationProviderId) => {
    setBusy(id);
    setStatus(id, "syncing");
    const jobId = `job_${Date.now()}`;
    addJob({
      id: jobId,
      provider: id,
      status: "running",
      startedAt: new Date().toISOString(),
      docsImported: 0,
      remindersCreated: 0,
    });
    try {
      const credentials = getCredentials(id);
      const data = await syncWithAi(id, credentials);
      const docs = data.items.map((i) => i.document);
      upsertDocuments(
        docs.map((d): ExtractedDocument => ({
          id: d.id,
          provider: d.provider,
          externalId: d.id,
          title: d.title,
          content: d.content,
          summary: d.summary,
          actionItems: d.actionItems,
          tags: d.tags,
          author: d.author,
          extractedAt: d.extractedAt || new Date().toISOString(),
        })),
      );
      const reminders = data.items.flatMap((i) => i.reminders);
      addMany(reminders);
      for (const d of docs) {
        addDocument({
          id: `doc_${d.id}`,
          name: d.title,
          type: d.provider,
          size: `${Math.max(1, Math.round(d.content.length / 1024))} KB`,
          uploadedAt: "just now",
          status: "processed",
          summary: d.summary,
          source: d.provider,
        });
        if (d.summary) {
          updateDocument(d.id, { summary: d.summary, actionItems: d.actionItems });
        }
      }
      markSynced(id);
      updateJob(jobId, {
        status: "completed",
        finishedAt: new Date().toISOString(),
        docsImported: docs.length,
        remindersCreated: reminders.length,
      });
      addNotification({
        id: `n_${Date.now()}`,
        title: `Synced ${id}`,
        description: `Imported ${docs.length} documents and created ${reminders.length} reminders.`,
        createdAt: new Date().toISOString(),
        read: false,
        href: "/reminders",
      });
      toast.success(`Imported ${docs.length} documents`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      setStatus(id, "error", message);
      updateJob(jobId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: message,
      });
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const connectMeta = connectId ? statusFor(connectId) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Integrations"
        description="Connect live Google Meet, Notion, Slack, and Jira accounts. Sync pulls real content, AI summarizes it, and reminders are created from action items."
      />

      <Card className="mb-6 border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Configure server env vars ({INTEGRATION_CATALOG.map((c) => c.envHint).join(" · ")}), then
          Connect and Sync. Google Meet uses OAuth; Notion, Slack, and Jira use API tokens (paste
          here or set on the server).
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {connections.map((c) => {
          const meta = statusFor(c.id);
          const configured = "configured" in meta ? meta.configured : false;
          return (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Plug className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{c.name}</h3>
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        c.status === "connected"
                          ? "bg-success/10 text-success border-success/20"
                          : c.status === "syncing"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : c.status === "error"
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : ""
                      }
                    >
                      {c.status}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {configured ? "Server ready" : "Needs env / token"}
                    </Badge>
                    {c.accountLabel && (
                      <span className="text-xs text-muted-foreground">{c.accountLabel}</span>
                    )}
                    {c.lastSyncedAt && (
                      <span className="text-xs text-muted-foreground">
                        Last sync {new Date(c.lastSyncedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {c.error && <p className="mt-2 text-xs text-destructive">{c.error}</p>}
                  <p className="mt-2 text-[11px] text-muted-foreground">{meta.envHint}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {c.status === "disconnected" || c.status === "error" ? (
                    <Button size="sm" disabled={busy === c.id} onClick={() => startConnect(c.id)}>
                      {busy === c.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Link2 className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Connect
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === c.id || c.status === "syncing"}
                        onClick={() => void runSync(c.id)}
                      >
                        {busy === c.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Sync & summarize
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => disconnect(c.id)}>
                        <Unplug className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Imported documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Connect a source and run Sync to import real transcripts, pages, threads, and
                issues.
              </p>
            ) : (
              documents.slice(0, 12).map((d) => (
                <div key={d.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{d.title}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">
                        {d.provider}
                        {d.author ? ` · ${d.author}` : ""}
                      </div>
                    </div>
                    {d.summary && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
                  </div>
                  {d.summary && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{d.summary}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent sync jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sync jobs yet.</p>
            ) : (
              jobs.slice(0, 10).map((j) => (
                <div
                  key={j.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium capitalize">{j.provider}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {j.docsImported} docs · {new Date(j.startedAt).toLocaleString()}
                      {j.error ? ` · ${j.error}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline">{j.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(connectId)} onOpenChange={(o) => !o && setConnectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {connectMeta?.name}</DialogTitle>
            <DialogDescription>
              Paste credentials below, or leave blank if {connectMeta?.envHint} is already set on
              the server.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {connectId === "jira" && (
              <>
                <div className="grid gap-2">
                  <Label>Jira site URL</Label>
                  <Input
                    value={form.baseUrl}
                    onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                    placeholder="https://your-domain.atlassian.net"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@company.com"
                  />
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label>
                {connectId === "notion"
                  ? "Notion integration token"
                  : connectId === "slack"
                    ? "Slack bot token"
                    : "API token"}
              </Label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={
                  connectId === "notion"
                    ? "secret_…"
                    : connectId === "slack"
                      ? "xoxb-…"
                      : "Atlassian API token"
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectId(null)}>
              Cancel
            </Button>
            <Button onClick={saveApiKeyConnect}>Connect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
