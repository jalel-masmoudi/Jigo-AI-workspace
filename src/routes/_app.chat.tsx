import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  Copy,
  Download,
  FileText,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Send,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/shared/Markdown";
import { useChatStore } from "@/store/chatStore";
import { useIntegrationStore } from "@/store/integrationStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";

type ChatUiMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
};

export const Route = createFileRoute("/_app/chat")({
  head: () => ({ meta: [{ title: "AI Chat - Jigo AI Workspace" }] }),
  component: ChatPage,
});

const SUGGESTIONS = [
  "Summarize my latest synced meeting notes",
  "Draft a follow-up email from open reminders",
  "List action items from connected integrations",
  "Help me write a status update for my team",
];

function ChatPage() {
  const {
    conversations,
    activeId,
    messages: storedMessages,
    setActive,
    newConversation,
  } = useChatStore();
  const [showSources, setShowSources] = useState(true);
  const syncedDocs = useIntegrationStore((s) => s.documents).slice(0, 8);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-background">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card">
        <div className="p-3 border-b border-border">
          <Button
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => newConversation()}
          >
            <Plus className="h-3.5 w-3.5" /> New chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <ul className="p-2 space-y-0.5">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActive(c.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2 text-sm transition-colors",
                    activeId === c.id
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <div className="truncate">{c.title}</div>
                  <div className="text-[11px] opacity-70 truncate">{c.updatedAt}</div>
                </button>
              </li>
            ))}
            {conversations.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                No conversations yet
              </li>
            )}
          </ul>
        </ScrollArea>
      </aside>

      <div className="flex flex-1 min-w-0">
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex h-11 items-center justify-between border-b border-border px-4 bg-card">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Workspace assistant</span>
              <Badge variant="outline" className="text-[10px] font-normal">
                Enterprise
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    Hermes 3
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Hermes 3 (405B)</DropdownMenuItem>
                  <DropdownMenuItem>GPT-4o</DropdownMenuItem>
                  <DropdownMenuItem>Claude Sonnet</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs lg:hidden"
                onClick={() => setShowSources((v) => !v)}
              >
                Sources
              </Button>
            </div>
          </div>

          {activeId ? (
            <ChatArea
              key={activeId}
              id={activeId}
              initialMessages={(storedMessages[activeId] || [])
                .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system")
                .map((m): ChatUiMessage => ({
                  id: m.id,
                  role: m.role as ChatUiMessage["role"],
                  content: m.content,
                }))}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select or create a chat to get started
            </div>
          )}
        </div>

        {showSources && (
          <aside className="hidden xl:flex w-72 flex-col border-l border-border bg-card">
            <div className="h-11 flex items-center px-4 border-b border-border">
              <span className="text-sm font-medium">Sources</span>
            </div>
            <div className="p-3 space-y-2">
              {syncedDocs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    No synced sources yet.{" "}
                    <Link to="/integrations" className="text-primary hover:underline">
                      Connect apps
                    </Link>{" "}
                    to ground answers in real workplace content.
                  </p>
                </div>
              ) : (
                syncedDocs.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-2 rounded-lg border border-border p-3"
                  >
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{s.title}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">
                        {s.provider}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                <Link to="/integrations">
                  <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                  Manage sources
                </Link>
              </Button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function ChatArea({ id, initialMessages }: { id: string; initialMessages: ChatUiMessage[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Cast avoids duplicate Message type mismatch between `ai` and `@ai-sdk/react`.
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: "/api/chat",
    id,
    initialMessages: initialMessages as never,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-2xl px-4 py-16">
            <h2 className="text-center text-lg font-semibold text-foreground">
              How can I help you work faster?
            </h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Ask about ERP data, documents, reports, or draft content for your team.
            </p>
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => append({ role: "user", content: s })}
                  className="rounded-xl border border-border bg-card p-3 text-left text-sm text-foreground hover:border-primary/40 hover:bg-accent/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="flex gap-3"
              >
                <Avatar className="h-7 w-7 shrink-0 mt-0.5 border border-border">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-medium",
                      m.role === "user" ? "bg-muted" : "bg-primary/10 text-primary",
                    )}
                  >
                    {m.role === "user" ? "You" : "AI"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    {m.role === "user" ? "You" : "Jigo"}
                  </div>
                  <Markdown content={m.content} />
                  {m.role === "assistant" && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <RefreshCw className="mr-1 h-3 w-3" /> Regenerate
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Download className="mr-1 h-3 w-3" /> Export
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Save className="mr-1 h-3 w-3" /> Save
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex gap-3 px-1">
                <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
                <div className="flex items-center gap-1 pt-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={handleSubmit}
            className="relative rounded-xl border border-border bg-background focus-within:border-primary/50 transition-colors"
          >
            <Textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const formEvent = new Event("submit", { bubbles: true, cancelable: true });
                  e.currentTarget.form?.dispatchEvent(formEvent);
                }
              }}
              placeholder="Ask about ERP data, documents, or workflows…"
              rows={1}
              className="min-h-[52px] max-h-40 resize-none border-0 bg-transparent pl-3 pr-24 py-3.5 text-sm shadow-none focus-visible:ring-0"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Attach">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="submit"
                size="icon"
                className="h-8 w-8"
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            Responses can use connected ERP and knowledge sources
          </p>
        </div>
      </div>
    </>
  );
}
