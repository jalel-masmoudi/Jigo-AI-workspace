import { beforeEach, describe, expect, it, vi } from "vitest";

import { INTEGRATION_CATALOG } from "@/lib/integrations/registry";
import type { Notification } from "@/types";
import type { ExtractedDocument, Reminder } from "@/types/integrations";
import { useIntegrationStore } from "./integrationStore";
import { useNotificationStore } from "./notificationStore";
import { useReminderStore } from "./reminderStore";

function reminder(id: string, patch: Partial<Reminder> = {}): Reminder {
  return {
    id,
    title: "Reminder " + id,
    dueAt: "2026-07-31T16:00:00.000Z",
    priority: "medium",
    completed: false,
    createdAt: "2026-07-28T09:00:00.000Z",
    ...patch,
  };
}

function document(id: string, patch: Partial<ExtractedDocument> = {}): ExtractedDocument {
  return {
    id,
    provider: "notion",
    externalId: id,
    title: "Document " + id,
    content: "Document content",
    extractedAt: "2026-07-28T09:00:00.000Z",
    ...patch,
  };
}

function notification(id: string, read = false): Notification {
  return {
    id,
    title: "Notification " + id,
    description: "Description",
    createdAt: "2026-07-28T09:00:00.000Z",
    read,
  };
}

describe("reminder store", () => {
  beforeEach(() => {
    useReminderStore.setState({ reminders: [] });
  });

  it("deduplicates imports and updates only targeted reminders", () => {
    useReminderStore.getState().add(reminder("existing"));
    useReminderStore
      .getState()
      .addMany([reminder("new"), reminder("existing", { title: "Duplicate" })]);
    useReminderStore.getState().complete("existing");
    useReminderStore.getState().snooze("new", "2026-08-03T16:00:00.000Z");
    useReminderStore.getState().remove("existing");

    expect(useReminderStore.getState().reminders).toEqual([
      {
        ...reminder("new"),
        dueAt: "2026-08-03T16:00:00.000Z",
      },
    ]);
  });
});

describe("integration store", () => {
  beforeEach(() => {
    useIntegrationStore.setState({
      connections: INTEGRATION_CATALOG.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        status: "disconnected" as const,
      })),
      documents: [],
      jobs: [],
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T09:00:00.000Z"));
  });
  it("merges credentials, records sync time, and upserts documents", () => {
    useIntegrationStore.getState().setCredentials("notion", { apiKey: "secret" }, "Docs team");
    useIntegrationStore.getState().markSynced("notion");
    useIntegrationStore.getState().upsertDocuments([document("doc-1", { title: "Original" })]);
    useIntegrationStore
      .getState()
      .upsertDocuments([document("doc-1", { title: "Updated", summary: "Merged" })]);

    expect(useIntegrationStore.getState().getCredentials("notion")).toEqual({ apiKey: "secret" });
    expect(useIntegrationStore.getState().connections.find((item) => item.id === "notion")).toEqual(
      expect.objectContaining({
        status: "connected",
        accountLabel: "Docs team",
        lastSyncedAt: "2026-07-28T09:00:00.000Z",
      }),
    );
    expect(useIntegrationStore.getState().documents).toEqual([
      document("doc-1", { title: "Updated", summary: "Merged" }),
    ]);
  });
});

describe("notification store", () => {
  beforeEach(() => {
    useNotificationStore.setState({ items: [] });
  });

  it("keeps the newest 100 notifications and tracks unread counts", () => {
    for (let index = 0; index < 105; index += 1) {
      useNotificationStore.getState().add(notification(String(index), index % 2 === 0));
    }

    expect(useNotificationStore.getState().items).toHaveLength(100);
    expect(useNotificationStore.getState().items[0].id).toBe("104");
    expect(useNotificationStore.getState().items[99].id).toBe("5");
    expect(useNotificationStore.getState().unreadCount()).toBe(50);
  });
});
