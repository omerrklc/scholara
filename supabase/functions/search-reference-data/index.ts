import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

type SearchKind = 'institutions' | 'cities';
type SearchRequest = { type: SearchKind; query: string; countryCode?: string; language?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function parseRequest(value: unknown): SearchRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const type = input.type;
  const query = typeof input.query === 'string' ? input.query.trim().replace(/\s+/g, ' ') : '';
  const countryCode = typeof input.countryCode === 'string' ? input.countryCode.trim().toUpperCase() : undefined;
  const language = typeof input.language === 'string' ? input.language.trim().toLowerCase() : 'en';
  if ((type !== 'institutions' && type !== 'cities') || query.length < 2 || query.length > 100) return null;
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) return null;
  if (!/^[a-z]{2}$/.test(language)) return null;
  if (type === 'cities' && !countryCode) return null;
  return { type, query, countryCode, language };
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(asRecord(value));
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function displayRorName(record: Record<string, unknown>) {
  const names = Array.isArray(record.names) ? record.names : [];
  const preferred = names.map(asRecord).find((name) => Array.isArray(name?.types) && name.types.includes('ror_display'));
  return asString(preferred?.value) || asString(record.name);
}

function parseRorResults(value: unknown) {
  const root = asRecord(value);
  const items = Array.isArray(root?.items) ? root.items : [];
  const allowedTypes = new Set(['education', 'facility', 'government', 'healthcare', 'nonprofit']);
  return items.filter(isRecord).flatMap((organization) => {
    const id = asString(organization.id);
    const name = displayRorName(organization);
    const types = Array.isArray(organization.types) ? organization.types.filter((item): item is string => typeof item === 'string') : [];
    const locations = Array.isArray(organization.locations) ? organization.locations : [];
    const location = asRecord(locations[0]);
    const details = asRecord(location?.geonames_details);
    const countryCode = asString(details?.country_code).toUpperCase();
    const countryName = asString(details?.country_name);
    const city = asString(details?.name);
    if (!/^https:\/\/ror\.org\/0[0-9a-hjkmnp-tv-z]{8}$/.test(id) || !name || !/^[A-Z]{2}$/.test(countryCode)) return [];
    if (types.length && !types.some((type) => allowedTypes.has(type))) return [];
    return [{ id, name, countryCode, countryName, city, types: types.slice(0, 10), source: 'ror' as const }];
  }).slice(0, 10);
}

function parseCityResults(value: unknown, expectedCountry: string) {
  const root = asRecord(value);
  const results = Array.isArray(root?.results) ? root.results : [];
  return results.filter(isRecord).flatMap((place) => {
    const id = asNumber(place.id);
    const name = asString(place.name);
    const admin1 = asString(place.admin1);
    const countryCode = asString(place.country_code).toUpperCase();
    const countryName = asString(place.country);
    const featureCode = asString(place.feature_code);
    const population = asNumber(place.population);
    if (!id || !Number.isSafeInteger(id) || !name || countryCode !== expectedCountry || !featureCode.startsWith('PPL')) return [];
    return [{
      id: String(id), name, admin1, countryCode, countryName,
      label: [name, admin1, countryName].filter(Boolean).join(', '), population, source: 'geonames' as const,
    }];
  }).slice(0, 10);
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 4096) return json({ error: 'Request is too large' }, 413);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration error' }, 500);

  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return json({ error: 'Authentication required' }, 401);
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: authError } = await authClient.auth.getUser();
  if (authError || !userData.user) return json({ error: 'Authentication required' }, 401);

  let payload: SearchRequest | null = null;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 4096) return json({ error: 'Request is too large' }, 413);
    payload = parseRequest(JSON.parse(rawBody));
  } catch { /* invalid JSON */ }
  if (!payload) return json({ error: 'Enter a valid search' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: allowed, error: quotaError } = await admin.rpc('consume_reference_search_quota', {
    target_user_id: userData.user.id, maximum_requests: 60,
  });
  if (quotaError) return json({ error: 'Search is temporarily unavailable' }, 503);
  if (!allowed) return json({ error: 'Too many searches. Please wait a few minutes.' }, 429);

  const normalized = `${payload.type}|${payload.query.toLocaleLowerCase('en-US')}|${payload.countryCode ?? ''}|${payload.language}`;
  const cacheKey = await digest(normalized);
  const now = new Date().toISOString();
  const { data: cached } = await admin.from('reference_search_cache').select('response').eq('cache_key', cacheKey).gt('expires_at', now).maybeSingle();
  if (cached && Array.isArray(cached.response)) return json({ results: cached.response, cached: true });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  let results: unknown[];
  try {
    if (payload.type === 'institutions') {
      const url = new URL('https://api.ror.org/v2/organizations');
      url.searchParams.set('query', payload.query);
      if (payload.countryCode) url.searchParams.set('filter', `country.country_code:${payload.countryCode}`);
      const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'Scholara/0.1 (reference search)' };
      const clientId = Deno.env.get('ROR_CLIENT_ID');
      if (clientId) headers['Client-Id'] = clientId;
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) throw new Error('institution provider failed');
      results = parseRorResults(await response.json());
      if (results.length) await admin.from('reference_institutions').upsert(results.map((item) => {
        const result = item as ReturnType<typeof parseRorResults>[number];
        return { ror_id: result.id, display_name: result.name, country_code: result.countryCode, country_name: result.countryName, city_name: result.city, organization_types: result.types, updated_at: now };
      }));
    } else {
      const apiKey = Deno.env.get('OPEN_METEO_API_KEY');
      const url = new URL(apiKey ? 'https://customer-api.open-meteo.com/v1/search' : 'https://geocoding-api.open-meteo.com/v1/search');
      url.searchParams.set('name', payload.query);
      url.searchParams.set('count', '20');
      url.searchParams.set('language', payload.language ?? 'en');
      url.searchParams.set('countryCode', payload.countryCode!);
      url.searchParams.set('format', 'json');
      if (apiKey) url.searchParams.set('apikey', apiKey);
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error('city provider failed');
      results = parseCityResults(await response.json(), payload.countryCode!);
      if (results.length) await admin.from('reference_cities').upsert(results.map((item) => {
        const result = item as ReturnType<typeof parseCityResults>[number];
        return { geonames_id: result.id, display_name: result.name, admin1_name: result.admin1, country_code: result.countryCode, country_name: result.countryName, population: result.population, updated_at: now };
      }));
    }
  } catch {
    return json({ error: 'Search provider is temporarily unavailable' }, 502);
  } finally {
    clearTimeout(timeout);
  }

  const hours = payload.type === 'institutions' ? 24 : 168;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  await admin.from('reference_search_cache').upsert({ cache_key: cacheKey, response: results, expires_at: expiresAt, created_at: now });
  if (Math.random() < 0.05) await admin.rpc('cleanup_reference_search_cache', { batch_size: 200 });
  return json({ results, cached: false });
});
