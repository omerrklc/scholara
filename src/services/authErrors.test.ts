import { describe, expect, it } from 'vitest';
import { publicAuthError } from './authErrors';

describe('publicAuthError', () => {
  it('does not expose raw sign-in details', () => {
    expect(publicAuthError({ message: 'User not found: private@example.com' }, 'sign-in'))
      .toBe('Email or password is incorrect.');
  });

  it('returns a safe rate-limit message', () => {
    expect(publicAuthError({ message: 'email rate limit exceeded', status: 429 }, 'resend'))
      .toBe('Too many attempts. Please wait a few minutes and try again.');
  });

  it('returns a safe network message', () => {
    expect(publicAuthError({ message: 'Failed to fetch' }, 'sign-up'))
      .toBe('Connection problem. Check your internet and try again.');
  });
});
