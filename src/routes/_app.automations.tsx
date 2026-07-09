import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({ meta: [{ title: "Automations - Jigo AI Workspace" }] }),
  component: AutomationsPage,
});

function AutomationsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Automations"
        description="Event-driven automations across ERP, email, and documents."
        actions={
          <Button size="sm" disabled title="Automation builder coming soon">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create automation
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>No automations yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Automations you create will show up here with run history. Connect integrations first to
            unlock triggers from Meet, Notion, Slack, and Jira.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
