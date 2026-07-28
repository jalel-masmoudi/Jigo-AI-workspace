import { afterEach, describe, expect, it, vi } from "vitest";

import {
  handleHealthRequest,
  handleIntegrationAuthorizeRequest,
  handleIntegrationOAuthCallbackRequest,
  handleIntegrationsStatusRequest,
  handleIntegrationSyncRequest,
  handleSummarizeRequest,
} from "./api-routes";

function jsonRequest(body: unknown) {
  return new Request("https://app.test/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API route behavior", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports health and configured integration statuses", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");

    const health = await handleHealthRequest();
    const status = await handleIntegrationsStatusRequest();

    expect(health.status).toBe(200);
    expect(await health.json()).toEqual(
      expect.objectContaining({
        ok: true,
        service: "jigo-ai-workspace",
        openrouter: false,
        providers: expect.arrayContaining([
          expect.objectContaining({ id: "google-meet", configured: false }),
          expect.objectContaining({ id: "notion", configured: false }),
        ]),
      }),
    );
    expect(await status.json()).toEqual({
      providers: expect.arrayContaining([
        expect.objectContaining({ id: "slack", configured: false, authType: "api_key" }),
        expect.objectContaining({ id: "jira", configured: false, authType: "api_key" }),
      ]),
    });
  });

  it("validates summary payloads and generates offline reminders", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");

    const missingContent = await handleSummarizeRequest(jsonRequest({ title: "Launch" }));
    expect(missingContent.status).toBe(400);
    expect(await missingContent.json()).toEqual({ error: "content is required" });

    const summary = await handleSummarizeRequest(
      jsonRequest({
        title: "Launch",
        content: "Maya will publish the update due tomorrow",
        provider: "notion",
        sourceDocId: "notion-1",
      }),
    );

    expect(summary.status).toBe(200);
    expect(await summary.json()).toEqual(
      expect.objectContaining({
        actionItems: [
          expect.objectContaining({
            title: "Maya will publish the update due tomorrow",
            dueHint: "tomorrow",
          }),
        ],
        reminders: [
          expect.objectContaining({
            sourceProvider: "notion",
            sourceDocId: "notion-1",
            sourceLabel: "Launch",
          }),
        ],
      }),
    );
  });

  it("returns clear errors for incomplete OAuth authorization attempts", async () => {
    const missingFields = await handleIntegrationAuthorizeRequest(
      jsonRequest({ provider: "notion" }),
    );
    expect(missingFields.status).toBe(400);
    expect(await missingFields.json()).toEqual({ error: "provider and redirectUri are required" });

    const apiKeyProvider = await handleIntegrationAuthorizeRequest(
      jsonRequest({ provider: "notion", redirectUri: "https://app.test/callback" }),
    );
    expect(apiKeyProvider.status).toBe(400);
    expect(await apiKeyProvider.json()).toEqual({ error: "Notion uses API key auth, not OAuth." });

    const unconfiguredProvider = await handleIntegrationAuthorizeRequest(
      jsonRequest({ provider: "google-meet", redirectUri: "https://app.test/callback" }),
    );
    expect(unconfiguredProvider.status).toBe(400);
    expect(await unconfiguredProvider.json()).toEqual(
      expect.objectContaining({
        error: "Google Meet is not configured on the server. Set the required env vars.",
      }),
    );
  });

  it("redirects OAuth failures to a usable integration error state", async () => {
    const providerError = await handleIntegrationOAuthCallbackRequest(
      new Request("https://app.test/api/integrations/oauth/callback?error=access_denied"),
    );
    expect(providerError.headers.get("location")).toBe(
      "https://app.test/integrations?oauth=error&message=access_denied",
    );

    const missingCode = await handleIntegrationOAuthCallbackRequest(
      new Request("https://app.test/api/integrations/oauth/callback?state=google-meet:state"),
    );
    expect(missingCode.headers.get("location")).toBe(
      "https://app.test/integrations?oauth=error&message=Missing%20OAuth%20code",
    );

    const apiKeyProvider = await handleIntegrationOAuthCallbackRequest(
      new Request("https://app.test/api/integrations/oauth/callback?code=abc&state=notion:state"),
    );
    expect(apiKeyProvider.headers.get("location")).toBe(
      "https://app.test/integrations?oauth=error&message=Provider%20does%20not%20support%20OAuth",
    );
  });

  it("rejects sync attempts before invoking an integration provider", async () => {
    const missingProvider = await handleIntegrationSyncRequest(jsonRequest({}));
    expect(missingProvider.status).toBe(400);
    expect(await missingProvider.json()).toEqual({ error: "provider is required" });

    const missingGoogleToken = await handleIntegrationSyncRequest(
      jsonRequest({ provider: "google-meet", credentials: {} }),
    );
    expect(missingGoogleToken.status).toBe(400);
    expect(await missingGoogleToken.json()).toEqual({
      error:
        "Google Meet requires OAuth. Click Connect and authorize Google, or ensure GOOGLE_CLIENT_ID/SECRET are set.",
    });

    const missingNotionToken = await handleIntegrationSyncRequest(
      jsonRequest({ provider: "notion", credentials: {} }),
    );
    expect(missingNotionToken.status).toBe(400);
    expect(await missingNotionToken.json()).toEqual({
      error: "Set NOTION_API_KEY or paste a Notion integration token.",
    });
  });
});
