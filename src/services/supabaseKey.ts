export function isSecretSupabaseKey(key: string) {
  if (key.toLowerCase().startsWith('sb_secret_')) return true;
  if (!key.startsWith('eyJ')) return false;

  try {
    const payload = key.split('.')[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const claims = JSON.parse(globalThis.atob(padded)) as { role?: unknown };
    return claims.role === 'service_role' || claims.role === 'supabase_admin';
  } catch {
    return false;
  }
}
