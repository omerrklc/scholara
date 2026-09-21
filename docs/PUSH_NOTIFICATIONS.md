# Native push notification delivery

Scholara uses Expo Push Service for transport and keeps authorization decisions in Supabase.

## Data flow

1. The installed app asks the user for notification permission.
2. The Expo push token is registered through `register_push_token`; the token table is not directly readable by app roles.
3. Existing database triggers create an authorized row in `public.notifications` after a connection, match, message, comment, or helpful reaction.
4. A Supabase Database Webhook sends only the inserted notification record to `send-push-notification`.
5. The Edge Function authenticates the webhook with `PUSH_WEBHOOK_SECRET`, resolves the recipient's protected device tokens with the service role, and sends a bounded Expo payload.
6. A delivery record prevents replayed webhooks from sending the same notification twice. Immediate `DeviceNotRegistered` errors remove the stale token.

The mobile app never receives a service-role key, Firebase private key, webhook secret, or another user's push token.

## Hosted setup

Perform these steps on a non-production Supabase project first.

1. Apply `202609140001_push_notifications.sql` after reconciling remote migration history.
2. Generate a random secret of at least 32 bytes and store it as the Edge Function secret `PUSH_WEBHOOK_SECRET`.
3. Deploy `send-push-notification` with JWT verification disabled. The function still requires the custom webhook secret and rejects every request without it.
4. In **Database → Webhooks**, create one webhook:
   - Table: `public.notifications`
   - Event: `INSERT`
   - Method: `POST`
   - URL: `https://<project-ref>.supabase.co/functions/v1/send-push-notification`
   - Header: `x-scholara-webhook-secret: <the same secret>`
5. Keep the existing FCM V1 credential assigned to `com.scholara.app` in Expo/EAS.
6. Open **Settings → Notifications** in the installed development build and enable phone notifications.

Do not paste the webhook secret, service-role key, or Firebase service-account JSON into source control, SQL migrations, `EXPO_PUBLIC_` variables, screenshots, or support messages.

## Operational follow-up

Expo push tickets only confirm acceptance by Expo. A scheduled receipt worker should query receipts after roughly 15 minutes, retain bounded delivery metrics, retry transient failures with backoff, and remove tokens reported as `DeviceNotRegistered`. This is required before a large public rollout.

