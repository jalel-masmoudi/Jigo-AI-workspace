# Contributing to Jigo AI Workspace

Thanks for helping improve Jigo. This guide keeps contributions consistent and reviewable.

## Development setup

1. Fork and clone the repo
2. `npm install`
3. `cp .env.example .env` and add an `OPENROUTER_API_KEY` for AI features
4. `npm run dev`

## Before you open a PR

- Run `npm run lint` and `npm run typecheck`
- Do not commit `.env`, keys, tokens, or personal credentials
- Prefer empty states over mock/demo data
- Keep UI changes aligned with the existing light enterprise look (Inter, blue accents)
- Update `.env.example` if you add new environment variables
- Update the README when behavior or setup steps change

## Pull request guidelines

- One focused change per PR when possible
- Describe **why** the change exists, not only what files moved
- Include screenshots for UI changes
- Link related issues

## Reporting bugs

Use GitHub Issues and include:

- Steps to reproduce
- Expected vs actual behavior
- Browser / Node version
- Whether Supabase / integrations are configured

## Security

Do not file public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Code of conduct

Be respectful and constructive. Harassment or abuse is not welcome.
