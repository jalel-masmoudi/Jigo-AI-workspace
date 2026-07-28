import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage, DocumentItem, Report } from "@/types";
import { useChatStore } from "./chatStore";
import { useDocumentStore } from "./documentStore";
import { useReportStore } from "./reportStore";
import { useUIStore } from "./uiStore";

const message: ChatMessage = {
  id: "message-1",
  role: "user",
  content: "Summarize this",
  createdAt: "2026-07-28T09:00:00.000Z",
};

const document: DocumentItem = {
  id: "document-1",
  name: "Launch plan.pdf",
  type: "application/pdf",
  size: "42 KB",
  uploadedAt: "2026-07-28T09:00:00.000Z",
  status: "processed",
};

const report: Report = {
  id: "report-1",
  title: "Weekly summary",
  type: "summary",
  createdAt: "2026-07-28T09:00:00.000Z",
  status: "ready",
};

describe("chat store", () => {
  beforeEach(() => {
    useChatStore.setState({ conversations: [], activeId: null, messages: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an active conversation and appends messages to it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T09:00:00.000Z"));

    const id = useChatStore.getState().newConversation();
    useChatStore.getState().appendMessage(id, message);
    useChatStore.getState().setActive(null);

    expect(id).toBe("c_1785229200000");
    expect(useChatStore.getState()).toMatchObject({
      activeId: null,
      conversations: [{ id, title: "New chat", updatedAt: "now" }],
      messages: { [id]: [message] },
    });
  });
});

describe("document and report stores", () => {
  beforeEach(() => {
    useDocumentStore.setState({ documents: [] });
    useReportStore.setState({ reports: [] });
  });

  it("places the newest uploaded document and report first", () => {
    useDocumentStore.getState().add(document);
    useDocumentStore.getState().add({ ...document, id: "document-2", name: "Notes.docx" });
    useReportStore.getState().addReport(report);
    useReportStore.getState().addReport({ ...report, id: "report-2", title: "Risk review" });

    expect(useDocumentStore.getState().documents.map((item) => item.id)).toEqual([
      "document-2",
      "document-1",
    ]);
    expect(useReportStore.getState().reports.map((item) => item.id)).toEqual([
      "report-2",
      "report-1",
    ]);
  });
});

describe("UI store", () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarCollapsed: false });
  });

  it("toggles and explicitly sets sidebar visibility", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);

    useUIStore.getState().setSidebar(false);
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });
});
