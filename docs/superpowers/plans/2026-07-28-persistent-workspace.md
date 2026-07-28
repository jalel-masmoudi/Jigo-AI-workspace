# Persistent Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver a Supabase-backed Jigo workspace whose documents, reminders, integrations, and conversations persist per user, ground OpenRouter answers, and make every visible chat control work.

**Architecture:** The browser keeps small Zustand caches for responsive rendering, but cloud mode sends every workspace mutation through authenticated application endpoints. Those endpoints validate the Supabase bearer token, use a service-role client for private Storage and database work, and apply the verified user id to every repository query. A focused workspace domain module owns schema-aligned types, repository access, extraction, encryption, source selection, and API contracts.

**Tech Stack:** TanStack Start/Vite, React 19, TypeScript 5.8, Zustand 5, Supabase Auth/Postgres/Storage, @supabase/supabase-js, OpenRouter through AI SDK 3, Vitest 4, Testing Library, pdf-parse, mammoth, and xlsx.

## Global Constraints

- Keep Node.js at >=22.12.0 and do not upgrade the current AI SDK major version.
- Browser-visible variables are limited to VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_API_BASE_URL. SUPABASE_SERVICE_ROLE_KEY and INTEGRATION_CREDENTIALS_KEY remain server-only.
- Cloud workspace routes require SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and a base64-decoded 32-byte INTEGRATION_CREDENTIALS_KEY.
- Every workspace route derives userId from Authorization: Bearer <Supabase access token>; it never accepts a client-supplied owner id.
- Enable RLS on every workspace table. Policies target authenticated and use (select auth.uid()) = user_id; update policies have both USING and WITH CHECK.
- Keep the workspace-documents Storage bucket private with user-scoped paths: <user-id>/<document-id>/<filename>.
- Do not persist raw credentials in Zustand, local storage, URLs, or OAuth redirect payloads. Encrypt credentials with AES-256-GCM before storage.
- Accept PDF, DOCX, XLSX, CSV, Markdown, JSON, and UTF-8 text uploads up to 25 * 1024 * 1024 bytes. Preserve empty extractions with status unprocessable.
- Ground chat with at most 24_000 characters, preferring selected document ids, then keyword matches and newest records.
- The browser-local fallback remains only for local auth and visibly labels itself Local-only demo workspace.
- Pin all new packages with --save-exact and commit package-lock.json.
- Release requires Prettier, lint, typecheck, test, coverage, build, and a live Supabase RLS/Storage validation.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| supabase/migrations/*_persistent_workspace.sql | Schema, private bucket, RLS, storage policies, and update trigger. Generated with supabase migration new persistent_workspace. |
| src/lib/workspace/types.ts | Domain types shared by server, client, stores, and screens. |
| src/lib/workspace/server.ts | Server configuration, service-role client, verified request identity. |
| src/lib/workspace/repository.ts | User-scoped Postgres and Storage persistence. |
| src/lib/workspace/credentials.ts | AES-GCM credentials and signed OAuth state. |
| src/lib/workspace/extraction.ts | Validation and extraction by file type. |
| src/lib/workspace/source-context.ts | Deterministic source ranking and citation creation. |
| src/lib/workspace/api-routes.ts | Authenticated workspace endpoint handlers. |
| src/lib/workspace/client.ts | Browser request helpers with auth header. |
| src/lib/workspace/markdown.ts | Export and assistant-document conversion helpers. |
| src/components/workspace/WorkspaceBootstrap.tsx | Cloud hydration and local-mode label. |
| src/routes/_app.*.tsx | Durable document, integration, reminder, knowledge, and chat behavior. |

### Task 1: Create the Supabase schema and security boundary

**Files:**
- Create: output of supabase migration new persistent_workspace in supabase/migrations
- Create: src/lib/workspace/schema.test.ts
- Modify: .env.example
- Modify: README.md

**Interfaces:**
- Consumes: Supabase auth.users, storage.buckets, and storage.objects.
- Produces: workspace_documents, workspace_reminders, workspace_conversations, workspace_messages, and workspace_integrations.
- Produces: a private workspace-documents bucket and user-scoped storage policies.

- [ ] **Step 1: Verify tooling and Supabase guidance**

Run:

~~~powershell
supabase --version
supabase migration new persistent_workspace
~~~

Expected: one new migration named *_persistent_workspace.sql. Before editing it, fetch https://supabase.com/changelog.md plus current RLS and Storage policy docs, and record relevant breaking changes in the implementation notes.

- [ ] **Step 2: Write the failing migration contract test**

~~~ts
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

const [migration] = globSync("supabase/migrations/*_persistent_workspace.sql");
const sql = readFileSync(migration, "utf8");

describe("persistent workspace migration", () => {
  it("creates private user-scoped records and storage", () => {
    for (const table of [
      "workspace_documents",
      "workspace_reminders",
      "workspace_conversations",
      "workspace_messages",
      "workspace_integrations",
    ]) {
      expect(sql).toContain("alter table public." + table + " enable row level security");
      expect(sql).toContain("on public." + table);
      expect(sql).toContain("(select auth.uid()) = user_id");
    }
    expect(sql).toContain("'workspace-documents', 'workspace-documents', false");
    expect(sql).toContain("storage.foldername(name))[1] = (select auth.uid()::text)");
  });
});
~~~

- [ ] **Step 3: Run the test to verify it fails**

Run: npm test -- src/lib/workspace/schema.test.ts

Expected: FAIL because the migration does not yet contain the required tables and policy statements.

- [ ] **Step 4: Implement the migration and environment docs**

Create workspace_documents with provider constrained to upload, assistant, google-meet, notion, slack, and jira; content text not null default ''; action_items and tags JSONB defaults; storage_path, mime_type, size_bytes; and processed, unprocessable, failed status.

~~~sql
create table public.workspace_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('upload', 'assistant', 'google-meet', 'notion', 'slack', 'jira')),
  source_external_id text,
  title text not null,
  content text not null default '',
  summary text,
  action_items jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  status text not null default 'processed' check (status in ('processed', 'unprocessable', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index workspace_documents_provider_source_key
  on public.workspace_documents (user_id, provider, source_external_id)
  where source_external_id is not null;
~~~

Create reminders with source_document_id referencing documents on delete set null. Create conversations and messages with user_id, created_at, citations JSONB default, and conversation_id foreign key. Create integrations with primary key (user_id, provider), account_label, status, last_synced_at, credential_ciphertext, credential_iv, created_at, and updated_at.

Apply SELECT, INSERT, UPDATE, DELETE policies to every table. The document policy pattern is:

~~~sql
alter table public.workspace_documents enable row level security;
create policy workspace_documents_owner_select on public.workspace_documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy workspace_documents_owner_insert on public.workspace_documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workspace_documents_owner_update on public.workspace_documents
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy workspace_documents_owner_delete on public.workspace_documents
  for delete to authenticated using ((select auth.uid()) = user_id);
~~~

Add a private bucket and all four storage policies:

~~~sql
insert into storage.buckets (id, name, public)
values ('workspace-documents', 'workspace-documents', false)
on conflict (id) do update set public = false;

create policy workspace_documents_bucket_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'workspace-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy workspace_documents_bucket_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'workspace-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy workspace_documents_bucket_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'workspace-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'workspace-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy workspace_documents_bucket_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'workspace-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text));
~~~

Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and INTEGRATION_CREDENTIALS_KEY directly below browser Supabase variables in .env.example. Document this non-source-controlled key generation command:

~~~powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
~~~

- [ ] **Step 5: Verify schema work**

Run:

~~~powershell
npm test -- src/lib/workspace/schema.test.ts
git diff --check
~~~

Expected: PASS and no whitespace errors. If a project is linked, run supabase migration list --local and verify the migration appears once.

- [ ] **Step 6: Commit**

~~~powershell
git add supabase/migrations src/lib/workspace/schema.test.ts .env.example README.md
git commit -m "feat: add persistent workspace schema"
~~~

### Task 2: Define server contracts, verified identity, and repository

**Files:**
- Create: src/lib/workspace/types.ts
- Create: src/lib/workspace/server.ts
- Create: src/lib/workspace/repository.ts
- Create: src/lib/workspace/server.test.ts
- Create: src/lib/workspace/repository.test.ts
- Modify: src/types/index.ts

**Interfaces:**
- Produces: WorkspaceIdentity, WorkspaceDocument, WorkspaceReminder, WorkspaceConversation, WorkspaceMessage, WorkspaceIntegration, WorkspaceCitation, WorkspaceBootstrap, and WorkspaceRepository.
- Produces: requireWorkspaceIdentity(request): Promise<WorkspaceIdentity | Response>.
- Produces: createWorkspaceRepository(client): WorkspaceRepository.

- [ ] **Step 1: Write failing identity and repository scope tests**

~~~ts
import { describe, expect, it, vi } from "vitest";
import { createWorkspaceRepository } from "./repository";
import { requireWorkspaceIdentity } from "./server";

it("returns 401 without a bearer token", async () => {
  await expect(requireWorkspaceIdentity(new Request("https://app.test/api/workspace/bootstrap")))
    .resolves.toMatchObject({ status: 401 });
});

it("uses the verified identity in every document query", async () => {
  const eq = vi.fn().mockReturnThis();
  const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq, order: vi.fn() })) })) } as never;
  await createWorkspaceRepository(client).listDocuments("user-a");
  expect(eq).toHaveBeenCalledWith("user_id", "user-a");
});
~~~

- [ ] **Step 2: Run tests to verify they fail**

Run: npm test -- src/lib/workspace/server.test.ts src/lib/workspace/repository.test.ts

Expected: FAIL because the workspace contracts and exports do not exist.

- [ ] **Step 3: Implement the contract and repository**

Define:

~~~ts
export type WorkspaceProvider = "upload" | "assistant" | IntegrationProviderId;
export type WorkspaceDocumentStatus = "processed" | "unprocessable" | "failed";
export type WorkspaceRole = "user" | "assistant" | "system";

export interface WorkspaceCitation {
  documentId: string;
  title: string;
  provider: WorkspaceProvider;
}

export interface WorkspaceMessage {
  id: string;
  conversationId: string;
  role: WorkspaceRole;
  content: string;
  citations: WorkspaceCitation[];
  createdAt: string;
}

export interface WorkspaceBootstrap {
  documents: WorkspaceDocument[];
  reminders: WorkspaceReminder[];
  conversations: WorkspaceConversation[];
  messages: Record<string, WorkspaceMessage[]>;
  integrations: WorkspaceIntegration[];
}
~~~

Create a service-role client with auth persistence disabled. Validate the bearer token through admin.auth.getUser(token):

~~~ts
export async function requireWorkspaceIdentity(
  request: Request,
): Promise<WorkspaceIdentity | Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await getWorkspaceAdmin().auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "Invalid session" }, { status: 401 });
  return { userId: data.user.id, accessToken: token };
}
~~~

Repository methods are listBootstrap, listDocuments, insertUpload, upsertSyncedDocument, insertReminders, updateReminder, createConversation, replaceConversationMessages, upsertIntegration, getIntegrationCredentials, and deleteIntegration. Every select/update/delete must filter .eq("user_id", userId), including service-role operations.

- [ ] **Step 4: Run focused tests**

Run:

~~~powershell
npm test -- src/lib/workspace/server.test.ts src/lib/workspace/repository.test.ts
npm run typecheck
~~~

Expected: PASS. The test proves a request cannot choose another owner through a body field.

- [ ] **Step 5: Commit**

~~~powershell
git add src/lib/workspace src/types/index.ts
git commit -m "feat: add authenticated workspace repository"
~~~

### Task 3: Add AES-GCM credentials and document extraction

**Files:**
- Create: src/lib/workspace/credentials.ts
- Create: src/lib/workspace/extraction.ts
- Create: src/lib/workspace/credentials.test.ts
- Create: src/lib/workspace/extraction.test.ts
- Modify: package.json
- Modify: package-lock.json

**Interfaces:**
- Produces: encryptCredentials(value), decryptCredentials(value), createOAuthState(input), readOAuthState(state), extractDocumentText(file), and UploadValidationError.
- Produces: ExtractionResult with content, mimeType, and status processed or unprocessable.

- [ ] **Step 1: Add exact dependencies**

Run:

~~~powershell
npm install --save-exact pdf-parse mammoth xlsx
npm install --save-dev --save-exact @testing-library/react @testing-library/user-event jsdom
~~~

Expected: exact package versions and a changed package-lock.json; no AI SDK major upgrade.

- [ ] **Step 2: Write failing crypto and extraction tests**

~~~ts
import { describe, expect, it, vi } from "vitest";
import { decryptCredentials, encryptCredentials } from "./credentials";
import { extractDocumentText } from "./extraction";

it("round-trips credentials without plaintext in stored fields", () => {
  const encrypted = encryptCredentials({ apiKey: "secret-token", email: "me@example.com" });
  expect(encrypted.ciphertext).not.toContain("secret-token");
  expect(encrypted.iv).not.toContain("secret-token");
  expect(decryptCredentials(encrypted)).toEqual({ apiKey: "secret-token", email: "me@example.com" });
});

it("extracts CSV and marks empty PDF unprocessable", async () => {
  const csv = new File(["owner,task\nMaya,Publish"], "tasks.csv", { type: "text/csv" });
  await expect(extractDocumentText(csv)).resolves.toMatchObject({
    status: "processed",
    content: expect.stringContaining("Publish"),
  });
  vi.mock("pdf-parse", () => ({ default: vi.fn().mockResolvedValue({ text: "" }) }));
  await expect(extractDocumentText(new File(["fake"], "scan.pdf"))).resolves.toMatchObject({
    status: "unprocessable",
  });
});
~~~

- [ ] **Step 3: Run tests to verify they fail**

Run: npm test -- src/lib/workspace/credentials.test.ts src/lib/workspace/extraction.test.ts

Expected: FAIL because neither module exists.

- [ ] **Step 4: Implement secure primitives**

Require a base64-decoded 32-byte key, create a 12-byte IV, and store ciphertext plus GCM tag in the ciphertext column:

~~~ts
const cipher = createCipheriv("aes-256-gcm", key, iv);
const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();
return {
  ciphertext: ciphertext.toString("base64") + "." + tag.toString("base64"),
  iv: iv.toString("base64"),
};
~~~

Decrypt by requiring one delimiter, calling decipher.setAuthTag(tag), and throwing Error("Stored integration credentials cannot be decrypted") for malformed or tampered values. OAuth state is HMAC-protected JSON with provider, userId, and expiresAt; compare HMAC values with timingSafeEqual and reject values older than ten minutes.

Extraction rejects >25 MB and every extension outside pdf, docx, xlsx, csv, md, markdown, json, txt. Read arrayBuffer once. Use pdfParse for PDF, mammoth.extractRawText for DOCX, XLSX.read then XLSX.utils.sheet_to_csv for XLSX/CSV, and TextDecoder utf-8 for text formats. Trim result and return content "" with unprocessable status when no text remains.

- [ ] **Step 5: Verify dependencies and primitives**

Run:

~~~powershell
npm test -- src/lib/workspace/credentials.test.ts src/lib/workspace/extraction.test.ts
npm run typecheck
npm audit --omit=dev --audit-level=high
~~~

Expected: PASS, zero new production high/critical audit result.

- [ ] **Step 6: Commit**

~~~powershell
git add package.json package-lock.json src/lib/workspace
git commit -m "feat: add encrypted credentials and file extraction"
~~~

### Task 4: Implement authenticated workspace routes

**Files:**
- Create: src/lib/workspace/api-routes.ts
- Create: src/lib/workspace/api-routes.test.ts
- Modify: src/server.ts
- Modify: src/lib/api-routes.ts

**Interfaces:**
- Produces: createWorkspaceHandlers(deps), bootstrap, upload, patchReminder, createConversation, and saveMessage handlers.
- Produces: GET /api/workspace/bootstrap, POST /api/documents/upload, PATCH /api/reminders/:id, POST /api/conversations, and POST /api/conversations/:id/messages.

- [ ] **Step 1: Write failing endpoint tests using dependency injection**

~~~ts
import { expect, it } from "vitest";
import { createWorkspaceHandlers } from "./api-routes";

const handlers = createWorkspaceHandlers({
  authenticate: async () => ({ userId: "user-a", accessToken: "token" }),
  repository: {
    listBootstrap: async () => ({
      documents: [], reminders: [], conversations: [], messages: {}, integrations: [],
    }),
  } as never,
});

it("does not let a body choose the bootstrap owner", async () => {
  const response = await handlers.bootstrap(
    new Request("https://app.test/api/workspace/bootstrap", {
      headers: { authorization: "Bearer token" },
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ documents: [], conversations: [] });
});

it("rejects an upload without a file before storage writes", async () => {
  const response = await handlers.upload(
    new Request("https://app.test/api/documents/upload", { method: "POST" }),
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "file is required" });
});
~~~

- [ ] **Step 2: Run the endpoint test to verify it fails**

Run: npm test -- src/lib/workspace/api-routes.test.ts

Expected: FAIL because createWorkspaceHandlers is absent.

- [ ] **Step 3: Implement durable handlers and dispatch**

bootstrap calls repository.listBootstrap(identity.userId). upload reads FormData, requires a File, extracts text, creates a UUID, uploads to workspace-documents at userId/documentId/safeFilename, summarizes nonempty content, persists document and reminders, and returns status 201:

~~~ts
return Response.json({ document, reminders }, { status: 201 });
~~~

PATCH reminders accepts only completed and dueAt, rejects an empty patch, and calls repository.updateReminder(identity.userId, id, patch). Conversation create accepts title and validated ChatModelId. Saved message accepts role, content, and citations but uses the URL conversation id and verified identity.

Dispatch paths in src/server.ts before SSR:

~~~ts
if (url.pathname === "/api/workspace/bootstrap" && request.method === "GET") {
  return handlers.bootstrap(request);
}
if (url.pathname === "/api/documents/upload" && request.method === "POST") {
  return handlers.upload(request);
}
if (url.pathname.startsWith("/api/reminders/") && request.method === "PATCH") {
  return handlers.patchReminder(request, url);
}
~~~

Keep /api/summarize but share its validation and summary helper with upload/sync.

- [ ] **Step 4: Verify handler integration**

Run:

~~~powershell
npm test -- src/lib/workspace/api-routes.test.ts src/lib/api-routes.test.ts
npm run typecheck
~~~

Expected: PASS, including existing health, summarize, and integration validation tests.

- [ ] **Step 5: Commit**

~~~powershell
git add src/lib/workspace/api-routes.ts src/lib/workspace/api-routes.test.ts src/server.ts src/lib/api-routes.ts
git commit -m "feat: add durable workspace APIs"
~~~

### Task 5: Persist integration connections and sync results without browser tokens

**Files:**
- Modify: src/lib/api-routes.ts
- Modify: src/lib/workspace/api-routes.ts
- Create: src/lib/workspace/integrations.test.ts
- Modify: src/server.ts
- Modify: src/store/integrationStore.ts
- Modify: src/store/additional-state.test.ts

**Interfaces:**
- Produces: POST /api/integrations/connect, POST /api/integrations/sync, DELETE /api/integrations/:provider.
- Produces: integration store data without credentials, setCredentials, or getCredentials.
- Consumes: encryptCredentials, decryptCredentials, readOAuthState, WorkspaceRepository, and existing provider adapters.

- [ ] **Step 1: Write failing isolation and durable sync tests**

~~~ts
it("stores submitted credentials encrypted and never returns them", async () => {
  const response = await handlers.connect(
    jsonRequest({ provider: "notion", credentials: { apiKey: "secret" } }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(
    expect.not.objectContaining({ credentials: expect.anything() }),
  );
  expect(repository.upsertIntegration).toHaveBeenCalledWith(
    expect.objectContaining({ credentialCiphertext: expect.not.stringContaining("secret") }),
  );
});

it("does not retain tokens in integration Zustand state", () => {
  expect("setCredentials" in useIntegrationStore.getState()).toBe(false);
  expect(JSON.stringify(useIntegrationStore.getState())).not.toContain("apiKey");
});
~~~

- [ ] **Step 2: Run the tests to verify they fail**

Run: npm test -- src/lib/workspace/integrations.test.ts src/store/additional-state.test.ts

Expected: FAIL because current integration state contains credentials.

- [ ] **Step 3: Implement secure connect, sync, disconnect, and OAuth**

Connect validates provider, encrypts nonempty credential fields, upserts only encrypted values and connection metadata, and returns WorkspaceIntegration without a credential property. Sync body is only { provider }. It decrypts that verified user's saved credentials, merges server environment fallback values, calls extractDocuments, summarizes each document, upserts by user/provider/source external id, creates reminders using durable document UUIDs, and updates last_synced_at.

Replace OAuth redirect payload behavior. The authorization endpoint signs provider/userId/expiresAt. The callback verifies state, exchanges code, encrypts values, persists the integration, and redirects only to:

~~~ts
origin + "/integrations?oauth=success&provider=" + encodeURIComponent(state.provider)
~~~

Disconnect deletes the verified user's row and returns 204. Keep /api/integrations/status configuration-only and public.

Remove StoredConnection.credentials, setCredentials, and getCredentials. Persist only connection metadata, documents, and jobs.

- [ ] **Step 4: Verify new and existing provider tests**

Run:

~~~powershell
npm test -- src/lib/workspace/integrations.test.ts src/lib/integrations/providers.test.ts src/lib/api-routes.test.ts src/store/additional-state.test.ts
~~~

Expected: PASS. The existing mock suite still validates live-provider request shapes.

- [ ] **Step 5: Commit**

~~~powershell
git add src/lib/api-routes.ts src/lib/workspace src/server.ts src/store/integrationStore.ts src/store/additional-state.test.ts
git commit -m "feat: persist integration sync data securely"
~~~

### Task 6: Ground and persist chat answers with a validated model allowlist

**Files:**
- Create: src/lib/workspace/models.ts
- Create: src/lib/workspace/source-context.ts
- Create: src/lib/workspace/source-context.test.ts
- Modify: src/lib/chat-api.ts
- Create: src/lib/chat-api.test.ts
- Modify: src/server.ts

**Interfaces:**
- Produces: CHAT_MODELS, ChatModelId, isChatModelId, buildSourceContext, and an authenticated handleChatRequest.
- Consumes: verified identity, WorkspaceRepository, WorkspaceDocument[], source citations, and the installed AI SDK data-stream API.
- Produces: persisted user and assistant messages, with exact assistant citations.

- [ ] **Step 1: Check model availability and write failing source tests**

Run before finalizing model ids:

~~~powershell
curl.exe -s https://openrouter.ai/api/v1/models | Select-String -Pattern 'hermes|gpt|claude' -CaseSensitive:$false
~~~

Keep Hermes as default if current catalog exposes it. Otherwise change OPENROUTER_MODEL, the visible label, README, and model constant together. Then write:

~~~ts
import { expect, it } from "vitest";
import { buildSourceContext } from "./source-context";

it("prefers attached caller documents and excludes another user", () => {
  const result = buildSourceContext({
    query: "launch status",
    preferredDocumentIds: ["attached"],
    userId: "user-a",
    documents: [
      { id: "attached", userId: "user-a", title: "Launch notes", content: "launch status confirmed", provider: "upload", updatedAt: "2026-07-28T10:00:00Z" },
      { id: "other", userId: "user-b", title: "Private", content: "do not include", provider: "upload", updatedAt: "2026-07-28T10:00:00Z" },
    ],
  });
  expect(result.citations).toEqual([{ documentId: "attached", title: "Launch notes", provider: "upload" }]);
  expect(result.context).toContain("launch status confirmed");
  expect(result.context).not.toContain("do not include");
  expect(result.context.length).toBeLessThanOrEqual(24_000);
});
~~~

- [ ] **Step 2: Run tests to verify they fail**

Run: npm test -- src/lib/workspace/source-context.test.ts src/lib/chat-api.test.ts

Expected: FAIL because chat does not load persistent documents or validate models.

- [ ] **Step 3: Implement model validation, ranking, and streamed persistence**

Start with one typed constant:

~~~ts
export const CHAT_MODELS = {
  "nousresearch/hermes-3-llama-3.1-405b": "Hermes 3",
  "openai/gpt-4o": "GPT-4o",
  "anthropic/claude-3.5-sonnet": "Claude Sonnet",
} as const;
export type ChatModelId = keyof typeof CHAT_MODELS;
export const isChatModelId = (value: unknown): value is ChatModelId =>
  typeof value === "string" && value in CHAT_MODELS;
~~~

Replace any unavailable catalog id before committing. Source ranking filters userId equality, scores preferred ids at 10_000, adds a point for each query token found in title, summary, tags, or content, breaks ties by updatedAt descending, and appends this block until 24_000 characters:

~~~text
[Source: <title> | id: <id>]
<excerpt>
~~~

handleChatRequest requires identity, conversationId, messages, and allowed model. It loads repository.listDocuments(identity.userId), stores the final user message, and calls streamText with an instruction to use only supplied workspace sources for factual workspace claims, cite titles in brackets, and say when sources do not answer. After checking the installed ai package documentation and source, use its supported data-stream mechanism to send citations; do not hand-write protocol frames. The onFinish callback persists assistant text and the same citation array. Preserve the explicit no-key answer and persist it with no citations.

- [ ] **Step 4: Verify chat behavior**

Run:

~~~powershell
npm test -- src/lib/workspace/source-context.test.ts src/lib/chat-api.test.ts
npm run typecheck
~~~

Expected: PASS. Add API assertions that arbitrary/provider returns 400 { error: "Unsupported chat model" } and user-b sources are absent from a user-a prompt.

- [ ] **Step 5: Commit**

~~~powershell
git add src/lib/workspace/models.ts src/lib/workspace/source-context.ts src/lib/workspace/*.test.ts src/lib/chat-api.ts src/server.ts README.md
git commit -m "feat: ground chat in workspace documents"
~~~

### Task 7: Hydrate cloud state and preserve the local-only demo

**Files:**
- Create: src/lib/workspace/client.ts
- Create: src/components/workspace/WorkspaceBootstrap.tsx
- Create: src/components/workspace/WorkspaceBootstrap.test.tsx
- Modify: src/routes/_app.tsx
- Modify: src/store/chatStore.ts
- Modify: src/store/documentStore.ts
- Modify: src/store/reminderStore.ts
- Modify: src/store/integrationStore.ts
- Modify: src/store/state.test.ts
- Modify: vitest.config.ts

**Interfaces:**
- Produces: workspaceFetch, getWorkspaceBootstrap, uploadWorkspaceDocument, and patchWorkspaceReminder.
- Produces: hydrateFromWorkspace(bootstrap) and replaceFromWorkspace(records) store actions.
- Consumes: useAuthStore session, isSupabaseConfigured, and WorkspaceBootstrap.

- [ ] **Step 1: Configure jsdom and write failing hydration test**

Add this Vitest option:

~~~ts
environmentMatchGlobs: [["src/components/**/*.test.tsx", "jsdom"]],
~~~

