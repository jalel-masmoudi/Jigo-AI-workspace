# Persistent Workspace Design

**Goal:** Turn Jigo AI Workspace from a browser-local demo into a shared, Supabase-backed workspace with grounded AI chat, durable documents and reminders, secure integration credentials, and functional chat controls.

## Scope

- Persist workspace documents, reminders, conversations, messages, integration metadata, and sync results per Supabase user.
- Store uploaded source files in a private Supabase Storage bucket and extract text server-side.
- Ground chat requests with persisted document excerpts and expose the cited source names in the response.
- Keep integration tokens out of browser storage; encrypt them on the server before persistence.
- Make model selection, attachment, copy, regenerate, export, and save controls perform the behavior their labels promise.
- Retain local authentication only as non-shared demo mode when Supabase is not configured.

## Runtime Configuration

The deployed server requires the following server-only variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTEGRATION_CREDENTIALS_KEY` - a 32-byte key encoded as base64 for AES-256-GCM encryption
- `OPENROUTER_API_KEY` and optional `OPENROUTER_MODEL`

The browser requires only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The service-role key and integration-encryption key must never use the `VITE_` prefix or be sent to the browser.

## Data Model

All rows are owned by `auth.uid()` and protected by row-level security.

| Table | Purpose | Important columns |
| --- | --- | --- |
| `workspace_documents` | Uploads and synced source content | `id`, `user_id`, `provider`, `title`, `content`, `summary`, `action_items`, `tags`, `storage_path`, `created_at`, `updated_at` |
| `workspace_reminders` | AI-generated follow-ups | `id`, `user_id`, `source_document_id`, `title`, `description`, `due_at`, `priority`, `completed`, `created_at` |
| `workspace_conversations` | Durable chat threads | `id`, `user_id`, `title`, `model`, `created_at`, `updated_at` |
| `workspace_messages` | Durable chat history and citations | `id`, `conversation_id`, `user_id`, `role`, `content`, `citations`, `created_at` |
| `workspace_integrations` | Connection and sync metadata | `provider`, `user_id`, `account_label`, `status`, `last_synced_at`, `credential_ciphertext`, `credential_iv`, `created_at`, `updated_at` |

The `workspace-documents` Storage bucket is private. Storage paths are scoped as `<user-id>/<document-id>/<filename>`.

## Server Contract

Every workspace endpoint receives the Supabase access token through `Authorization: Bearer <token>`. The server validates the token, derives the user id, and performs privileged storage/database work without trusting a client-supplied user id.

- `GET /api/workspace/bootstrap` returns documents, reminders, conversations, messages, and integration metadata for the authenticated user.
- `POST /api/documents/upload` accepts one file, writes it to private Storage, extracts text, summarizes it, and returns the persisted document plus generated reminders.
- `POST /api/integrations/sync` loads encrypted credentials server-side, syncs the selected provider, persists imported documents and reminders, and returns the durable records.
- `POST /api/chat` accepts `conversationId`, `messages`, and a model from an explicit allowlist. It loads the most relevant persisted document excerpts, adds them to the model context, stores the request and answer, and streams source citations with the answer.
- `PATCH /api/reminders/:id` persists completion and due-date edits.
- `POST /api/conversations` and `POST /api/conversations/:id/messages` persist new chat threads and explicit saved messages.

Credential values submitted from the integrations screen are posted once over HTTPS, encrypted with AES-256-GCM, and stored only as ciphertext plus IV. Browser state retains connection status and labels, never raw tokens.

## Upload Extraction

The upload route accepts PDF, DOCX, XLSX, CSV, Markdown, JSON, and plain-text files up to 25 MB.

- PDF text is extracted with `pdf-parse`.
- DOCX text is extracted with `mammoth`.
- XLSX and CSV cell values are extracted with `xlsx`.
- JSON, Markdown, and text files are decoded as UTF-8.

If a file has no extractable text, the route preserves the file in Storage and returns a clear `unprocessable` document status instead of falsely marking it processed.

## Chat Grounding And Controls

The chat screen sends the active conversation id, allowed model id, and current message to `/api/chat`. The server builds a bounded source context from the user's most recent and keyword-matching documents, caps excerpts at 24,000 characters, and instructs the model to cite sources by document title. The returned citation list is rendered beneath each assistant answer.

- Model selection updates the conversation model from the allowlist.
- Attachment opens the document picker and uploads selected files before the next request; those document ids are preferred in source selection.
- Copy writes an assistant response to the clipboard and confirms success.
- Regenerate replaces the latest assistant response by sending the preceding conversation context again.
- Export downloads the current conversation as Markdown including citations.
- Save persists the selected assistant response as a named workspace document.

## Client State

Zustand remains for responsive transient UI state, but server bootstrap and mutation responses are the source of truth. On Supabase mode, stores hydrate from `/api/workspace/bootstrap` and reconcile after each mutation. In local-auth mode, the app visibly labels the workspace as local-only and retains current browser persistence as a demo fallback.

## Security

- Enable RLS for every workspace table and restrict every policy to `auth.uid() = user_id`.
- Keep the Storage bucket private and use user-scoped storage policies.
- Validate upload size and extension before storage writes.
- Limit model ids server-side; never pass arbitrary client model identifiers to OpenRouter.
- Never expose service-role or encryption keys to the client.
- Never persist raw integration tokens in Zustand or local storage.

## Verification

- Unit test document extraction, encryption/decryption, source-context selection, and model validation.
- API tests verify unauthenticated requests fail, users cannot access another user's records, uploads persist extracted content, and chat requests contain only the caller's sources.
- Component tests verify chat control actions and durable-store hydration.
- Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, and `npm run build`.
- Validate against a real Supabase project with a test user, private bucket, and RLS enabled before release.
