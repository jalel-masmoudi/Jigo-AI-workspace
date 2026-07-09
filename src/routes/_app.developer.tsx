import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Code2, Play } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandLogo";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/developer")({
  head: () => ({ meta: [{ title: "Developer Assistant - Jigo AI Workspace" }] }),
  component: DeveloperPage,
});

const analyses = [
  {
    id: "a1",
    title: "Auth middleware refactor",
    language: "TypeScript",
    createdAt: "2h ago",
    snippet:
      "export async function requireAuth(req: Request) {\n  const token = req.headers.get('authorization');\n  if (!token) throw new Response('Unauthorized', { status: 401 });\n  return verify(token);\n}",
  },
  {
    id: "a2",
    title: "SQL query optimization",
    language: "SQL",
    createdAt: "Yesterday",
    snippet:
      "SELECT u.id, u.email, COUNT(o.id) AS orders\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nGROUP BY u.id\nORDER BY orders DESC\nLIMIT 20;",
  },
  {
    id: "a3",
    title: "React memoization pattern",
    language: "TypeScript",
    createdAt: "3d ago",
    snippet:
      "const value = useMemo(() => expensive(deps), [deps]);\nconst onClick = useCallback(() => handler(id), [id]);",
  },
];

function DeveloperPage() {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        title="Developer Assistant"
        description="Explain, refactor, and document code with AI."
      />

      <Card className="border-border/60 mb-8">
        <CardContent className="p-4">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Ask about code
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Paste code, describe a bug, or ask for a refactor…"
            className="mt-2 min-h-32 resize-none font-mono text-sm bg-muted/30 border-border/60"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Supports 40+ languages</span>
            <Button size="sm">
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
        <BrandMark className="h-4 w-4 rounded" /> Recent analyses
      </h3>
      <div className="grid gap-4 lg:grid-cols-2">
        {analyses.map((a) => (
          <Card key={a.id} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Code2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{a.title}</h4>
                    <p className="text-[11px] text-muted-foreground">{a.createdAt}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {a.language}
                </Badge>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[12px] font-mono text-foreground/90 leading-relaxed">
                <code>{a.snippet}</code>
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
