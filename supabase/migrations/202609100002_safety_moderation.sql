-- Scholara Phase 3: blocking and private moderation reports.

create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  constraint blocked_users_not_self check (blocker_id <> blocked_user_id)
);

alter table public.blocked_users enable row level security;
create index if not exists blocked_users_blocked_user_idx
on public.blocked_users (blocked_user_id, blocker_id);

revoke all on table public.blocked_users from anon, authenticated;
grant select on table public.blocked_users to authenticated;
grant all on table public.blocked_users to service_role;

drop policy if exists "Users can view their own blocks" on public.blocked_users;
create policy "Users can view their own blocks"
on public.blocked_users for select
to authenticated
using ((select auth.uid()) = blocker_id);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'impersonation', 'inappropriate_content', 'privacy', 'other')),
  details text not null default '' check (char_length(details) <= 1000 and details = btrim(details)),
  source text not null check (source in ('discover', 'matches', 'chat', 'profile')),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists user_reports_status_created_idx
on public.user_reports (status, created_at desc);

create index if not exists user_reports_reported_user_idx
on public.user_reports (reported_user_id, created_at desc);

alter table public.user_reports enable row level security;
revoke all on table public.user_reports from anon, authenticated;
grant all on table public.user_reports to service_role;

create or replace function public.is_blocked_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.blocked_users
    where (blocked_users.blocker_id = (select auth.uid()) and blocked_users.blocked_user_id = target_user_id)
       or (blocked_users.blocker_id = target_user_id and blocked_users.blocked_user_id = (select auth.uid()))
  );
$$;

revoke all on function public.is_blocked_with(uuid) from public, anon, authenticated;
grant execute on function public.is_blocked_with(uuid) to authenticated, service_role;

create or replace function public.block_user(target_user_id uuid)
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
  if target_user_id is null or target_user_id = caller_id then
    raise exception using errcode = '22023', message = 'Invalid user';
  end if;
  if not exists (select 1 from public.profiles where profiles.id = target_user_id) then
    raise exception using errcode = '22023', message = 'User is unavailable';
  end if;

  insert into public.blocked_users (blocker_id, blocked_user_id)
  values (caller_id, target_user_id)
  on conflict do nothing;

  delete from public.saved_profiles
  where (user_id = caller_id and saved_profile_id = target_user_id)
     or (user_id = target_user_id and saved_profile_id = caller_id);

  delete from public.connection_requests
  where (requester_id = caller_id and recipient_id = target_user_id)
     or (requester_id = target_user_id and recipient_id = caller_id);

  return true;
end;
$$;

revoke all on function public.block_user(uuid) from public, anon, authenticated;
grant execute on function public.block_user(uuid) to authenticated, service_role;

create or replace function public.unblock_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  removed_count integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  delete from public.blocked_users
  where blocker_id = caller_id
    and blocked_user_id = target_user_id;
  get diagnostics removed_count = row_count;
  return removed_count > 0;
end;
$$;

revoke all on function public.unblock_user(uuid) from public, anon, authenticated;
grant execute on function public.unblock_user(uuid) to authenticated, service_role;

