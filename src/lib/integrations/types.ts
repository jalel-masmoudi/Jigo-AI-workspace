import type { ExtractedDocument, IntegrationProviderId } from "@/types/integrations";

export interface IntegrationCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  email?: string;
  baseUrl?: string;
  expiresAt?: number;
}

export interface IntegrationProvider {
  id: IntegrationProviderId;
  name: string;
  description: string;
  /** Returns true when enough env/credentials exist to call the live API. */
  isConfigured: () => boolean;
  /** Build OAuth authorize URL, or null if this provider uses API key only. */
  getAuthorizeUrl?: (redirectUri: string, state: string) => string | null;
  /** Exchange OAuth code for tokens. */
  exchangeCode?: (code: string, redirectUri: string) => Promise<IntegrationCredentials>;
  /** Fetch real documents using stored credentials. */
  extractDocuments: (creds: IntegrationCredentials) => Promise<ExtractedDocument[]>;
}

export const INTEGRATION_CATALOG: {
  id: IntegrationProviderId;
  name: string;
  description: string;
  authType: "oauth" | "api_key";
  envHint: string;
}[] = [
  {
    id: "google-meet",
    name: "Google Meet",
    description: "Import Meet recordings and transcripts from Google Drive.",
    authType: "oauth",
    envHint: "GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Sync pages from your Notion workspace.",
    authType: "api_key",
    envHint: "NOTION_API_KEY (internal integration)",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Pull recent channel messages and threads.",
    authType: "api_key",
    envHint: "SLACK_BOT_TOKEN",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Import issues from your Jira Cloud site.",
    authType: "api_key",
    envHint: "JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN",
  },
];
