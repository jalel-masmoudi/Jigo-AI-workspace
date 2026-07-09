export type IntegrationProviderId = "google-meet" | "notion" | "slack" | "jira";

export type IntegrationStatus = "disconnected" | "connected" | "syncing" | "error";

export interface IntegrationConnection {
  id: IntegrationProviderId;
  name: string;
  description: string;
  status: IntegrationStatus;
  lastSyncedAt?: string;
  accountLabel?: string;
  error?: string;
}

export interface ExtractedDocument {
  id: string;
  provider: IntegrationProviderId;
  externalId: string;
  title: string;
  content: string;
  url?: string;
  author?: string;
  extractedAt: string;
  summary?: string;
  actionItems?: string[];
  tags?: string[];
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueAt: string;
  sourceProvider?: IntegrationProviderId;
  sourceDocId?: string;
  sourceLabel?: string;
  priority: "low" | "medium" | "high";
  completed: boolean;
  createdAt: string;
}

export interface SyncJob {
  id: string;
  provider: IntegrationProviderId;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string;
  docsImported: number;
  remindersCreated: number;
  error?: string;
}
