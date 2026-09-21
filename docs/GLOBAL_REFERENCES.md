# Global institution and location references

## Purpose

Scholara stores canonical identifiers alongside display labels so profiles can match across spelling and language differences. Institutions use ROR identifiers, cities use GeoNames identifiers returned by the configured geocoding provider, and countries use ISO 3166-1 alpha-2 codes.

Existing profiles remain at `normalization_version = 0` and continue to work through legacy text matching. The profile screen asks their owners to review the data. A successfully reviewed profile moves to version 1 and cannot be downgraded.

## Trusted flow

The mobile app never writes reference records. An authenticated request goes to `search-reference-data`, which validates the payload, enforces a per-user five-minute quota, calls an allowlisted provider, validates the response, and stores canonical results in private reference tables. A database trigger replaces submitted labels and country codes with the stored canonical values when a profile is saved.

Reference tables have RLS enabled and no `anon` or `authenticated` grants. Discovery and profile-detail RPCs reveal normalized location identifiers only when the owner has enabled the corresponding location visibility setting.

## Providers and licensing

- Institution search: [ROR API v2](https://ror.readme.io/docs/api-version-2). ROR registry data is released under [CC0](https://ror.org/about/registry/).
- Country labels: `i18n-iso-countries`, bundled in the app under the MIT license.
- Prototype city search: [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api), which returns GeoNames-backed place identities.

The public Open-Meteo endpoint is for non-commercial evaluation. **A commercial launch is blocked until `OPEN_METEO_API_KEY` is configured for a paid customer endpoint or an approved self-hosted geocoder is substituted.** The Edge Function automatically uses the customer endpoint when that secret is present.

## Performance and abuse controls

- Search begins after two characters and is debounced in the client.
- Institution results are cached for 24 hours; city results for seven days.
- Each authenticated user may make 60 reference searches in a rolling five-minute window.
- Provider calls time out after six seconds and outbound hosts are fixed in code.
- Results are limited to ten research-relevant institutions or populated-place feature types.

## Release procedure

1. Apply `202609160001_global_profile_references.sql` in a tested environment.
2. Deploy `search-reference-data` with JWT verification disabled at the gateway; the function validates the bearer token itself.
3. Set `OPEN_METEO_API_KEY` before commercial use. `ROR_CLIENT_ID` may be supplied when ROR issues one.
4. Run app checks, Deno checks, a clean database reset, and all pgTAP tests.
5. Test institution/city search, keyboard behavior, empty/error states, privacy toggles, and legacy-profile review on a small Android and iOS viewport.
