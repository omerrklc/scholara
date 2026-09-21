import { describe, expect, it } from 'vitest';
import { getPushDestination } from './pushRouting';

const actorId = '51000000-0000-4000-8000-000000000001';

describe('push notification routing', () => {
  it('routes messages to the authenticated chat screen', () => {
    expect(getPushDestination({ kind: 'message', actorId })).toEqual({ screen: 'chat', userId: actorId });
  });

  it('routes connection events to the researcher profile', () => {
    expect(getPushDestination({ kind: 'match', actorId })).toEqual({ screen: 'researcher', userId: actorId });
  });

  it('routes community events without trusting a client-provided path', () => {
    expect(getPushDestination({ kind: 'community_comment', path: '/update-password' })).toEqual({ screen: 'community' });
  });

  it('rejects malformed or unknown payloads', () => {
    expect(getPushDestination({ kind: 'message', actorId: 'not-a-user' })).toBeNull();
    expect(getPushDestination({ kind: 'admin', actorId })).toBeNull();
  });
});
