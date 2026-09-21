export type PushDestination =
  | { screen: 'chat'; userId: string }
  | { screen: 'researcher'; userId: string }
  | { screen: 'community' };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getPushDestination(data: Record<string, unknown>): PushDestination | null {
  const kind = typeof data.kind === 'string' ? data.kind : '';
  const actorId = typeof data.actorId === 'string' && uuidPattern.test(data.actorId) ? data.actorId : '';

  if (kind === 'message' && actorId) return { screen: 'chat', userId: actorId };
  if ((kind === 'connection_request' || kind === 'match') && actorId) {
    return { screen: 'researcher', userId: actorId };
  }
  if (kind === 'community_comment' || kind === 'community_helpful') return { screen: 'community' };
  return null;
}

