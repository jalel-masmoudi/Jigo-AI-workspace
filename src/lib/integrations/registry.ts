import type { IntegrationProviderId } from "@/types/integrations";
import { googleMeetProvider, jiraProvider, notionProvider, slackProvider } from "./providers";
import type { IntegrationProvider } from "./types";
import { INTEGRATION_CATALOG } from "./types";

const providers: Record<IntegrationProviderId, IntegrationProvider> = {
  "google-meet": googleMeetProvider,
  notion: notionProvider,
  slack: slackProvider,
  jira: jiraProvider,
};

export function getProvider(id: IntegrationProviderId): IntegrationProvider {
  return providers[id];
}

export function listProviders(): IntegrationProvider[] {
  return Object.values(providers);
}

export function getProviderStatus(id: IntegrationProviderId) {
  const p = providers[id];
  const meta = INTEGRATION_CATALOG.find((c) => c.id === id)!;
  return {
    id,
    name: p.name,
    description: p.description,
    configured: p.isConfigured(),
    authType: meta.authType,
    envHint: meta.envHint,
    supportsOAuth: Boolean(p.getAuthorizeUrl),
  };
}

export { INTEGRATION_CATALOG };