Then write:

~~~tsx
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { WorkspaceBootstrap } from "./WorkspaceBootstrap";

it("hydrates cloud records and labels local mode", async () => {
  vi.mock("@/lib/workspace/client", () => ({
    getWorkspaceBootstrap: vi.fn().mockResolvedValue({
      documents: [{ id: "doc-1", title: "Plan" }],
      reminders: [], conversations: [], messages: {}, integrations: [],
    }),
  }));
  render(<WorkspaceBootstrap mode="supabase"><div>screen</div></WorkspaceBootstrap>);
  await waitFor(() =>
    expect(useDocumentStore.getState().documents[0]).toMatchObject({ id: "doc-1", name: "Plan" }),
  );
  render(<WorkspaceBootstrap mode="local"><div>screen</div></WorkspaceBootstrap>);
  expect(screen.getByText("Local-only demo workspace")).toBeInTheDocument();
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: npm test -- src/components/workspace/WorkspaceBootstrap.test.tsx src/store/state.test.ts

Expected: FAIL because cloud hydration and the local-mode label are absent.

- [ ] **Step 3: Implement browser helpers and conditional persistence**

workspaceFetch gets useAuthStore.getState().session?.access_token, throws Error("Sign in to access the shared workspace") when absent, and merges Authorization with every request. getWorkspaceBootstrap calls GET /api/workspace/bootstrap; upload posts FormData with one file; patch reminder sends JSON to /api/reminders/:id.

WorkspaceBootstrap waits for waitUntilReady, calls bootstrap only in supabase mode with a session, then hydrates every store. On failure it leaves the previous cache visible and shows a compact retry action. It renders Local-only demo workspace in the app chrome only when mode is local.

Add hydrateFromWorkspace to all four stores. In Supabase mode, use persist partialize: () => ({}) so stale browser data cannot become cloud data. In local mode, retain the existing persistence. Keep one mapper WorkspaceDocument to DocumentItem: title to name, sizeBytes to formatted size, createdAt to uploadedAt.

Render WorkspaceBootstrap immediately inside RequireAuth in src/routes/_app.tsx.

- [ ] **Step 4: Verify components and state**

Run:

~~~powershell
npm test -- src/components/workspace/WorkspaceBootstrap.test.tsx src/store/state.test.ts src/store/additional-state.test.ts
npm run typecheck
~~~

Expected: PASS. Hydration replaces stale records rather than appending them.

- [ ] **Step 5: Commit**

~~~powershell
git add vitest.config.ts src/lib/workspace/client.ts src/components/workspace src/routes/_app.tsx src/store
git commit -m "feat: hydrate workspace state from Supabase"
~~~

### Task 8: Wire documents, knowledge, reminders, and integrations to durable mutations

**Files:**
- Modify: src/routes/_app.documents.tsx
- Modify: src/routes/_app.knowledge.tsx
- Modify: src/routes/_app.reminders.tsx
- Modify: src/routes/_app.integrations.tsx
- Create: src/routes/workspace-screens.test.tsx

**Interfaces:**
- Consumes: uploadWorkspaceDocument, patchWorkspaceReminder, integration connect/sync/disconnect APIs, and hydrated workspace records.
- Produces: upload status/error UI, persisted reminder changes, a token-free connection dialog, and a single durable source for Documents and Knowledge.

- [ ] **Step 1: Write failing screen-action tests**

~~~tsx
it("uploads a selected file and renders the server-confirmed document", async () => {
  const user = userEvent.setup();
  vi.mocked(uploadWorkspaceDocument).mockResolvedValue({
    document: { id: "doc-1", title: "Roadmap.pdf", status: "processed" },
    reminders: [],
  } as never);
  render(<DocumentsPage />);
  await user.upload(
    screen.getByLabelText("Choose files"),
    new File(["roadmap"], "Roadmap.pdf", { type: "application/pdf" }),
  );
  expect(await screen.findByText("Roadmap.pdf")).toBeInTheDocument();
});

it("persists reminder completion before updating the cache", async () => {
  vi.mocked(patchWorkspaceReminder).mockResolvedValue({ id: "rem-1", completed: true } as never);
  render(<RemindersPage />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Done" }));
  expect(patchWorkspaceReminder).toHaveBeenCalledWith("rem-1", { completed: true });
});
~~~

- [ ] **Step 2: Run the screen tests to verify they fail**

Run: npm test -- src/routes/workspace-screens.test.tsx

Expected: FAIL because uploads and reminders currently mutate browser stores only.

- [ ] **Step 3: Implement persistent screen behavior**

Documents replaces handleFiles placeholders with sequential await uploadWorkspaceDocument(file). It shows a fixed processing row, replaces that row using the returned document, and displays errors without closing them away. Update format copy to PDF, DOCX, XLSX, CSV, Markdown, JSON, or text up to 25 MB.

Knowledge derives both folders from hydrated workspace documents: upload or assistant provider is Uploads; four integration providers are Integrations. It no longer concatenates two unrelated local stores.

Reminders calls patchWorkspaceReminder before replacing the cache. An optimistic update restores the previous value and shows the returned error when persistence fails.

Integrations posts credentials once to /api/integrations/connect and clears the form immediately. Sync posts only provider to /api/integrations/sync and replaces cache records from durable response. Disconnect calls DELETE /api/integrations/:provider. OAuth success refreshes bootstrap and never reads a payload URL parameter. Show server configuration and account connection as separate badges.

- [ ] **Step 4: Verify durable UI behavior**

Run:

~~~powershell
npm test -- src/routes/workspace-screens.test.tsx src/lib/workspace/integrations.test.ts
npm run lint
~~~

Expected: PASS with no new lint warnings.

- [ ] **Step 5: Commit**

~~~powershell
git add src/routes/_app.documents.tsx src/routes/_app.knowledge.tsx src/routes/_app.reminders.tsx src/routes/_app.integrations.tsx src/routes/workspace-screens.test.tsx
git commit -m "feat: persist workspace screen actions"
~~~

### Task 9: Make every chat control functional

**Files:**
- Create: src/lib/workspace/markdown.ts
- Create: src/lib/workspace/markdown.test.ts
- Modify: src/routes/_app.chat.tsx
- Create: src/routes/chat-controls.test.tsx
- Modify: src/store/chatStore.ts

**Interfaces:**
- Consumes: CHAT_MODELS, ChatModelId, WorkspaceMessage, WorkspaceCitation, workspaceFetch, uploadWorkspaceDocument, and markdownForConversation.
- Produces: model selection, document attachment, copy feedback, regeneration, Markdown export, and response save.
- Produces: markdownForConversation(conversation, messages) and assistantMessageAsDocument(message, title).

- [ ] **Step 1: Write failing control tests**

~~~tsx
it("copies an assistant answer and confirms success", async () => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  render(<ChatArea id="conv-1" initialMessages={[assistantMessage("Answer")]} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Copy" }));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Answer");
  expect(await screen.findByText("Copied")).toBeInTheDocument();
});

it("exports citations in Markdown", () => {
  expect(
    markdownForConversation(
      { id: "c1", title: "Launch" },
      [assistantMessage("Answer", [{ documentId: "d1", title: "Plan", provider: "upload" }])],
    ),
  ).toContain("Sources: Plan");
});

it("regenerates from the messages before the latest assistant answer", async () => {
  render(<ChatArea id="conv-1" initialMessages={[userMessage("Question"), assistantMessage("Old answer")]} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Regenerate" }));
  expect(mockAppend).toHaveBeenCalledWith(
    expect.objectContaining({ role: "user", content: "Question" }),
    expect.objectContaining({ body: expect.stringContaining("conv-1") }),
  );
});
~~~

- [ ] **Step 2: Run control tests to verify they fail**

Run: npm test -- src/lib/workspace/markdown.test.ts src/routes/chat-controls.test.tsx

Expected: FAIL because visible controls have no handlers.

- [ ] **Step 3: Implement all control contracts**

Populate the model menu from CHAT_MODELS and persist valid changes through the conversation API. Send conversationId, model, and preferredDocumentIds in the useChat request body. Render citations beneath assistant messages as source-title buttons.

Attachment is a labeled hidden file input. It uploads selected files, keeps returned ids in preferredDocumentIds, renders removable chips, and fails visibly without submitting an empty request. Copy uses navigator.clipboard.writeText(message.content), changes label to Copied for two seconds, and reports failure. Regenerate removes the latest assistant answer from the local view, submits its preceding user message and conversation body, and lets the server replace the existing assistant record. Export creates a text/markdown Blob, clicks a download anchor with sanitized-title.md, and revokes the object URL. Save opens a title dialog defaulting to Response - <date>, posts an assistant workspace document, and inserts the returned document cache record.

Implement export as:

~~~ts
export function markdownForConversation(
  conversation: Pick<WorkspaceConversation, "title">,
  messages: WorkspaceMessage[],
) {
  return [
    "# " + conversation.title,
    "",
    ...messages.flatMap((message) => [
      "## " + (message.role === "assistant" ? "Jigo" : "You"),
      "",
      message.content,
      ...(message.citations.length
        ? ["Sources: " + message.citations.map((citation) => citation.title).join(", ")]
        : []),
      "",
    ]),
  ].join("\n");
}
~~~

- [ ] **Step 4: Verify chat controls**

Run:

~~~powershell
npm test -- src/lib/workspace/markdown.test.ts src/routes/chat-controls.test.tsx src/lib/chat-api.test.ts
npm run typecheck
~~~

Expected: PASS. Check Enter submits once, Shift+Enter adds a newline, and all icon-only controls have accessible names/tooltips.

- [ ] **Step 5: Commit**

~~~powershell
git add src/lib/workspace/markdown.ts src/lib/workspace/markdown.test.ts src/routes/_app.chat.tsx src/routes/chat-controls.test.tsx src/store/chatStore.ts
git commit -m "feat: make chat controls functional"
~~~

### Task 10: Perform release verification in a real Supabase project

**Files:**
- Create: docs/validation/persistent-workspace-checklist.md
- Create: src/lib/workspace/release-checklist.test.ts
- Modify: README.md
- Modify: .github/workflows/ci.yml

**Interfaces:**
- Consumes: linked non-production Supabase project, two test users, private bucket, OpenRouter key, and one integration credential.
- Produces: reproducible release validation and CI coverage of workspace tests.

- [ ] **Step 1: Write the failing live-validation document test**

~~~ts
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("documents all required live validation checks", () => {
  const checklist = readFileSync("docs/validation/persistent-workspace-checklist.md", "utf8");
  expect(checklist).toContain("two separate Supabase users");
  expect(checklist).toContain("private workspace-documents bucket");
  expect(checklist).toContain("OpenRouter citation");
  expect(checklist).toContain("integration credential is absent from local storage");
});
~~~

- [ ] **Step 2: Run it to verify it fails**

Run: npm test -- src/lib/workspace/release-checklist.test.ts

Expected: FAIL because no validation checklist exists.

- [ ] **Step 3: Write the release checklist and update CI/docs**

The checklist must require:

~~~text
1. Apply the migration to a non-production Supabase project and confirm RLS on every workspace table.
2. With user A, upload a CSV and confirm the private object path begins with user A's UUID.
3. With user B, verify bootstrap, direct Data API, and Storage cannot read user A's document, reminder, conversation, or object.
4. Connect Notion or Slack, sync, reload as user A, and confirm records return while local storage has no apiKey, accessToken, refreshToken, or credentialCiphertext.
5. Ask a question naming the CSV and confirm the OpenRouter answer has a citation for its title and persists after reload.
6. Exercise model selection, attachment, Copy, Regenerate, Export, and Save; confirm saved answer appears in Documents and Knowledge.
7. Remove VITE_SUPABASE_URL, sign in locally, and confirm the Local-only demo workspace label plus browser-only behavior.
~~~

Keep Node 22 CI and ensure npm test includes all ts and tsx test files. README must state production validation is incomplete until this checklist passes with real keys.

- [ ] **Step 4: Run the complete automated gate**

Run:

~~~powershell
npx prettier --check .
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build -- --logLevel error
git diff --check
~~~

Expected: every command exits 0. Investigate uncovered branches in authentication, ownership, upload validation, and model validation.

- [ ] **Step 5: Run live validation and manual smoke testing**

Apply migration to a non-production linked project, perform all seven checklist steps, then run npm run dev -- --port 4173 and verify http://localhost:4173 returns 200. Use browser automation when available; otherwise record the manual result and unavailable browser capability. Do not claim a live provider is validated without genuine provider credentials.

- [ ] **Step 6: Commit and prepare direct-main release only with renewed confirmation**

~~~powershell
git add README.md .github/workflows/ci.yml docs/validation src/lib/workspace/release-checklist.test.ts
git commit -m "docs: add persistent workspace validation checklist"
git status --short
git log --oneline -10
~~~

Expected: a clean worktree and focused commits. Confirm the user still wants a direct push to main immediately before git push origin main.

## Plan Self-Review

**Spec coverage:** Tasks 1, 2, 4, and 7 persist documents, reminders, conversations, messages, and integration metadata. Tasks 1, 3, 4, and 8 cover private Storage, extraction, size validation, and unprocessable documents. Task 6 provides bounded grounded chat and citations; Task 9 renders citations and implements every visible chat control. Tasks 3 and 5 remove browser tokens and encrypt server persistence. Task 7 preserves local mode with visible demo labeling. Tasks 1, 2, 4, 6, and 10 cover authorization, RLS, ownership tests, and real-project verification.

**Placeholder scan:** No deferred implementation markers are present. The migration path is intentionally the concrete output of supabase migration new persistent_workspace, which is required by the Supabase CLI workflow.

**Type consistency:** WorkspaceDocument, WorkspaceReminder, WorkspaceConversation, WorkspaceMessage, WorkspaceIntegration, WorkspaceCitation, WorkspaceBootstrap, WorkspaceRepository, ChatModelId, and WorkspaceIdentity are defined before later tasks use them. Credential functions precede integration persistence; source selection precedes chat rendering.

## Operational Note

The requested ponytail@ponytail Codex plugin is unavailable to this session's plugin-management tools, and the host blocks direct codex.exe execution. It is not a project runtime dependency. Install it from a host terminal that can run the Codex CLI:

~~~powershell
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
~~~
