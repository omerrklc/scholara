# Phase 0 repository assessment

Date: 2026-09-10

## Confirmed functionality

- Expo Router application with Discover, Community, Matches, Messages, and Profile tabs.
- Email/password Auth, PKCE callback validation, password recovery, verification state, and SecureStore-backed mobile sessions.
- Persisted academic onboarding and owner-only base-profile access.
- Privacy-filtered discovery RPC with Research and Moving ranking in the client.
- Saved profiles, connection requests, mutual matches, blocked-user exclusions, and private realtime chat.
- Community posts, comments, helpful reactions, deletion, multi-reason reporting, and blocking.
- PostgreSQL validation, bounded RPC results, RLS, explicit grants, and server-side rate limits on sensitive writes.

## Work that must be preserved

The working tree contains uncommitted Auth callback, profile privacy, Community, reporting, blocking, input-hardening, tests, and migration-version fixes. They have been treated as the current baseline and were not reset or overwritten. Before team collaboration continues, review and commit this coherent baseline so it cannot be lost.

## Architecture and data flow

The Expo client authenticates with Supabase using a public key. Screens call service modules, which use owner-protected tables or bounded Postgres RPCs. Postgres remains authoritative for identity, authorization, visibility, blocking, matching state, messages, reports, validation, and write-rate limits. Realtime is used for matched conversations. No trusted service-role backend or admin console exists yet.

## Migration and environment risks

- Early migrations were run manually in the hosted SQL Editor; hosted migration history was not verified from this machine.
- The former duplicate migration version has been renamed, and an automated uniqueness test now exists.
- Local Supabase runs under its own `scholara` project identity and ports. All migrations have been proven from a clean database.
- Remote `db push` must remain disabled until `supabase migration list --linked` is reconciled against the hosted schema.
- Development, staging, and production projects are not yet separated.

## Ranked findings

### P0 — baseline/release blockers

- Preserve and commit the current coherent working tree.
- Prove all migrations from an empty local database and reconcile hosted migration history.
- Require app, database/RLS, and secret-scanning CI before merge.
- Do not deploy schema changes directly to production from the dashboard.

### P1 — security, privacy, and store blockers

- Add versioned Terms, Privacy Policy, and Community Guidelines acceptance.
- Add authenticated data export and in-app account deletion plus an external deletion path.
- Add verified Universal/App Links and production-grade email delivery/recovery handling.
- Build a least-privilege moderator workflow; reports currently have no operational console.
- Add production observability, incident handling, backup/restore testing, and separate environments.

### P1 — frontend and product blockers

- Replace the non-functional photo step with secure Storage upload.
- Replace the prototype language action with a real editor.
- Add localization infrastructure, initially English and Turkish.
- Add notification preferences and an in-app notification center.
- Complete cursor pagination in discovery, Community, messages, and lists.

### P2 — scalability and quality

- Move candidate eligibility/ranking from a fixed 50-row client flow to a server-paginated recommendation contract.
- Normalize institutions, locations, languages, topics, methods, and academic stages.
- Add ORCID and ROR integrations with provenance and consent.
- Generate Supabase database types and remove manual RPC result casts.
- Replace raw backend error strings with stable internal codes and safe localized messages.
- Add mobile component/E2E tests, accessibility checks, and realistic load tests.

### P3 — differentiated expansion

- Academic relocation hubs and arrival cohorts.
- Structured collaboration opportunities, events, scholarly metadata, and institutional features.
- Recommendation feedback/evaluation with coverage, diversity, fairness, and safety metrics.

## Phase 0 changes introduced

- Added one-command app verification and local database scripts.
- Added local Supabase configuration.
- Added GitHub Actions checks for app quality, migrations/RLS, and secret scanning.
- Added Node test typings and aligned Expo patch versions.
- Added architecture and environment/release documentation.
- Updated the README to match current features and risks.
- Removed unused prototype mock profiles/posts and their stale domain type.

## Verification evidence

- TypeScript: passed.
- ESLint: passed.
- Unit/security tests: 22 passed across 7 files.
- Expo dependency compatibility: passed after patch alignment.
- Expo static web export: passed with 22 routes.
- Dependency audit at moderate threshold: no known vulnerabilities.
- Lockfile frozen/offline install check: passed.
- Git whitespace/error check: passed; Windows line-ending notices only.
- Local database reset: passed with all eleven migrations applied in filename order.
- Database authorization and validation tests: 91 passed across 7 pgTAP files.
- Generated TypeScript database definitions: completed from the verified local schema.

## Manual two-account regression checklist

1. Restart the app and verify session persistence.
2. Sign out, sign in, request password reset, and confirm the safe update-password route.
3. Complete/update both profiles and verify private location fields remain hidden unless enabled.
4. Confirm Research and Moving recommendations never include either direction of a blocked pair.
5. Request connections from both accounts and confirm one mutual match.
6. Send messages in both directions; then block and confirm discovery, match, and chat access disappear.
7. Create a post/comment/helpful reaction, report with multiple reasons, delete owned content, and confirm blocked content is absent.

## Phase 1 account/settings foundation

Completed locally: privacy controls, versioned legal acceptance, blocked-user access, notification preferences, idempotent export requests, and recently reauthenticated account deletion. Private settings tables have no direct app-role access; bounded security-definer functions enforce identity and authorization.

## Next phase

Build the real profile-media and identity-editing slice: secure Storage-backed photo upload, editable language proficiency, deletion/replacement controls, file validation, owner-only Storage policies, and mobile tests. Export request processing and public-launch legal review remain separate operational work.
