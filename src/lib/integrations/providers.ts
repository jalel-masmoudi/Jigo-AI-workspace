import type { ExtractedDocument } from "@/types/integrations";
import type { IntegrationCredentials, IntegrationProvider } from "./types";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Add it to your server environment.`);
  return v;
}

function doc(
  partial: Omit<ExtractedDocument, "extractedAt"> & { extractedAt?: string },
): ExtractedDocument {
  return { extractedAt: new Date().toISOString(), ...partial };
}

/** Google Meet via Drive files that look like Meet recordings/transcripts. */
export const googleMeetProvider: IntegrationProvider = {
  id: "google-meet",
  name: "Google Meet",
  description: "Import Meet recordings and transcripts from Google Drive.",
  isConfigured: () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  getAuthorizeUrl(redirectUri, state) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return null;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },
  async exchangeCode(code, redirectUri) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: requireEnv("GOOGLE_CLIENT_ID"),
        client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Google OAuth failed: ${t}`);
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  },
  async extractDocuments(creds) {
    if (!creds.accessToken) throw new Error("Connect Google Meet first.");
    const q = encodeURIComponent(
      "fullText contains 'Meet' or name contains 'Meet' or name contains 'Transcript' or mimeType = 'application/vnd.google-apps.document'",
    );
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?pageSize=15&fields=files(id,name,modifiedTime,webViewLink,mimeType)&q=${q}`,
      { headers: { Authorization: `Bearer ${creds.accessToken}` } },
    );
    if (!listRes.ok) {
      throw new Error(`Google Drive error: ${await listRes.text()}`);
    }
    const list = (await listRes.json()) as {
      files?: Array<{
        id: string;
        name: string;
        modifiedTime?: string;
        webViewLink?: string;
        mimeType?: string;
      }>;
    };
    const files = list.files || [];
    const out: ExtractedDocument[] = [];
    for (const f of files.slice(0, 10)) {
      let content = `Google Drive file: ${f.name}`;
      try {
        if (f.mimeType === "application/vnd.google-apps.document") {
          const exportRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain`,
            { headers: { Authorization: `Bearer ${creds.accessToken}` } },
          );
          if (exportRes.ok) content = await exportRes.text();
        } else if (f.mimeType?.startsWith("text/")) {
          const raw = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {
            headers: { Authorization: `Bearer ${creds.accessToken}` },
          });
          if (raw.ok) content = await raw.text();
        }
      } catch {
        /* keep stub content */
      }
      out.push(
        doc({
          id: `meet_${f.id}`,
          provider: "google-meet",
          externalId: f.id,
          title: f.name,
          content: content.slice(0, 20000),
          url: f.webViewLink,
          tags: ["google-meet", "drive"],
        }),
      );
    }
    if (out.length === 0) {
      throw new Error(
        "No Meet-related files found in Drive. Export a Meet transcript to Drive, then sync again.",
      );
    }
    return out;
  },
};

