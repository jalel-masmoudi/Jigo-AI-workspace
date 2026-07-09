import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, FileBarChart, Filter, Plus, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useReportStore } from "@/store/reportStore";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports - Jigo AI Workspace" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { reports, addReport } = useReportStore();
  const [q, setQ] = useState("");
  const filtered = reports.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));

  const reportStats = [
    { name: "Financial", count: reports.filter((r) => r.type === "Financial").length || 12 },
    { name: "Marketing", count: reports.filter((r) => r.type === "Marketing").length || 8 },
    { name: "Operations", count: reports.filter((r) => r.type === "Operations").length || 5 },
    { name: "Sales", count: reports.filter((r) => r.type === "Sales").length || 15 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Reports"
        description="Analytics, scheduled exports, and AI-generated reports."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              Schedule
            </Button>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Generate report
            </Button>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-2">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Reports by Category</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex flex-col justify-center h-full items-center text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Plus className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Custom Report</h3>
            <p className="mt-1 text-sm text-muted-foreground mb-4">
              Need specific data? Ask AI to generate a custom analysis report.
            </p>
            <Button
              onClick={() => {
                addReport({
                  id: `r_${Date.now()}`,
                  title: "Custom AI Analysis",
                  type: "Analytics",
                  createdAt: "just now",
                  status: "ready",
                  size: "1.2 MB",
                });
              }}
            >
              Generate Now
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reports…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="mr-1.5 h-3.5 w-3.5" />
          Filter
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="No reports found"
          description="Try a different search or generate a new report."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Card key={r.id} className="border-border/60 hover:border-primary/50 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileBarChart className="h-4 w-4" />
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground line-clamp-1">
                  {r.title}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.type} · {r.createdAt}
                  {r.size ? ` · ${r.size}` : ""}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={r.status !== "ready"}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Download
                  </Button>
                  <Button size="sm" variant="ghost">
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
