-- Profile reads are owner-only. Discovery uses a bounded, column-limited
-- security-definer function instead of exposing the base table.

drop policy if exists "Authenticated users can discover profiles" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create or replace function public.discover_profiles()
returns table (
  id uuid,
  full_name text,
  academic_stage text,
  university text,
  department text,
  program text,
  research_description text,
  research_interests text[],
  intents text[],
  current_city text,
  current_country text,
  is_relocating boolean,
  destination_city text,
  destination_country text,
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
  select
    profiles.id,
    profiles.full_name,
    profiles.academic_stage,
    profiles.university,
    profiles.department,
    profiles.program,
    profiles.research_description,
    profiles.research_interests,
    profiles.intents,
    profiles.current_city,
    profiles.current_country,
    profiles.is_relocating,
    profiles.destination_city,
    profiles.destination_country,
    profiles.relocation_date
  from public.profiles
  where profiles.onboarding_completed
    and profiles.id <> (select auth.uid())
  order by profiles.updated_at desc
  limit 50;
end;
$$;

revoke all on function public.discover_profiles() from public, anon, authenticated;
grant execute on function public.discover_profiles() to authenticated;

-- The Phase 3 save policy previously queried profiles as the caller. Once the
-- base table is owner-only, that check must cross the RLS boundary through a
-- narrowly scoped boolean helper instead of reopening profile reads.
create or replace function public.is_discoverable_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = target_profile_id
      and profiles.onboarding_completed
  );
$$;

revoke all on function public.is_discoverable_profile(uuid) from public, anon, authenticated;
grant execute on function public.is_discoverable_profile(uuid) to authenticated;

drop policy if exists "Users can save completed profiles" on public.saved_profiles;
create policy "Users can save completed profiles"
on public.saved_profiles for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and public.is_discoverable_profile(saved_profile_id)
);
