import { describe, expect, it } from "vitest";

import {
  handleIntegrationAuthorizeRequest,
  handleIntegrationOAuthCallbackRequest,
  handleIntegrationSyncRequest,
} from "./api-routes";
import { afterEach, vi } from "vitest";
import { getLocalSession, localSignIn, localSignOut, localSignUp } from "./local-auth";
import { remindersFromSummary, summarizeLocally } from "./summarize";

function jsonRequest(body: unknown) {
  return new Request("https://app.test/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("summary and reminders", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("extracts priority action items and schedules due hints", () => {
    const result = summarizeLocally(
      "Launch",
      "Action item: Maya will escalate approval due Friday\nGeneral notes only",
    );

    expect(result.actionItems).toEqual([
      {
        title: "Maya will escalate approval due Friday",
        dueHint: "Friday",
        priority: "high",
      },
    ]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T09:00:00.000Z"));

    const [reminder] = remindersFromSummary(result, {
      provider: "jira",
      sourceDocId: "ABC-1",
      sourceLabel: "Launch",
    });

    expect(reminder).toMatchObject({
      id: "rem_ABC-1_0_1785229200000",
      title: "Maya will escalate approval due Friday",
      sourceProvider: "jira",
      sourceDocId: "ABC-1",
      sourceLabel: "Launch",
      priority: "high",
      completed: false,
      createdAt: "2026-07-28T09:00:00.000Z",
    });
    expect(new Date(reminder.dueAt).getDay()).toBe(5);
    expect(new Date(reminder.dueAt).getHours()).toBe(17);
  });
});

describe("local auth", () => {
  it("normalizes signup details and protects account access", async () => {
    const signedUp = await localSignUp("  Ada Lovelace  ", " ADA@Example.COM ", "correct horse");

    if ("error" in signedUp) throw new Error(signedUp.error);

    expect(signedUp).toEqual({
      user: {
        id: expect.stringMatching(/^local_/),
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "Admin",
      },
    });
    expect(getLocalSession()).toEqual(signedUp.user);

    localSignOut();
    expect(getLocalSession()).toBeNull();
    expect(await localSignIn("ada@example.com", "wrong password")).toEqual({
      error: "Invalid email or password.",
    });
    expect(await localSignIn("ada@example.com", "correct horse")).toEqual(signedUp);
    expect(await localSignUp("Ada", " ADA@example.com ", "another pass")).toEqual({
      error: "An account with this email already exists. Sign in instead.",
    });
  });
});

describe("integration API validation", () => {
  it("rejects unsupported provider ids without throwing", async () => {
    const authorize = await handleIntegrationAuthorizeRequest(
      jsonRequest({ provider: "github", redirectUri: "https://app.test/oauth/callback" }),
    );
    expect(authorize.status).toBe(400);
    expect(await authorize.json()).toEqual({ error: 'Unsupported provider "github".' });

    const sync = await handleIntegrationSyncRequest(jsonRequest({ provider: "github" }));
    expect(sync.status).toBe(400);
    expect(await sync.json()).toEqual({ error: 'Unsupported provider "github".' });

    const callback = await handleIntegrationOAuthCallbackRequest(
      new Request("https://app.test/api/integrations/oauth/callback?code=abc&state=github:nonce"),
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe(
      "https://app.test/integrations?oauth=error&message=Unsupported%20provider%20%22github%22.",
    );
  });
});
