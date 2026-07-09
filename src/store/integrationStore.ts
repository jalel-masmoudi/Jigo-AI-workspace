import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  ExtractedDocument,
  IntegrationConnection,
  IntegrationProviderId,
  SyncJob,
} from "@/types/integrations";
import { INTEGRATION_CATALOG } from "@/lib/integrations/registry";
import type { IntegrationCredentials } from "@/lib/integrations/types";

export type StoredConnection = IntegrationConnection & {
  credentials?: IntegrationCredentials;
};

interface IntegrationState {
  connections: StoredConnection[];
  documents: ExtractedDocument[];
  jobs: SyncJob[];
  setCredentials: (
    id: IntegrationProviderId,
    creds: IntegrationCredentials,
    accountLabel?: string,
  ) => void;
  connectLocal: (id: IntegrationProviderId, accountLabel?: string) => void;
  disconnect: (id: IntegrationProviderId) => void;
  setStatus: (
    id: IntegrationProviderId,
    status: IntegrationConnection["status"],
    error?: string,
  ) => void;
  markSynced: (id: IntegrationProviderId) => void;
  upsertDocuments: (docs: ExtractedDocument[]) => void;
  updateDocument: (id: string, patch: Partial<ExtractedDocument>) => void;
  addJob: (job: SyncJob) => void;
  updateJob: (id: string, patch: Partial<SyncJob>) => void;
  getCredentials: (id: IntegrationProviderId) => IntegrationCredentials | undefined;
}

function defaultConnections(): StoredConnection[] {
  return INTEGRATION_CATALOG.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    status: "disconnected" as const,
  }));
}

export const useIntegrationStore = create<IntegrationState>()(
  persist(
    (set, get) => ({
      connections: defaultConnections(),
      documents: [],
      jobs: [],
      getCredentials: (id) => get().connections.find((c) => c.id === id)?.credentials,
      setCredentials: (id, creds, accountLabel) =>
        set((s) => ({
          connections: s.connections.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: "connected",
                  credentials: { ...c.credentials, ...creds },
                  accountLabel: accountLabel || c.accountLabel || c.name,
                  error: undefined,
                }
              : c,
          ),
        })),
      connectLocal: (id, accountLabel) =>
        set((s) => ({
          connections: s.connections.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: "connected",
                  accountLabel: accountLabel || c.name,
                  error: undefined,
                }
              : c,
          ),
        })),
      disconnect: (id) =>
        set((s) => ({
          connections: s.connections.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: "disconnected",
                  accountLabel: undefined,
                  lastSyncedAt: undefined,
                  error: undefined,
                  credentials: undefined,
                }
              : c,
          ),
        })),
      setStatus: (id, status, error) =>
        set((s) => ({
          connections: s.connections.map((c) => (c.id === id ? { ...c, status, error } : c)),
        })),
      markSynced: (id) =>
        set((s) => ({
          connections: s.connections.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: "connected",
                  lastSyncedAt: new Date().toISOString(),
                  error: undefined,
                }
              : c,
          ),
        })),
      upsertDocuments: (docs) =>
        set((s) => {
          const map = new Map(s.documents.map((d) => [d.id, d]));
          for (const d of docs) map.set(d.id, { ...map.get(d.id), ...d });
          return { documents: Array.from(map.values()) };
        }),
      updateDocument: (id, patch) =>
        set((s) => ({
          documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      addJob: (job) => set((s) => ({ jobs: [job, ...s.jobs].slice(0, 50) })),
      updateJob: (id, patch) =>
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
        })),
    }),
    {
      name: "jigo-integrations-v2",
      partialize: (s) => ({
        connections: s.connections,
        documents: s.documents,
        jobs: s.jobs,
      }),
    },
  ),
);
