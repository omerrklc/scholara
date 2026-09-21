import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationKind = 'connection_request' | 'match' | 'message' | 'community_comment' | 'community_helpful';
type NotificationRecord = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: NotificationKind;
  resource_id: string | null;
};
type WebhookPayload = {
  type: 'INSERT';
  table: 'notifications';
  schema: 'public';
  record: NotificationRecord;
  old_record: null;
};
type PushToken = { id: string; expo_push_token: string };
type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message?: string; details?: { error?: string } };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const notificationKinds = new Set<NotificationKind>([
  'connection_request', 'match', 'message', 'community_comment', 'community_helpful',
]);

function safeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

function isPayload(value: unknown): value is WebhookPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<WebhookPayload>;
  const record = payload.record as Partial<NotificationRecord> | undefined;
  return payload.type === 'INSERT' && payload.table === 'notifications' && payload.schema === 'public'
    && Boolean(record && typeof record.id === 'string' && uuidPattern.test(record.id))
    && Boolean(record && typeof record.user_id === 'string' && uuidPattern.test(record.user_id))
    && Boolean(record && typeof record.kind === 'string' && notificationKinds.has(record.kind as NotificationKind))
    && Boolean(record && (record.actor_id === null || (typeof record.actor_id === 'string' && uuidPattern.test(record.actor_id))))
    && Boolean(record && (record.resource_id === null || (typeof record.resource_id === 'string' && uuidPattern.test(record.resource_id))));
}

function copyFor(kind: NotificationKind, actorName: string) {
  switch (kind) {
    case 'connection_request': return { title: 'New connection request', body: `${actorName} wants to connect with you.` };
    case 'match': return { title: 'New academic match', body: `You and ${actorName} can now message each other.` };
    case 'message': return { title: 'New message', body: `${actorName} sent you a message.` };
    case 'community_comment': return { title: 'New community reply', body: `${actorName} replied to your post.` };
    case 'community_helpful': return { title: 'Your post was helpful', body: `${actorName} found your post helpful.` };
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const expectedSecret = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
  const suppliedSecret = request.headers.get('x-scholara-webhook-secret') ?? '';
  if (!expectedSecret || !safeEqual(expectedSecret, suppliedSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!isPayload(payload)) return new Response('Invalid webhook payload', { status: 400 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return new Response('Server configuration error', { status: 500 });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const notification = payload.record;
  const [{ data: tokens, error: tokenError }, { data: actor }] = await Promise.all([
    admin.from('push_tokens').select('id, expo_push_token').eq('user_id', notification.user_id),
    notification.actor_id
      ? admin.from('profiles').select('full_name').eq('id', notification.actor_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (tokenError) return new Response('Token lookup failed', { status: 500 });
  if (!tokens?.length) return Response.json({ delivered: 0 });

  const actorName = typeof actor?.full_name === 'string' && actor.full_name.trim()
    ? actor.full_name.trim().slice(0, 100)
    : 'A Scholara researcher';
  const content = copyFor(notification.kind, actorName);
  const claimed: PushToken[] = [];

  for (const token of tokens as PushToken[]) {
    const { data, error } = await admin.from('push_deliveries').upsert({
      notification_id: notification.id,
      push_token_id: token.id,
      status: 'queued',
      attempted_at: new Date().toISOString(),
    }, { onConflict: 'notification_id,push_token_id', ignoreDuplicates: true }).select('id').maybeSingle();
    if (!error && data) claimed.push(token);
  }
  if (!claimed.length) return Response.json({ delivered: 0, duplicate: true });

  const messages = claimed.map((token) => ({
    to: token.expo_push_token,
    sound: 'default',
    channelId: 'default',
    priority: 'high',
    title: content.title,
    body: content.body,
    data: {
      kind: notification.kind,
      actorId: notification.actor_id,
      resourceId: notification.resource_id,
      notificationId: notification.id,
    },
  }));
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoAccessToken) headers.Authorization = `Bearer ${expoAccessToken}`;

  let tickets: ExpoTicket[] = [];
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers, body: JSON.stringify(messages),
    });
    if (!response.ok) throw new Error(`Expo push service returned ${response.status}`);
    const result = await response.json() as { data?: ExpoTicket[] };
    tickets = Array.isArray(result.data) ? result.data : [];
  } catch {
    await admin.from('push_deliveries').update({ status: 'error', error_code: 'push_service_unavailable' })
      .eq('notification_id', notification.id).in('push_token_id', claimed.map((token) => token.id));
    return new Response('Push service unavailable', { status: 502 });
  }

  for (let index = 0; index < claimed.length; index += 1) {
    const token = claimed[index];
    const ticket = tickets[index];
    const errorCode = ticket?.status === 'error' ? ticket.details?.error ?? 'expo_ticket_error' : null;
    await admin.from('push_deliveries').update({
      status: ticket?.status === 'ok' ? 'sent' : 'error',
      ticket_id: ticket?.status === 'ok' ? ticket.id.slice(0, 200) : null,
      error_code: errorCode?.slice(0, 100) ?? null,
    }).eq('notification_id', notification.id).eq('push_token_id', token.id);

    if (errorCode === 'DeviceNotRegistered') {
      await admin.from('push_tokens').delete().eq('id', token.id);
    }
  }

  return Response.json({ delivered: tickets.filter((ticket) => ticket.status === 'ok').length });
});
