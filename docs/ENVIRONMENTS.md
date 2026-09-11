# Environments and releases

Scholara uses three isolated environments:

- **Development:** local Supabase and developer builds. Disposable data; migrations may be reset.
- **Staging:** production-like cloud project for integration tests and invited testers. No production user data.
- **Production:** real users. Schema changes arrive only through reviewed migrations after staging verification.

Each environment must use a different Supabase project and publishable key. Production database passwords, access tokens, service-role keys, SMTP credentials, signing keys, and third-party secrets belong only in their provider's secret store or CI environment. They must not use an `EXPO_PUBLIC_` name.

## Local database

Docker must be running.

```bash
pnpm db:start
pnpm db:reset
pnpm test:db
pnpm db:types
```

## Remote migration reconciliation

Some early migrations were applied manually through the SQL Editor. Before the first automated remote deployment, link the correct non-production Supabase project, compare `supabase migration list --linked` with `supabase/migrations`, and repair history only after verifying which statements are already present. Do not run `db push` against production until the histories agree.

## Release gates

Every pull request must pass app checks, database migration/RLS tests, and secret scanning. Changes move to staging before production. EAS development, preview, and production profiles will be added when the app moves beyond Expo Go and begins native push-notification testing.
