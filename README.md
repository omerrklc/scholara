# Scholara

Scholara is a mobile academic network for early-career researchers. The current Phase 2 build includes:

- Supabase email/password registration, sign-in, reset, session persistence, and sign-out
- Eight-step academic onboarding
- Authenticated profile persistence protected by Row Level Security
- Research and Moving discovery modes
- Mock research recommendations and transparent match reasons
- Community, Matches, Messages, and Profile tabs
- Persisted local prototype state
- Responsive layouts tested down to a 320×568 viewport

## Run locally

Install dependencies and start Expo:

```bash
pnpm install
pnpm start
```

Then open the app in Expo Go, an Android/iOS simulator, or the web preview.

## Supabase setup

Copy `.env.example` to `.env.local` and add the public project URL and publishable key. Legacy projects may use the explicitly named `EXPO_PUBLIC_SUPABASE_ANON_KEY` instead. Never put a service-role key or an AI provider secret in the mobile app; the client rejects recognizable Supabase secret/service-role keys at startup.

Apply the SQL files in `supabase/migrations` in filename order before testing registration. They create the profile table, validation constraints, account trigger, explicit grants, and owner-only read/write policies. Matching persistence, Realtime chat, and moderation endpoints remain later controlled phases.

Authentication callbacks use PKCE. Add the exact callback generated for your build (for production, `scholara://auth/callback`) to the Supabase Authentication redirect allow list. Production releases should move to verified iOS Universal Links and Android App Links before public distribution.

## Useful checks

```bash
pnpm typecheck
pnpm lint
pnpm exec expo export --platform web
```
