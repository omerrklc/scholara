-- Device registrations and idempotent delivery records for native push notifications.

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  device_id text not null,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, device_id),
  constraint push_tokens_token_shape check (
    expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$'
  ),
  constraint push_tokens_device_shape check (
    char_length(device_id) between 16 and 128
    and device_id ~ '^[A-Za-z0-9._:-]+$'
  )
);

create index push_tokens_user_updated_idx on public.push_tokens (user_id, updated_at desc);

alter table public.push_tokens enable row level security;
revoke all on table public.push_tokens from public, anon, authenticated;
grant all on table public.push_tokens to service_role;

create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  push_token_id uuid not null references public.push_tokens(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'sent', 'error')),
  ticket_id text,
  error_code text,
  attempted_at timestamptz not null default now(),
  unique (notification_id, push_token_id),
  constraint push_deliveries_ticket_length check (ticket_id is null or char_length(ticket_id) <= 200),
  constraint push_deliveries_error_length check (error_code is null or char_length(error_code) <= 100)
);

create index push_deliveries_notification_idx on public.push_deliveries (notification_id, attempted_at desc);

alter table public.push_deliveries enable row level security;
revoke all on table public.push_deliveries from public, anon, authenticated;
grant all on table public.push_deliveries to service_role;

create or replace function public.register_push_token(
  push_token text,
  device_identifier text,
  device_platform text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if push_token is null or push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$' then
    raise exception using errcode = '22023', message = 'Invalid push token';
  end if;
  if device_identifier is null
     or char_length(device_identifier) not between 16 and 128
     or device_identifier !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'Invalid device identifier';
  end if;
  if device_platform not in ('android', 'ios') then
    raise exception using errcode = '22023', message = 'Invalid device platform';
  end if;

  -- A device registration moves to the currently authenticated account after
  -- sign-out/sign-in. These values are routing identifiers, not credentials.
  delete from public.push_tokens
  where device_id = device_identifier
     or (expo_push_token = push_token and user_id = caller_id);

  insert into public.push_tokens (user_id, expo_push_token, device_id, platform)
  values (caller_id, push_token, device_identifier, device_platform);

  -- Bound abandoned device registrations per account.
  delete from public.push_tokens
  where id in (
    select id from public.push_tokens
    where user_id = caller_id
    order by last_seen_at desc, id desc
    offset 10
  );

  return true;
end;
$$;

create or replace function public.unregister_push_token(device_identifier text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if device_identifier is null or char_length(device_identifier) not between 16 and 128 then
    raise exception using errcode = '22023', message = 'Invalid device identifier';
  end if;

  delete from public.push_tokens
  where user_id = caller_id and device_id = device_identifier;
  return found;
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon, authenticated;
revoke all on function public.unregister_push_token(text) from public, anon, authenticated;
grant execute on function public.register_push_token(text, text, text) to authenticated, service_role;
grant execute on function public.unregister_push_token(text) to authenticated, service_role;
