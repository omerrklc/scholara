import { createClient } from 'npm:@supabase/supabase-js@2';

type ClaimedDelivery = {
  delivery_id: string;
  push_token_id: string;
  ticket_id: string;
  attempt_count: number;
};
type ExpoReceipt = {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
};

function safeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

function isReceipt(value: unknown): value is ExpoReceipt {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Partial<ExpoReceipt>;
  return receipt.status === 'ok' || receipt.status === 'error';
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const expectedSecret = Deno.env.get('PUSH_RECEIPT_SECRET') ?? '';
  const suppliedSecret = request.headers.get('x-scholara-receipt-secret') ?? '';
  if (!expectedSecret || !safeEqual(expectedSecret, suppliedSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return new Response('Server configuration error', { status: 500 });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error: claimError } = await admin.rpc('claim_pending_push_receipts', { batch_size: 200 });
  if (claimError) return new Response('Receipt claim failed', { status: 500 });

  const claimed = (Array.isArray(data) ? data : []) as ClaimedDelivery[];
  if (!claimed.length) {
    await admin.rpc('cleanup_old_push_deliveries', { batch_size: 500 });
    return Response.json({ checked: 0 });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoAccessToken) headers.Authorization = `Bearer ${expoAccessToken}`;

  let receipts: Record<string, unknown>;
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids: claimed.map((delivery) => delivery.ticket_id) }),
    });
    if (!response.ok) throw new Error(`Expo receipt service returned ${response.status}`);
    const result = await response.json() as { data?: Record<string, unknown> };
    receipts = result.data && typeof result.data === 'object' ? result.data : {};
  } catch {
    return new Response('Receipt service unavailable', { status: 502 });
  }

  let confirmed = 0;
  let failed = 0;
  let pending = 0;

  for (const delivery of claimed) {
    const receipt = receipts[delivery.ticket_id];
    if (!isReceipt(receipt)) {
      if (delivery.attempt_count >= 6) {
        await admin.from('push_deliveries').update({
          status: 'error',
          receipt_status: 'error',
          receipt_checked_at: new Date().toISOString(),
          next_receipt_check_at: null,
          error_code: 'receipt_unavailable',
        }).eq('id', delivery.delivery_id);
        failed += 1;
      } else {
        pending += 1;
      }
      continue;
    }

    if (receipt.status === 'ok') {
      await admin.from('push_deliveries').update({
        receipt_status: 'ok',
        receipt_checked_at: new Date().toISOString(),
        next_receipt_check_at: null,
        error_code: null,
      }).eq('id', delivery.delivery_id);
      confirmed += 1;
      continue;
    }

    const providerError = receipt.details?.error;
    const errorCode = typeof providerError === 'string' && providerError
      ? providerError.slice(0, 100)
      : 'expo_receipt_error';
    await admin.from('push_deliveries').update({
      status: 'error',
      receipt_status: 'error',
      receipt_checked_at: new Date().toISOString(),
      next_receipt_check_at: null,
      error_code: errorCode,
    }).eq('id', delivery.delivery_id);
    if (errorCode === 'DeviceNotRegistered') {
      await admin.from('push_tokens').delete().eq('id', delivery.push_token_id);
    }
    failed += 1;
  }

  await admin.rpc('cleanup_old_push_deliveries', { batch_size: 500 });
  return Response.json({ checked: claimed.length, confirmed, failed, pending });
});
