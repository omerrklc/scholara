-- Scholara profile privacy: location details are private unless the owner opts in.

alter table public.profiles
  add column if not exists show_current_location boolean not null default false,
  add column if not exists show_relocation_destination boolean not null default false,
  add column if not exists show_relocation_date boolean not null default false;

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
    profiles.intents,
    case when profiles.show_current_location then profiles.current_city else '' end,
    case when profiles.show_current_location then profiles.current_country else '' end,
    profiles.is_relocating,
    case when profiles.show_relocation_destination then profiles.destination_city else '' end,
    case when profiles.show_relocation_destination then profiles.destination_country else '' end,
    case when profiles.show_relocation_date then profiles.relocation_date else '' end
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
