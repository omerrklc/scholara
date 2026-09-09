# Scholara

Scholara is a mobile academic network for early-career researchers. The current Phase 3 discovery build includes:

- Supabase email/password registration, sign-in, reset, session persistence, and sign-out
- Eight-step academic onboarding
- Authenticated profile persistence protected by Row Level Security
- Research and Moving discovery modes backed by completed Supabase profiles
- Deterministic research and relocation scoring with transparent match reasons
- Community, Matches, Messages, and Profile tabs
- Persisted local save and connection-request prototype state
- Responsive layouts tested down to a 320×568 viewport

## Run locally

Install dependencies and start Expo:

```bash
pnpm install
pnpm start
```

Then open the app in Expo Go, an Android/iOS simulator, or the web preview.

## Supabase setup

Copy `.env.example` to `.env.local` and add the public project URL and publishable/anonymous key. Never put a service-role key or an AI provider secret in the mobile app.

Apply `supabase/migrations/202609080001_phase2_profiles.sql` in the Supabase SQL Editor before testing registration. It creates the profile table, validation constraints, account trigger, explicit grants, and owner-only write policies. Discover reads only completed profiles allowed by those policies and excludes the current user. Server-persisted mutual matching, Realtime chat, and moderation endpoints remain later controlled phases.

## Useful checks

```bash
pnpm typecheck
pnpm lint
pnpm exec expo export --platform web
```
