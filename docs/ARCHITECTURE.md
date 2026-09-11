# Scholara architecture

## Product boundary

Scholara is a mobile-first academic network built around research discovery, academic relocation, community, mutual matching, and private messaging. It is intentionally not a dating product or a paper-hosting repository.

## Runtime map

- `app/`: Expo Router screens and navigation.
- `src/components/`: reusable presentation and interaction components.
- `src/state/`: authenticated application state and orchestration.
- `src/services/`: client boundaries for Auth, Postgres RPCs, Realtime, and persistence.
- `src/types/`: domain types and generated Supabase database types.
- `supabase/migrations/`: the ordered, version-controlled database source of truth.
- `supabase/tests/`: pgTAP checks for database constraints, grants, RLS, and privileged functions.

## Trust boundaries

The mobile bundle is public and untrusted. It may contain only the Supabase URL and publishable/anon key. Authentication, ownership, matching eligibility, blocking, report privacy, rate limits, and data visibility are enforced in Postgres/RPCs. A service-role key must never be used by the app.

The `profiles` table is owner-readable. Discovery is exposed through a bounded RPC that returns only approved fields and applies visibility and blocking rules before data leaves the database. Messages are readable only by matched, unblocked participants. Reports are write-only from the mobile user's perspective.

## Change rules

1. Add schema changes as uniquely versioned migrations.
2. Keep migrations backward compatible where practical.
3. Add pgTAP coverage for authorization and data constraints.
4. Regenerate `src/types/database.ts` after a successful local database reset.
5. Never develop by editing production schema directly.
6. Promote tested migrations from local to staging and then production.

## Near-term evolution

The current modular Expo + Supabase architecture remains appropriate. Trusted background work—push notification fan-out, external ORCID/ROR/OpenAlex integrations, exports, deletion jobs, and moderator actions—will later live in Supabase Edge Functions or another trusted server boundary. A separate protected web console will serve moderation operations.

