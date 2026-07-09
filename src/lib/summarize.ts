import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

import type { IntegrationProviderId } from "@/types/integrations";
import type { Reminder } from "@/types/integrations";

const SummarySchema = z.object({
  summary: z.string(),
  actionItems: z.array(
    z.object({
      title: z.string(),
      dueHint: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
    }),
  ),
  tags: z.array(z.string()).default([]),
});

export type SummarizeResult = z.infer<typeof SummarySchema>;

function dueFromHint(hint?: string): string {
  const now = new Date();
  const h = (hint || "").toLowerCase();
  if (h.includes("tomorrow")) now.setDate(now.getDate() + 1);
  else if (h.includes("wednesday")) {
    const day = now.getDay();
    const diff = (3 - day + 7) % 7 || 7;
    now.setDate(now.getDate() + diff);
  } else if (h.includes("thursday")) {
    const day = now.getDay();
    const diff = (4 - day + 7) % 7 || 7;
    now.setDate(now.getDate() + diff);
  } else if (h.includes("friday")) {
    const day = now.getDay();
    const diff = (5 - day + 7) % 7 || 7;
    now.setDate(now.getDate() + diff);
  } else if (h.includes("monday")) {
    const day = now.getDay();
    const diff = (1 - day + 7) % 7 || 7;
    now.setDate(now.getDate() + diff);
  } else if (h.includes("eod") || h.includes("today")) {
    /* keep today */
  } else {
    now.setDate(now.getDate() + 2);
  }
  now.setHours(17, 0, 0, 0);
  return now.toISOString();
}

/** Heuristic fallback when no API key — still production-usable offline. */
export function summarizeLocally(title: string, content: string): SummarizeResult {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const actionLines = lines.filter(
    (l) =>
      /action item/i.test(l) ||
      /^[-*]\s+\w+:/i.test(l) ||
      /\b(due|by)\b/i.test(l) ||
      /will (draft|send|escalate|publish|notify|update)/i.test(l),
  );
  const actionItems = actionLines.slice(0, 8).map((l) => {
    const cleaned = l.replace(/^[-*]\s*/, "").replace(/^Action items?:\s*/i, "");
    let priority: "low" | "medium" | "high" = "medium";
    if (/friday|asap|high|escalate|at risk/i.test(cleaned)) priority = "high";
    if (/optional|low|later/i.test(cleaned)) priority = "low";
    const dueMatch = cleaned.match(/due\s+([^)]+)/i);
    return {
      title: cleaned.slice(0, 140),
      dueHint: dueMatch?.[1],
      priority,
    };
  });

  const summary =
    lines.slice(0, 6).join(" ").slice(0, 480) ||
    `Summary of ${title}: key points captured for workspace follow-up.`;

  return {
    summary,
    actionItems:
      actionItems.length > 0
        ? actionItems
        : [
            {
              title: `Review: ${title}`,
              dueHint: "tomorrow",
              priority: "medium",
            },
          ],
    tags: [],
  };
}

export async function summarizeContent(title: string, content: string): Promise<SummarizeResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return summarizeLocally(title, content);
  }

  try {
    const openrouter = createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      compatibility: "compatible",
    });
    const modelId = process.env.OPENROUTER_MODEL || "nousresearch/hermes-3-llama-3.1-405b";

    const { text } = await generateText({
      model: openrouter(modelId),
      system: `You extract enterprise meeting/doc insights. Reply with ONLY valid JSON:
{"summary":"2-4 sentences","actionItems":[{"title":"...","dueHint":"Friday|tomorrow|EOD","priority":"low|medium|high"}],"tags":["..."]}`,
      prompt: `Title: ${title}\n\nContent:\n${content.slice(0, 12000)}`,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return summarizeLocally(title, content);
    const parsed = SummarySchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parsed.success) return summarizeLocally(title, content);
    return parsed.data;
  } catch {
    return summarizeLocally(title, content);
  }
}

export function remindersFromSummary(
  result: SummarizeResult,
  opts: {
    provider?: IntegrationProviderId;
    sourceDocId?: string;
    sourceLabel?: string;
  },
): Reminder[] {
  return result.actionItems.map((item, i) => ({
    id: `rem_${opts.sourceDocId || "local"}_${i}_${Date.now()}`,
    title: item.title,
    description: result.summary.slice(0, 240),
    dueAt: dueFromHint(item.dueHint),
    sourceProvider: opts.provider,
    sourceDocId: opts.sourceDocId,
    sourceLabel: opts.sourceLabel,
    priority: item.priority,
    completed: false,
    createdAt: new Date().toISOString(),
  }));
}
