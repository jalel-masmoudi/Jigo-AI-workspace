import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BellRing, Check, Clock, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useReminderStore } from "@/store/reminderStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reminders")({
  head: () => ({ meta: [{ title: "Reminders - Jigo AI Workspace" }] }),
  component: RemindersPage,
});

function RemindersPage() {
  const { reminders, complete, remove, snooze } = useReminderStore();
  const [showDone, setShowDone] = useState(false);

  const visible = useMemo(
    () =>
      reminders
        .filter((r) => (showDone ? true : !r.completed))
        .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)),
    [reminders, showDone],
  );

  const openCount = reminders.filter((r) => !r.completed).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Reminders"
        description="Action items extracted from Meet, Notion, Slack, and Jira — prioritized for follow-up."
        actions={
          <Button size="sm" variant="outline" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide completed" : `Show completed`}
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <BellRing className="h-4 w-4" />
        {openCount} open reminder{openCount === 1 ? "" : "s"}
      </div>

      <div className="space-y-2">
        {visible.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No reminders yet. Sync an integration to extract action items automatically.
            </CardContent>
          </Card>
        ) : (
          visible.map((r) => (
            <Card key={r.id} className={cn(r.completed && "opacity-60")}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={cn("text-sm font-medium", r.completed && "line-through")}>
                      {r.title}
                    </h3>
                    <Badge
                      variant="outline"
                      className={
                        r.priority === "high"
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : r.priority === "low"
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary border-primary/20"
                      }
                    >
                      {r.priority}
                    </Badge>
                    {r.sourceProvider && (
                      <Badge variant="secondary" className="capitalize">
                        {r.sourceProvider}
                      </Badge>
                    )}
                  </div>
                  {r.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {r.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Due {new Date(r.dueAt).toLocaleString()}
                    {r.sourceLabel ? ` · from ${r.sourceLabel}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!r.completed && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => complete(r.id)}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Done
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          snooze(r.id, d.toISOString());
                        }}
                      >
                        +1 day
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => remove(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
