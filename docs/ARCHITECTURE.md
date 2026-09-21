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

Institution and city search crosses a separate trusted boundary. The authenticated Edge Function calls only allowlisted ROR/Open-Meteo endpoints, rate-limits users, caches validated results, and writes private canonical reference tables with the service role. A security-definer trigger canonicalizes normalized profile labels. The app cannot create reference identities, and public profile RPCs hide normalized location identifiers with their labels when visibility is disabled.

## Change rules

1. Add schema changes as uniquely versioned migrations.
2. Keep migrations backward compatible where practical.
3. Add pgTAP coverage for authorization and data constraints.
4. Regenerate `src/types/database.ts` after a successful local database reset.
5. Never develop by editing production schema directly.
6. Promote tested migrations from local to staging and then production.

## Near-term evolution

The current modular Expo + Supabase architecture remains appropriate. ROR and city reference search plus push notification processing already live in Supabase Edge Functions. Other trusted background work—external ORCID/OpenAlex integrations, exports, deletion jobs, and moderator actions—will use the same server boundary. A separate protected web console will serve moderation operations.
