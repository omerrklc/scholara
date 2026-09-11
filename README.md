# Scholara

Scholara is a mobile academic network for early-career researchers. Its product core is **Research Matching + Academic Relocation + Community**.

## Current alpha

- Supabase email/password authentication, PKCE verification callback, password reset, secure session persistence, and sign-out
- Eight-step academic onboarding and owner-protected profile persistence
- Research and Moving discovery with transparent compatibility reasons and privacy-controlled location fields
- Saved profiles, connection requests, and mutual matches
- Private realtime messaging restricted to matched, unblocked participants
- Community posts, comments, helpful reactions, deletion, reporting, and blocking
- Multi-reason private reports and an Engellenenler list
- Account and privacy settings with notification preferences and versioned legal acceptance
- Rate-limited data export requests and recently reauthenticated account deletion
- Server-side validation, bounded queries, rate limits, RLS, and database security tests
- Keyboard-aware responsive layouts tested on small mobile viewports

This is a functional alpha, not a production release. Profile image upload, global institution/location normalization, push delivery, localization, moderation operations, export-file processing, analytics, and production delivery are planned phases. The pre-release legal text requires professional review before public launch.

## Run the app

```bash
pnpm install
pnpm start
```

Copy `.env.example` to `.env.local` and supply only the public Supabase URL and publishable key. The legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` name remains supported. Never put a database password, access token, service-role key, or `sb_secret_` value in the mobile app.

## Verify the app

```bash
pnpm verify
```

This runs TypeScript, lint, unit/security tests, Expo dependency compatibility, and a web export.

For the local database and pgTAP authorization tests, start Docker and run:

```bash
pnpm db:start
pnpm db:reset
pnpm test:db
pnpm db:types
```

## Database workflow

`supabase/migrations` is the database source of truth. Apply files in filename order. Every schema change needs a unique migration, database authorization tests, and regenerated types. Do not make production schema changes directly in the dashboard.

Early SQL was applied manually, so remote migration history must be reconciled before the first automated `db push`. See [environment and release rules](docs/ENVIRONMENTS.md).

## Documentation

- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Environment and release workflow](docs/ENVIRONMENTS.md)
- [Phase 0 assessment and next gate](docs/PHASE_0_ASSESSMENT.md)
- [Supabase security setup](SECURITY_SETUP.md)

Authentication redirect URLs must include the exact callback for the active build. Production will move from the development custom scheme to verified iOS Universal Links and Android App Links before public distribution.