create or replace function public.report_user(
  target_user_id uuid,
  report_reason text,
  report_details text default '',
  report_source text default 'profile'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_details text := btrim(coalesce(report_details, ''));
  report_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if target_user_id is null or target_user_id = caller_id then
    raise exception using errcode = '22023', message = 'Invalid reported user';
  end if;
  if report_reason not in ('spam', 'harassment', 'impersonation', 'inappropriate_content', 'privacy', 'other') then
    raise exception using errcode = '22023', message = 'Invalid report reason';
  end if;
  if report_source not in ('discover', 'matches', 'chat', 'profile') then
    raise exception using errcode = '22023', message = 'Invalid report source';
  end if;
  if char_length(clean_details) > 1000 then
    raise exception using errcode = '22023', message = 'Report details are too long';
  end if;
  if not exists (select 1 from public.profiles where profiles.id = target_user_id) then
    raise exception using errcode = '22023', message = 'User is unavailable';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
  if (
    select count(*) from public.user_reports
    where reporter_id = caller_id
      and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception using errcode = 'P0001', message = 'Daily report limit exceeded';
  end if;

  insert into public.user_reports (reporter_id, reported_user_id, reason, details, source)
  values (caller_id, target_user_id, report_reason, clean_details, report_source)
  returning id into report_id;
  return report_id;
end;
$$;

revoke all on function public.report_user(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.report_user(uuid, text, text, text) to authenticated, service_role;

create or replace function public.get_blocked_users()
returns table (
  user_id uuid,
  full_name text,
  academic_stage text,
  university text,
  blocked_at timestamptz
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
  select profiles.id, profiles.full_name, profiles.academic_stage, profiles.university, blocked_users.created_at
  from public.blocked_users
  join public.profiles on profiles.id = blocked_users.blocked_user_id
  where blocked_users.blocker_id = caller_id
  order by blocked_users.created_at desc
  limit 200;
end;
$$;

revoke all on function public.get_blocked_users() from public, anon, authenticated;
grant execute on function public.get_blocked_users() to authenticated, service_role;

create or replace function public.prevent_blocked_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.blocked_users
    where (blocker_id = new.requester_id and blocked_user_id = new.recipient_id)
       or (blocker_id = new.recipient_id and blocked_user_id = new.requester_id)
  ) then
    raise exception using errcode = '42501', message = 'Connection is not available';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_blocked_connection() from public, anon, authenticated;

drop trigger if exists connection_requests_prevent_blocked on public.connection_requests;
create trigger connection_requests_prevent_blocked
before insert or update on public.connection_requests
for each row execute function public.prevent_blocked_connection();

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
  ) and not exists (
    select 1 from public.blocked_users
    where (blocker_id = first_user_id and blocked_user_id = second_user_id)
       or (blocker_id = second_user_id and blocked_user_id = first_user_id)
  );
$$;

revoke all on function public.are_matched(uuid, uuid) from public, anon, authenticated;
grant execute on function public.are_matched(uuid, uuid) to service_role;

drop policy if exists "Matched participants can read messages" on public.messages;
create policy "Matched participants can read messages"
on public.messages for select
to authenticated
using (
  (select auth.uid()) in (sender_id, recipient_id)
  and exists (
    select 1 from public.connection_requests
    where connection_requests.status = 'accepted'
      and (
        (connection_requests.requester_id = messages.sender_id and connection_requests.recipient_id = messages.recipient_id)
        or (connection_requests.requester_id = messages.recipient_id and connection_requests.recipient_id = messages.sender_id)
      )
  )
  and not public.is_blocked_with(
    case when sender_id = (select auth.uid()) then recipient_id else sender_id end
  )
);

create or replace function public.is_discoverable_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = target_profile_id
      and profiles.onboarding_completed
  ) and not exists (
    select 1 from public.blocked_users
    where (blocker_id = (select auth.uid()) and blocked_user_id = target_profile_id)
       or (blocker_id = target_profile_id and blocked_user_id = (select auth.uid()))
  );
$$;

revoke all on function public.is_discoverable_profile(uuid) from public, anon, authenticated;
grant execute on function public.is_discoverable_profile(uuid) to authenticated, service_role;

create or replace function public.discover_profiles()
returns table (
  id uuid, full_name text, academic_stage text, university text, department text, program text,
  research_description text, research_interests text[], intents text[], current_city text,
  current_country text, is_relocating boolean, destination_city text, destination_country text,
  relocation_date text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  return query
  select profiles.id, profiles.full_name, profiles.academic_stage, profiles.university,
    profiles.department, profiles.program, profiles.research_description, profiles.research_interests,
    profiles.intents, profiles.current_city, profiles.current_country, profiles.is_relocating,
    profiles.destination_city, profiles.destination_country, profiles.relocation_date
  from public.profiles
  where profiles.onboarding_completed
    and profiles.id <> (select auth.uid())
    and not exists (
      select 1 from public.blocked_users
      where (blocker_id = (select auth.uid()) and blocked_user_id = profiles.id)
         or (blocker_id = profiles.id and blocked_user_id = (select auth.uid()))
    )
  order by profiles.updated_at desc
  limit 50;
end;
$$;

revoke all on function public.discover_profiles() from public, anon, authenticated;
grant execute on function public.discover_profiles() to authenticated, service_role;

create or replace function public.get_conversation_summaries()
returns table (
  other_user_id uuid, other_name text, other_stage text, other_university text,
  last_message text, last_message_at timestamptz, unread_count bigint
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
    select case when connection_requests.requester_id = caller_id
      then connection_requests.recipient_id else connection_requests.requester_id end as matched_user_id
    from public.connection_requests
    where connection_requests.status = 'accepted'
      and caller_id in (connection_requests.requester_id, connection_requests.recipient_id)
  )
  select profiles.id, profiles.full_name, profiles.academic_stage, profiles.university,
    latest.body, latest.created_at, coalesce(unread.total, 0)
  from matched_users
  join public.profiles on profiles.id = matched_users.matched_user_id
  left join lateral (
    select messages.body, messages.created_at from public.messages
    where (messages.sender_id = caller_id and messages.recipient_id = matched_users.matched_user_id)
       or (messages.sender_id = matched_users.matched_user_id and messages.recipient_id = caller_id)
    order by messages.created_at desc limit 1
  ) as latest on true
  left join lateral (
    select count(*) as total from public.messages
    where messages.sender_id = matched_users.matched_user_id
      and messages.recipient_id = caller_id and messages.read_at is null
  ) as unread on true
  where not exists (
    select 1 from public.blocked_users
    where (blocker_id = caller_id and blocked_user_id = matched_users.matched_user_id)
       or (blocker_id = matched_users.matched_user_id and blocked_user_id = caller_id)
  )
  order by latest.created_at desc nulls last, profiles.full_name
  limit 100;
end;
$$;

revoke all on function public.get_conversation_summaries() from public, anon, authenticated;
grant execute on function public.get_conversation_summaries() to authenticated, service_role;
