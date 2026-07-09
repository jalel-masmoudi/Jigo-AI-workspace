# Jigo AI Workspace

Open-source AI workspace for teams that live in Meet, Notion, Slack, Jira, and ERP systems.

Jigo helps employees chat with workplace context, sync knowledge from connected apps, summarize content with AI, and turn action items into reminders — without shipping fake demo data.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)
![Stack](https://img.shields.io/badge/stack-TanStack%20Start%20%7C%20React%2019%20%7C%20Vite-111111.svg)

## Features

- **AI chat** — workspace assistant via OpenRouter (default: Hermes 3)
- **Auth** — Supabase email/password when configured; local browser accounts otherwise
- **Integrations** — live sync for Google Meet (Drive transcripts), Notion, Slack, and Jira
- **Summaries & reminders** — AI extracts action items from synced content
- **Knowledge & documents** — empty-by-default workspace that fills from uploads and sync
- **Light enterprise UI** — Inter, blue accents, sidebar navigation

## Tech stack

| Layer         | Choice                                                  |
| ------------- | ------------------------------------------------------- |
| App framework | [TanStack Start](https://tanstack.com/start) + React 19 |
| Build         | Vite 8 + Tailwind CSS v4                                |
| UI            | shadcn/ui + Radix                                       |
| State         | Zustand                                                 |
| Auth          | Supabase Auth (optional)                                |
| AI            | Vercel AI SDK + OpenRouter                              |

## Quick start

### Prerequisites

- Node.js **20+**
- npm 10+
- An [OpenRouter](https://openrouter.ai/) API key (for chat + summarize)

### Install

```bash
git clone https://github.com/jalel-masmoudi/Jigo-AI-workspace.git
cd Jigo-AI-workspace
npm install
cp .env.example .env
```

Edit `.env` and set at least:

```env
OPENROUTER_API_KEY=sk-or-v1-...
```

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

1. Create an account at `/register` (local mode works without Supabase)
2. Sign in and explore the workspace
3. Optionally connect integrations under **Integrations**

### Build

```bash
npm run build
npm run preview
```

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable                                          | Required     | Purpose                                                      |
| ------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| `OPENROUTER_API_KEY`                              | Yes (for AI) | Chat + document summarization                                |
| `OPENROUTER_MODEL`                                | No           | Defaults to `nousresearch/hermes-3-llama-3.1-405b`           |
| `VITE_SUPABASE_URL`                               | No           | Cloud auth                                                   |
| `VITE_SUPABASE_ANON_KEY`                          | No           | Cloud auth                                                   |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`       | No           | Google Meet / Drive OAuth                                    |
| `GOOGLE_REDIRECT_URI`                             | No           | e.g. `http://localhost:5173/api/integrations/oauth/callback` |
| `NOTION_API_KEY`                                  | No           | Notion sync                                                  |
| `SLACK_BOT_TOKEN`                                 | No           | Slack sync                                                   |
| `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` | No           | Jira sync                                                    |

Without Supabase keys, accounts are stored in the browser (local mode). Without integration keys, Connect/Sync shows clear errors instead of mock data.

## Project structure

```
src/
  components/     # UI, layout, brand, auth gates
  lib/            # API routes, AI, integrations, auth helpers
  routes/         # TanStack file-based routes
  store/          # Zustand stores
  types/          # Shared TypeScript types
public/           # Static assets (SVG favicon / mark)
```

## Scripts

| Command             | Description              |
| ------------------- | ------------------------ |
| `npm run dev`       | Start development server |
| `npm run build`     | Production build         |
| `npm run preview`   | Preview production build |
| `npm run lint`      | ESLint                   |
| `npm run format`    | Prettier                 |
| `npm run typecheck` | TypeScript check         |

## Integrations setup (optional)

### Google Meet

1. Create a Google Cloud OAuth client (Web)
2. Add redirect URI: `http://localhost:5173/api/integrations/oauth/callback`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
4. In the app: **Integrations → Connect → Sync**

### Notion / Slack / Jira

Create an internal Notion integration, Slack bot (`xoxb-…`), or Jira API token, then either:

- put values in `.env`, or
- paste them in the Connect dialog

Invite the Slack bot to channels you want to sync. Share Notion pages with your integration.

## Security notes

- `.env` is gitignored — only `.env.example` is committed
- Do not commit API keys, tokens, or service-role secrets
- Local auth hashes passwords with SHA-256 in the browser; use Supabase for production auth
- Integration credentials may be stored in browser `localStorage` for sync — treat shared machines carefully

See [SECURITY.md](SECURITY.md) to report vulnerabilities.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Jalel Masmoudi

## Acknowledgments

Built with TanStack Start, shadcn/ui, Supabase, Vercel AI SDK, and OpenRouter.
