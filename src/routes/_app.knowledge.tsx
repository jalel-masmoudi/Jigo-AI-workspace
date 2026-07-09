import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Folder, FileText, Search, Upload, Tag } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useIntegrationStore } from "@/store/integrationStore";
import { useDocumentStore } from "@/store/documentStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/knowledge")({
  head: () => ({ meta: [{ title: "Knowledge Base - Jigo AI Workspace" }] }),
  component: KnowledgePage,
});

const FOLDERS = ["All", "Uploads", "Integrations"];

function KnowledgePage() {
  const integrationDocs = useIntegrationStore((s) => s.documents);
  const uploaded = useDocumentStore((s) => s.documents);
  const [folder, setFolder] = useState("All");
  const [query, setQuery] = useState("");

  const synced = integrationDocs.map((d) => ({
    id: d.id,
    name: d.title,
    type: d.provider.toUpperCase(),
    updated: new Date(d.extractedAt).toLocaleDateString(),
    tags: d.tags || [d.provider],
    folder: "Integrations",
    summary: d.summary || "",
  }));

  const uploads = uploaded.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    updated: d.uploadedAt,
    tags: d.source ? [d.source] : ["Upload"],
    folder: "Uploads",
    summary: d.summary || "",
  }));

  const allFiles = [...synced, ...uploads];
  const filtered = allFiles.filter((f) => {
    const inFolder = folder === "All" || f.folder === folder;
    const q = query.toLowerCase();
    const match =
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.tags.some((t) => t.toLowerCase().includes(q)) ||
      f.summary.toLowerCase().includes(q);
    return inFolder && match;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Knowledge Base"
        description="Documents you upload plus content synced from Meet, Notion, Slack, and Jira."
        actions={
          <Button size="sm" asChild>
            <Link to="/documents">
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit">
          <CardContent className="p-3 space-y-1">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Folders
            </p>
            {FOLDERS.map((f) => (
              <button
                key={f}
                onClick={() => setFolder(f)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  folder === f
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Folder className="h-4 w-4" />
                {f}
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search knowledge…"
              className="pl-8"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No knowledge yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload documents or{" "}
                <Link to="/integrations" className="text-primary hover:underline">
                  sync integrations
                </Link>{" "}
                to import Meet, Notion, Slack, and Jira content.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((f) => (
                <Card key={f.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{f.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {f.type} · Updated {f.updated}
                        </div>
                        {f.summary && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            {f.summary}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {f.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                              <Tag className="mr-1 h-2.5 w-2.5" />
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
