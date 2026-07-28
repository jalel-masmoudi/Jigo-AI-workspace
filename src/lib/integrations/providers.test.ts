import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { googleMeetProvider, jiraProvider, notionProvider, slackProvider } from "./providers";

describe("integration providers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds a Google OAuth URL and exchanges an authorization code", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const getAuthorizeUrl = googleMeetProvider.getAuthorizeUrl;
    if (!getAuthorizeUrl) throw new Error("Google Meet provider must support OAuth authorization.");

    const url = getAuthorizeUrl("https://app.test/callback", "google-meet:state");
    const params = new URL(url ?? "").searchParams;

    expect(params.get("client_id")).toBe("google-client");
    expect(params.get("redirect_uri")).toBe("https://app.test/callback");
    expect(params.get("state")).toBe("google-meet:state");
    await expect(
      googleMeetProvider.exchangeCode?.("authorization-code", "https://app.test/callback"),
    ).resolves.toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 1_700_003_600_000,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("requires the credentials needed by each provider before a network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(googleMeetProvider.extractDocuments({})).rejects.toThrow(
      "Connect Google Meet first.",
    );
    await expect(notionProvider.extractDocuments({})).rejects.toThrow("Set NOTION_API_KEY");
    await expect(slackProvider.extractDocuments({})).rejects.toThrow("Set SLACK_BOT_TOKEN");
    await expect(jiraProvider.extractDocuments({})).rejects.toThrow("Set JIRA_BASE_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns Notion pages and blocks into extracted documents", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          results: [
            {
              id: "abc-123",
              url: "https://notion.so/page",
              properties: {
                Name: { type: "title", title: [{ plain_text: "Launch plan" }] },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          results: [
            { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Ship the release" }] } },
            { type: "to_do", to_do: { rich_text: [{ plain_text: "Notify the team" }] } },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(notionProvider.extractDocuments({ apiKey: "notion-token" })).resolves.toEqual([
      expect.objectContaining({
        id: "notion_abc123",
        provider: "notion",
        externalId: "abc-123",
        title: "Launch plan",
        content: "Launch plan\nShip the release\nNotify the team",
        url: "https://notion.so/page",
        tags: ["notion"],
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("converts Jira ADF descriptions and comments into a searchable document", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        issues: [
          {
            id: "10001",
            key: "PROJ-7",
            fields: {
              summary: "Release checklist",
              status: { name: "In Progress" },
              assignee: { displayName: "Ada" },
              description: { type: "doc", content: [{ type: "text", text: "Prepare notes" }] },
              comment: {
                comments: [
                  {
                    author: { displayName: "Lin" },
                    body: { type: "doc", content: [{ type: "text", text: "Approved" }] },
                  },
                ],
              },
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      jiraProvider.extractDocuments({
        baseUrl: "https://workspace.atlassian.net/",
        email: "ada@example.com",
        apiKey: "jira-token",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "jira_10001",
        provider: "jira",
        externalId: "PROJ-7",
        title: "PROJ-7 Release checklist",
        content: expect.stringContaining("Lin: Approved"),
        url: "https://workspace.atlassian.net/browse/PROJ-7",
        author: "Ada",
        tags: ["jira", "In Progress"],
      }),
    ]);
  });
});
