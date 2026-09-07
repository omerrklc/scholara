# Scholara

Scholara is a mobile academic network for early-career researchers. This Phase 1 prototype includes:

- Welcome and local demo sign-in flows
- Eight-step academic onboarding
- Research and Moving discovery modes
- Mock research recommendations and transparent match reasons
- Community, Matches, Messages, and Profile tabs
- Persisted local prototype state
- An optional, environment-driven Supabase client foundation

## Run locally

Install dependencies and start Expo:

```bash
pnpm install
pnpm start
```

Then open the app in Expo Go, an Android/iOS simulator, or the web preview.

## Supabase setup (next phase)

Copy `.env.example` to `.env` and add the public project URL and anonymous key. Never put a service-role key or an AI provider secret in the mobile app.

The current UI intentionally stays usable without Supabase. Authentication, migrations, Row Level Security, matching persistence, Realtime chat, and moderation endpoints are later controlled phases.

## Useful checks

```bash
pnpm typecheck
pnpm lint
pnpm exec expo export --platform web
```