export const notionProvider: IntegrationProvider = {
  id: "notion",
  name: "Notion",
  description: "Sync pages from your Notion workspace.",
  isConfigured: () => Boolean(process.env.NOTION_API_KEY),
  async extractDocuments(creds) {
    const token = creds.apiKey || process.env.NOTION_API_KEY;
    if (!token) throw new Error("Set NOTION_API_KEY or paste a Notion integration token.");
    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: "object", value: "page" },
        page_size: 10,
      }),
    });
    if (!searchRes.ok) throw new Error(`Notion error: ${await searchRes.text()}`);
    const search = (await searchRes.json()) as {
      results: Array<{
        id: string;
        url?: string;
        properties?: Record<string, { type?: string; title?: Array<{ plain_text?: string }> }>;
      }>;
    };

    const out: ExtractedDocument[] = [];
    for (const page of search.results.slice(0, 10)) {
      const titleProp = Object.values(page.properties || {}).find((p) => p.type === "title");
      const title =
        titleProp?.title?.map((t) => t.plain_text || "").join("") || "Untitled Notion page";

      const blocksRes = await fetch(
        `https://api.notion.com/v1/blocks/${page.id}/children?page_size=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": "2022-06-28",
          },
        },
      );
      let content = title;
      if (blocksRes.ok) {
        type NotionRich = { plain_text?: string };
        type NotionBlock = {
          type: string;
          [key: string]:
            | string
            | { rich_text?: NotionRich[]; text?: NotionRich[]; title?: NotionRich[] }
            | undefined;
        };
        const blocks = (await blocksRes.json()) as { results: NotionBlock[] };
        const parts: string[] = [];
        for (const b of blocks.results) {
          const payload = b[b.type];
          const rich =
            payload && typeof payload === "object"
              ? payload.rich_text || payload.text || payload.title || []
              : [];
          if (Array.isArray(rich)) {
            const line = rich.map((r) => r.plain_text || "").join("");
            if (line) parts.push(line);
          }
        }
        content = [title, ...parts].join("\n");
      }

      out.push(
        doc({
          id: `notion_${page.id.replace(/-/g, "")}`,
          provider: "notion",
          externalId: page.id,
          title,
          content: content.slice(0, 20000),
          url: page.url,
          tags: ["notion"],
        }),
      );
    }
    if (out.length === 0) {
      throw new Error("No Notion pages found. Share pages with your integration, then sync.");
    }
    return out;
  },
};

export const slackProvider: IntegrationProvider = {
  id: "slack",
  name: "Slack",
  description: "Pull recent channel messages and threads.",
  isConfigured: () => Boolean(process.env.SLACK_BOT_TOKEN),
  async extractDocuments(creds) {
    const token = creds.apiKey || process.env.SLACK_BOT_TOKEN;
    if (!token) throw new Error("Set SLACK_BOT_TOKEN or paste a Slack bot token.");

    const chRes = await fetch(
      "https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=20",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const chData = (await chRes.json()) as {
      ok: boolean;
      error?: string;
      channels?: Array<{ id: string; name: string }>;
    };
    if (!chData.ok) throw new Error(`Slack error: ${chData.error}`);

    const out: ExtractedDocument[] = [];
    for (const ch of (chData.channels || []).slice(0, 5)) {
      const histRes = await fetch(
        `https://slack.com/api/conversations.history?channel=${ch.id}&limit=30`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const hist = (await histRes.json()) as {
        ok: boolean;
        messages?: Array<{ text?: string; user?: string; ts?: string }>;
      };
      if (!hist.ok || !hist.messages?.length) continue;
      const content = hist.messages.map((m) => `${m.user || "user"}: ${m.text || ""}`).join("\n");
      out.push(
        doc({
          id: `slack_${ch.id}`,
          provider: "slack",
          externalId: ch.id,
          title: `#${ch.name} — recent messages`,
          content: content.slice(0, 20000),
          tags: ["slack", ch.name],
        }),
      );
    }
    if (out.length === 0) {
      throw new Error("No Slack channel messages found. Invite the bot to channels, then sync.");
    }
    return out;
  },
};

export const jiraProvider: IntegrationProvider = {
  id: "jira",
  name: "Jira",
  description: "Import issues from your Jira Cloud site.",
  isConfigured: () =>
    Boolean(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN),
  async extractDocuments(creds) {
    const base = (creds.baseUrl || process.env.JIRA_BASE_URL || "").replace(/\/$/, "");
    const email = creds.email || process.env.JIRA_EMAIL;
    const token = creds.apiKey || process.env.JIRA_API_TOKEN;
    if (!base || !email || !token) {
      throw new Error(
        "Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN (or enter them when connecting).",
      );
    }
    const auth = Buffer.from(`${email}:${token}`).toString("base64");
    const jql = encodeURIComponent("updated >= -30d ORDER BY updated DESC");
    const res = await fetch(
      `${base}/rest/api/3/search?jql=${jql}&maxResults=15&fields=summary,description,status,assignee,comment,updated`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) throw new Error(`Jira error: ${await res.text()}`);
    const data = (await res.json()) as {
      issues: Array<{
        id: string;
        key: string;
        fields: {
          summary?: string;
          description?: unknown;
          status?: { name?: string };
          assignee?: { displayName?: string };
          comment?: {
            comments?: Array<{ body?: unknown; author?: { displayName?: string } }>;
          };
          updated?: string;
        };
      }>;
    };

    type AdfNode = {
      type?: string;
      text?: string;
      content?: AdfNode[];
    };

    const textFromAdf = (node: unknown): string => {
      if (!node) return "";
      if (typeof node === "string") return node;
      if (typeof node !== "object") return "";
      const n = node as AdfNode;
      if (n.type === "text") return n.text || "";
      if (Array.isArray(n.content)) return n.content.map(textFromAdf).join("");
      return "";
    };

    return data.issues.map((issue) => {
      const comments = (issue.fields.comment?.comments || [])
        .slice(-5)
        .map((c) => `${c.author?.displayName || "user"}: ${textFromAdf(c.body)}`)
        .join("\n");
      const description = textFromAdf(issue.fields.description);
      const content = [
        `${issue.key}: ${issue.fields.summary || ""}`,
        `Status: ${issue.fields.status?.name || "Unknown"}`,
        `Assignee: ${issue.fields.assignee?.displayName || "Unassigned"}`,
        description,
        comments ? `Comments:\n${comments}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      return doc({
        id: `jira_${issue.id}`,
        provider: "jira",
        externalId: issue.key,
        title: `${issue.key} ${issue.fields.summary || ""}`.trim(),
        content: content.slice(0, 20000),
        url: `${base}/browse/${issue.key}`,
        author: issue.fields.assignee?.displayName,
        tags: ["jira", issue.fields.status?.name || "issue"].filter(Boolean) as string[],
      });
    });
  },
};
