import { summarizeContent, remindersFromSummary } from "./summarize";
import { getProvider, getProviderStatus, listProviders } from "./integrations/registry";
import type { IntegrationProviderId } from "@/types/integrations";
import type { IntegrationCredentials } from "./integrations/types";

export async function handleHealthRequest(): Promise<Response> {
  const providers = listProviders().map((p) => ({
    id: p.id,
    configured: p.isConfigured(),
  }));
  return Response.json({
    ok: true,
    service: "jigo-ai-workspace",
    time: new Date().toISOString(),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    providers,
  });
}

export async function handleSummarizeRequest(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    title?: string;
    content?: string;
    provider?: IntegrationProviderId;
    sourceDocId?: string;
  };
  if (!body.content) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }
  const title = body.title || "Untitled";
  const result = await summarizeContent(title, body.content);
  const reminders = remindersFromSummary(result, {
    provider: body.provider,
    sourceDocId: body.sourceDocId,
    sourceLabel: title,
  });
  return Response.json({ ...result, reminders });
}

export async function handleIntegrationsStatusRequest(): Promise<Response> {
  return Response.json({
    providers: listProviders().map((p) => getProviderStatus(p.id)),
  });
}

export async function handleIntegrationAuthorizeRequest(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    provider?: IntegrationProviderId;
    redirectUri?: string;
  };
  if (!body.provider || !body.redirectUri) {
    return Response.json({ error: "provider and redirectUri are required" }, { status: 400 });
  }
  const provider = getProvider(body.provider);
  if (!provider.getAuthorizeUrl) {
    return Response.json(
      { error: `${provider.name} uses API key auth, not OAuth.` },
      { status: 400 },
    );
  }
  if (!provider.isConfigured()) {
    return Response.json(
      {
        error: `${provider.name} is not configured on the server. Set the required env vars.`,
        status: getProviderStatus(body.provider),
      },
      { status: 400 },
    );
  }
  const state = `${body.provider}:${crypto.randomUUID()}`;
  const url = provider.getAuthorizeUrl(body.redirectUri, state);
  if (!url) {
    return Response.json({ error: "Could not build authorize URL" }, { status: 500 });
  }
  return Response.json({ url, state });
}

export async function handleIntegrationOAuthCallbackRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error");
  const origin = url.origin;

  if (error) {
    return Response.redirect(
      `${origin}/integrations?oauth=error&message=${encodeURIComponent(error)}`,
      302,
    );
  }
  if (!code || !state.includes(":")) {
    return Response.redirect(
      `${origin}/integrations?oauth=error&message=${encodeURIComponent("Missing OAuth code")}`,
      302,
    );
  }

  const providerId = state.split(":")[0] as IntegrationProviderId;
  const provider = getProvider(providerId);
  if (!provider.exchangeCode) {
    return Response.redirect(
      `${origin}/integrations?oauth=error&message=${encodeURIComponent("Provider does not support OAuth")}`,
      302,
    );
  }

  try {
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI || `${origin}/api/integrations/oauth/callback`;
    const creds = await provider.exchangeCode(code, redirectUri);
    const payload = encodeURIComponent(
      JSON.stringify({
        provider: providerId,
        credentials: creds,
        accountLabel: provider.name,
      }),
    );
    return Response.redirect(`${origin}/integrations?oauth=success&payload=${payload}`, 302);
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth exchange failed";
    return Response.redirect(
      `${origin}/integrations?oauth=error&message=${encodeURIComponent(message)}`,
      302,
    );
  }
}

export async function handleIntegrationSyncRequest(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      provider?: IntegrationProviderId;
      credentials?: IntegrationCredentials;
    };
    if (!body.provider) {
      return Response.json({ error: "provider is required" }, { status: 400 });
    }
    const provider = getProvider(body.provider);
    const creds = body.credentials || {};

    // Allow server env fallbacks for API-key providers when client sends empty creds
    const effective: IntegrationCredentials = {
      ...creds,
      apiKey:
        creds.apiKey ||
        (body.provider === "notion"
          ? process.env.NOTION_API_KEY
          : body.provider === "slack"
            ? process.env.SLACK_BOT_TOKEN
            : body.provider === "jira"
              ? process.env.JIRA_API_TOKEN
              : creds.apiKey),
      email: creds.email || process.env.JIRA_EMAIL,
      baseUrl: creds.baseUrl || process.env.JIRA_BASE_URL,
    };

    if (body.provider === "google-meet" && !effective.accessToken) {
      return Response.json(
        {
          error:
            "Google Meet requires OAuth. Click Connect and authorize Google, or ensure GOOGLE_CLIENT_ID/SECRET are set.",
        },
        { status: 400 },
      );
    }

    const docs = await provider.extractDocuments(effective);
    const enriched = [];
    for (const doc of docs) {
      const result = await summarizeContent(doc.title, doc.content);
      const reminders = remindersFromSummary(result, {
        provider: doc.provider,
        sourceDocId: doc.id,
        sourceLabel: doc.title,
      });
      enriched.push({
        document: {
          ...doc,
          summary: result.summary,
          actionItems: result.actionItems.map((a) => a.title),
          tags: [...(doc.tags || []), ...result.tags],
        },
        reminders,
      });
    }
    return Response.json({
      provider: body.provider,
      count: enriched.length,
      items: enriched,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
