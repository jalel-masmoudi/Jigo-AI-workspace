import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/health" && request.method === "GET") {
        const { handleHealthRequest } = await import("./lib/api-routes");
        return await handleHealthRequest();
      }

      if (url.pathname === "/api/chat" && request.method === "POST") {
        const { handleChatRequest } = await import("./lib/chat-api");
        return await handleChatRequest(request);
      }

      if (url.pathname === "/api/summarize" && request.method === "POST") {
        const { handleSummarizeRequest } = await import("./lib/api-routes");
        return await handleSummarizeRequest(request);
      }

      if (url.pathname === "/api/integrations/sync" && request.method === "POST") {
        const { handleIntegrationSyncRequest } = await import("./lib/api-routes");
        return await handleIntegrationSyncRequest(request);
      }

      if (url.pathname === "/api/integrations/status" && request.method === "GET") {
        const { handleIntegrationsStatusRequest } = await import("./lib/api-routes");
        return await handleIntegrationsStatusRequest();
      }

      if (url.pathname === "/api/integrations/authorize" && request.method === "POST") {
        const { handleIntegrationAuthorizeRequest } = await import("./lib/api-routes");
        return await handleIntegrationAuthorizeRequest(request);
      }

      if (url.pathname === "/api/integrations/oauth/callback" && request.method === "GET") {
        const { handleIntegrationOAuthCallbackRequest } = await import("./lib/api-routes");
        return await handleIntegrationOAuthCallbackRequest(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
