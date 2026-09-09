# Scholara

Scholara is a mobile academic network for early-career researchers. The current Phase 3 discovery build includes:

- Supabase email/password registration, sign-in, reset, session persistence, and sign-out
- Eight-step academic onboarding
- Authenticated profile persistence protected by Row Level Security
- Research and Moving discovery modes backed by completed Supabase profiles
- Deterministic research and relocation scoring with transparent match reasons
- Community, Matches, Messages, and Profile tabs
- Server-persisted saves, mutual connection requests, and matches
- Private Realtime messaging available only to mutual matches
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

Apply the SQL files in `supabase/migrations` in filename order. They create profiles, private saved profiles, mutual matching, bounded profile data, and private messages with explicit Row Level Security. Realtime chat is limited to matched participants. Moderation endpoints remain a later controlled phase.

## Useful checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec expo export --platform web
```
