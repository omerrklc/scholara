-- Scholara Phase 3: private messaging for mutually matched researchers.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_not_self check (sender_id <> recipient_id),
  constraint messages_body_length check (char_length(body) between 1 and 2000),
  constraint messages_body_trimmed check (body = btrim(body)),
  constraint messages_read_after_send check (read_at is null or read_at >= created_at)
);

create index if not exists messages_conversation_created_idx
on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);

create index if not exists messages_recipient_unread_idx
on public.messages (recipient_id, created_at desc)
where read_at is null;

alter table public.messages enable row level security;

revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;
grant all on table public.messages to service_role;

drop policy if exists "Matched participants can read messages" on public.messages;
create policy "Matched participants can read messages"
on public.messages for select
to authenticated
using (
  (select auth.uid()) in (sender_id, recipient_id)
  and exists (
    select 1
    from public.connection_requests
    where connection_requests.status = 'accepted'
      and (
        (connection_requests.requester_id = messages.sender_id and connection_requests.recipient_id = messages.recipient_id)
        or (connection_requests.requester_id = messages.recipient_id and connection_requests.recipient_id = messages.sender_id)
      )
  )
);

create or replace function public.are_matched(first_user_id uuid, second_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.connection_requests
    where connection_requests.status = 'accepted'
      and (
        (connection_requests.requester_id = first_user_id and connection_requests.recipient_id = second_user_id)
        or (connection_requests.requester_id = second_user_id and connection_requests.recipient_id = first_user_id)
      )
  );
$$;

revoke all on function public.are_matched(uuid, uuid) from public, anon, authenticated;
grant execute on function public.are_matched(uuid, uuid) to service_role;

create or replace function public.send_message(target_user_id uuid, message_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_body text := btrim(message_body);
  new_message_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if target_user_id is null or target_user_id = caller_id then
    raise exception using errcode = '22023', message = 'Invalid recipient';
  end if;

  if clean_body is null or char_length(clean_body) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'Message must be between 1 and 2000 characters';
  end if;

  if not public.are_matched(caller_id, target_user_id) then
    raise exception using errcode = '42501', message = 'A mutual match is required';
  end if;

  if (
    select count(*)
    from public.messages
    where sender_id = caller_id
      and created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception using errcode = 'P0001', message = 'Message rate limit exceeded';
  end if;

  if (
    select count(*)
    from public.messages
    where sender_id = caller_id
      and created_at > now() - interval '1 day'
  ) >= 1000 then
    raise exception using errcode = 'P0001', message = 'Daily message limit exceeded';
  end if;

  insert into public.messages (sender_id, recipient_id, body)
  values (caller_id, target_user_id, clean_body)
  returning id into new_message_id;

  return new_message_id;
end;
$$;

revoke all on function public.send_message(uuid, text) from public, anon, authenticated;
grant execute on function public.send_message(uuid, text) to authenticated, service_role;

create or replace function public.get_conversation_messages(
  other_user_id uuid,
  before_time timestamptz default null,
  page_size integer default 50
)
returns table (
  id uuid,
  sender_id uuid,
  recipient_id uuid,
  body text,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if other_user_id is null or not public.are_matched(caller_id, other_user_id) then
    raise exception using errcode = '42501', message = 'A mutual match is required';
  end if;

  return query
  select messages.id, messages.sender_id, messages.recipient_id, messages.body, messages.created_at, messages.read_at
  from public.messages
  where (
      (messages.sender_id = caller_id and messages.recipient_id = other_user_id)
      or (messages.sender_id = other_user_id and messages.recipient_id = caller_id)
    )
    and (before_time is null or messages.created_at < before_time)
  order by messages.created_at desc
  limit least(greatest(coalesce(page_size, 50), 1), 100);
end;
$$;

revoke all on function public.get_conversation_messages(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.get_conversation_messages(uuid, timestamptz, integer) to authenticated, service_role;

create or replace function public.mark_conversation_read(other_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  updated_count integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if other_user_id is null or not public.are_matched(caller_id, other_user_id) then
    raise exception using errcode = '42501', message = 'A mutual match is required';
  end if;

  update public.messages
  set read_at = now()
  where sender_id = other_user_id
    and recipient_id = caller_id
    and read_at is null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;

create or replace function public.get_conversation_summaries()
returns table (
  other_user_id uuid,
  other_name text,
  other_stage text,
  other_university text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  return query
  with matched_users as (
    select case
      when connection_requests.requester_id = caller_id then connection_requests.recipient_id
      else connection_requests.requester_id
    end as matched_user_id
    from public.connection_requests
    where connection_requests.status = 'accepted'
      and caller_id in (connection_requests.requester_id, connection_requests.recipient_id)
  )
  select
    profiles.id,
    profiles.full_name,
    profiles.academic_stage,
    profiles.university,
    latest.body,
    latest.created_at,
    coalesce(unread.total, 0)
  from matched_users
  join public.profiles on profiles.id = matched_users.matched_user_id
  left join lateral (
    select messages.body, messages.created_at
    from public.messages
    where (messages.sender_id = caller_id and messages.recipient_id = matched_users.matched_user_id)
       or (messages.sender_id = matched_users.matched_user_id and messages.recipient_id = caller_id)
    order by messages.created_at desc
    limit 1
  ) as latest on true
  left join lateral (
    select count(*) as total
    from public.messages
    where messages.sender_id = matched_users.matched_user_id
      and messages.recipient_id = caller_id
      and messages.read_at is null
  ) as unread on true
  order by latest.created_at desc nulls last, profiles.full_name
  limit 100;
end;
$$;

revoke all on function public.get_conversation_summaries() from public, anon, authenticated;
grant execute on function public.get_conversation_summaries() to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
