-- On-demand public profile detail. Returns one bounded, privacy-filtered row.

create or replace function public.get_profile_detail(target_profile_id uuid)
returns table (
  id uuid,
  full_name text,
  username text,
  avatar_path text,
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
  relocation_date text,
  languages jsonb,
  connection_state text,
  viewer_saved boolean
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

  if target_profile_id is null or target_profile_id = caller_id then
    raise exception using errcode = '22023', message = 'Choose another researcher';
  end if;

  return query
  select
    profiles.id,
    profiles.full_name,
    profiles.username,
    profiles.avatar_path,
    profiles.academic_stage,
    profiles.university,
    profiles.department,
    profiles.program,
    profiles.research_description,
    profiles.research_interests,
    profiles.intents,
    case when profiles.show_current_location then profiles.current_city else '' end,
    case when profiles.show_current_location then profiles.current_country else '' end,
    profiles.is_relocating,
    case when profiles.show_relocation_destination then profiles.destination_city else '' end,
    case when profiles.show_relocation_destination then profiles.destination_country else '' end,
    case when profiles.show_relocation_date then profiles.relocation_date else '' end,
    profiles.languages,
    coalesce((
      select case
        when connection_requests.status = 'accepted' then 'matched'
        when connection_requests.requester_id = caller_id then 'sent'
        else 'received'
      end
      from public.connection_requests
      where (connection_requests.requester_id = caller_id and connection_requests.recipient_id = profiles.id)
         or (connection_requests.requester_id = profiles.id and connection_requests.recipient_id = caller_id)
      limit 1
    ), 'none')::text,
    exists (
      select 1 from public.saved_profiles
      where saved_profiles.user_id = caller_id
        and saved_profiles.saved_profile_id = profiles.id
    )
  from public.profiles
  where profiles.id = target_profile_id
    and profiles.onboarding_completed
    and not exists (
      select 1 from public.blocked_users
      where (blocked_users.blocker_id = caller_id and blocked_users.blocked_user_id = profiles.id)
         or (blocked_users.blocker_id = profiles.id and blocked_users.blocked_user_id = caller_id)
    )
  limit 1;
end;
$$;

revoke all on function public.get_profile_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_profile_detail(uuid) to authenticated, service_role;
