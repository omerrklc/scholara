import { describe, expect, it } from 'vitest';
import { isSecretSupabaseKey } from './supabaseKey';

describe('public Supabase key protection', () => {
  it('rejects modern Supabase secret keys', () => {
    expect(isSecretSupabaseKey('sb_secret_example-do-not-use')).toBe(true);
  });

  it.each(['service_role', 'supabase_admin'])('rejects a JWT with the %s role', (role) => {
    const header = globalThis.btoa(JSON.stringify({ alg: 'none' }));
    const payload = globalThis.btoa(JSON.stringify({ role }));
    expect(isSecretSupabaseKey(`${header}.${payload}.not-a-signature`)).toBe(true);
  });

  it('allows publishable and anon-style keys', () => {
    expect(isSecretSupabaseKey('sb_publishable_example')).toBe(false);
    const header = globalThis.btoa(JSON.stringify({ alg: 'none' }));
    const payload = globalThis.btoa(JSON.stringify({ role: 'anon' }));
    expect(isSecretSupabaseKey(`${header}.${payload}.not-a-signature`)).toBe(false);
  });
});
