-- Scholara Phase 3: private saves and server-enforced mutual connection requests.

create table if not exists public.saved_profiles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  saved_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, saved_profile_id),
  constraint saved_profiles_not_self check (user_id <> saved_profile_id)
);

alter table public.saved_profiles enable row level security;

revoke all on table public.saved_profiles from anon;
revoke all on table public.saved_profiles from authenticated;
grant select, insert, delete on table public.saved_profiles to authenticated;
grant all on table public.saved_profiles to service_role;

drop policy if exists "Users can read their own saved profiles" on public.saved_profiles;
create policy "Users can read their own saved profiles"
on public.saved_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can save completed profiles" on public.saved_profiles;
create policy "Users can save completed profiles"
on public.saved_profiles for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.profiles
    where profiles.id = saved_profile_id
      and profiles.onboarding_completed
  )
);

drop policy if exists "Users can remove their own saved profiles" on public.saved_profiles;
create policy "Users can remove their own saved profiles"
on public.saved_profiles for delete
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.connection_requests (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, recipient_id),
  constraint connection_requests_not_self check (requester_id <> recipient_id)
);

-- Only one row can represent a pair, regardless of who requested first.
create unique index if not exists connection_requests_unique_pair
on public.connection_requests (
  least(requester_id, recipient_id),
  greatest(requester_id, recipient_id)
);

create index if not exists connection_requests_recipient_idx
on public.connection_requests (recipient_id, status);

alter table public.connection_requests enable row level security;

revoke all on table public.connection_requests from anon;
revoke all on table public.connection_requests from authenticated;
grant select on table public.connection_requests to authenticated;
grant all on table public.connection_requests to service_role;

drop policy if exists "Participants can read their connection requests" on public.connection_requests;
create policy "Participants can read their connection requests"
on public.connection_requests for select
to authenticated
using ((select auth.uid()) in (requester_id, recipient_id));

drop trigger if exists connection_requests_set_updated_at on public.connection_requests;
create trigger connection_requests_set_updated_at
before update on public.connection_requests
for each row execute function public.set_updated_at();

create or replace function public.request_connection(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  existing_request public.connection_requests%rowtype;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if target_user_id is null or target_user_id = caller_id then
    raise exception using errcode = '22023', message = 'Choose another researcher';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = target_user_id
      and profiles.onboarding_completed
  ) then
    raise exception using errcode = '22023', message = 'Researcher is not available';
  end if;

  select *
  into existing_request
  from public.connection_requests
  where (requester_id = caller_id and recipient_id = target_user_id)
     or (requester_id = target_user_id and recipient_id = caller_id)
  for update;

  if found then
    if existing_request.status = 'accepted' then
      return 'matched';
    end if;

    if existing_request.recipient_id = caller_id then
      update public.connection_requests
      set status = 'accepted'
      where requester_id = existing_request.requester_id
        and recipient_id = existing_request.recipient_id;
      return 'matched';
    end if;

    return 'pending';
  end if;

  if (
    select count(*)
    from public.connection_requests
    where requester_id = caller_id
      and status = 'pending'
  ) >= 100 then
    raise exception using errcode = 'P0001', message = 'Too many pending connection requests';
  end if;

  begin
    insert into public.connection_requests (requester_id, recipient_id)
    values (caller_id, target_user_id);
    return 'pending';
  exception
    when unique_violation then
      -- A simultaneous request may have created the pair first.
      select *
      into existing_request
      from public.connection_requests
      where (requester_id = caller_id and recipient_id = target_user_id)
         or (requester_id = target_user_id and recipient_id = caller_id)
      for update;

      if found and existing_request.recipient_id = caller_id and existing_request.status = 'pending' then
        update public.connection_requests
        set status = 'accepted'
        where requester_id = existing_request.requester_id
          and recipient_id = existing_request.recipient_id;
        return 'matched';
      end if;

      if found and existing_request.status = 'accepted' then
        return 'matched';
      end if;

      return 'pending';
  end;
end;
$$;

revoke all on function public.request_connection(uuid) from public, anon, authenticated;
grant execute on function public.request_connection(uuid) to authenticated;
grant execute on function public.request_connection(uuid) to service_role;
