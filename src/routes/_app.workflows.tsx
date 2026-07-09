import { createFileRoute } from "@tanstack/react-router";
import { Plus, GitBranch } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/workflows")({
  head: () => ({ meta: [{ title: "Workflows - Jigo AI Workspace" }] }),
  component: WorkflowsPage,
});

function WorkflowsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Workflows"
        description="Design and monitor multi-step business workflows."
        actions={
          <Button size="sm" disabled title="Builder coming soon">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New workflow
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <CardTitle>No workflows yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Create a workflow to automate approvals, notifications, and ERP handoffs. Your saved
            workflows will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
