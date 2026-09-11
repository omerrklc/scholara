import { describe, expect, it } from 'vitest';
import { consumeAuthCodeOnce, getAllowedAuthNext, parseAuthCallback } from './authCallback';

const expected = { scheme: 'scholara', hostname: 'auth', path: 'callback', queryParams: {} };

describe('authentication callback validation', () => {
  it.each([
    { scheme: 'evil', hostname: 'auth', path: 'callback' },
    { scheme: 'scholara', hostname: 'evil', path: 'callback' },
    { scheme: 'scholara', hostname: 'auth', path: 'other' },
  ])('rejects a callback with a changed origin or path', (changed) => {
    expect(parseAuthCallback({ ...changed, queryParams: { code: 'one-time-code' } }, expected).error).toBe('Invalid authentication callback URL.');
  });

  it('rejects a callback without a PKCE code', () => {
    expect(parseAuthCallback({ ...expected, queryParams: {} }, expected).error).toContain('missing or expired');
  });

  it('allows only the password update destination', () => {
    expect(getAllowedAuthNext('/update-password')).toBe('/update-password');
    expect(getAllowedAuthNext('/profile')).toBe('/onboarding');
    expect(getAllowedAuthNext('https://evil.example')).toBe('/onboarding');
  });

  it('preserves the safe password reset destination with a valid code', () => {
    expect(parseAuthCallback({ ...expected, queryParams: { code: 'one-time-code', next: '/update-password' } }, expected)).toEqual({ code: 'one-time-code', nextRoute: '/update-password', error: null });
  });

  it('allows a PKCE code to be processed only once locally', () => {
    const processedCodes = new Set<string>();
    expect(consumeAuthCodeOnce(processedCodes, 'single-use-code')).toBe(true);
    expect(consumeAuthCodeOnce(processedCodes, 'single-use-code')).toBe(false);
  });
});
