export type ID = string;

export interface User {
  id: ID;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: string;
}

export interface Conversation {
  id: ID;
  title: string;
  updatedAt: string;
  preview?: string;
}

export interface ChatMessage {
  id: ID;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  streaming?: boolean;
}

export interface Report {
  id: ID;
  title: string;
  type: string;
  createdAt: string;
  status: "ready" | "generating" | "failed";
  size?: string;
}

export interface DocumentItem {
  id: ID;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  status: "processed" | "processing" | "failed";
  summary?: string;
  source?: string;
}

export interface Analysis {
  id: ID;
  title: string;
  language: string;
  createdAt: string;
  snippet: string;
}

export interface Notification {
  id: ID;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  href?: string;
}

export type {
  IntegrationProviderId,
  IntegrationStatus,
  IntegrationConnection,
  ExtractedDocument,
  Reminder,
  SyncJob,
} from "./integrations";
