-- Private profile photo storage with owner-only writes and discovery-aware reads.

alter table public.profiles
  add column if not exists avatar_path text not null default '';

alter table public.profiles
  add constraint profiles_avatar_path_format check (
    avatar_path = '' or avatar_path = id::text || '/avatar.jpg'
  ) not valid;

-- Languages are case-insensitively unique in addition to the existing shape limits.
create or replace function public.is_valid_languages(value_to_check jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  if jsonb_typeof(value_to_check) <> 'array'
     or jsonb_array_length(value_to_check) < 1
     or jsonb_array_length(value_to_check) > 10 then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(value_to_check) as language(value)
    where jsonb_typeof(language.value) <> 'object'
       or not (language.value ? 'name')
       or not (language.value ? 'proficiency')
       or jsonb_typeof(language.value -> 'name') <> 'string'
       or jsonb_typeof(language.value -> 'proficiency') <> 'string'
       or char_length(btrim(language.value ->> 'name')) not between 1 and 50
       or char_length(btrim(language.value ->> 'proficiency')) not between 1 and 30
       or exists (
         select 1 from jsonb_object_keys(language.value) as key
         where key not in ('name', 'proficiency')
       )
  ) then
    return false;
  end if;

  return (
    select count(*) = count(distinct lower(btrim(language.value ->> 'name')))
    from jsonb_array_elements(value_to_check) as language(value)
  );
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_view_profile_photo(target_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_user_id = (select auth.uid())::text
    or exists (
      select 1
      from public.profiles
      where profiles.id::text = target_user_id
        and profiles.onboarding_completed
        and not exists (
          select 1
          from public.blocked_users
          where (blocker_id = (select auth.uid()) and blocked_user_id = profiles.id)
             or (blocker_id = profiles.id and blocked_user_id = (select auth.uid()))
        )
    );
$$;

revoke all on function public.can_view_profile_photo(text) from public, anon, authenticated;
grant execute on function public.can_view_profile_photo(text) to authenticated, service_role;

drop policy if exists "Users can view discoverable profile photos" on storage.objects;
create policy "Users can view discoverable profile photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and public.can_view_profile_photo((storage.foldername(name))[1])
);

drop policy if exists "Users can upload their profile photo" on storage.objects;
create policy "Users can upload their profile photo"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and name = (select auth.uid())::text || '/avatar.jpg'
  and lower(storage.extension(name)) = 'jpg'
);

drop policy if exists "Users can update their profile photo" on storage.objects;
create policy "Users can update their profile photo"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and name = (select auth.uid())::text || '/avatar.jpg'
)
with check (
  bucket_id = 'profile-photos'
  and name = (select auth.uid())::text || '/avatar.jpg'
  and lower(storage.extension(name)) = 'jpg'
);

drop policy if exists "Users can delete their profile photo" on storage.objects;
create policy "Users can delete their profile photo"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and name = (select auth.uid())::text || '/avatar.jpg'
);

drop function if exists public.discover_profiles();
create function public.discover_profiles()
returns table (
  id uuid, full_name text, avatar_path text, academic_stage text, university text,
  department text, program text, research_description text, research_interests text[],
  intents text[], current_city text, current_country text, is_relocating boolean,
  destination_city text, destination_country text, relocation_date text
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
  select profiles.id, profiles.full_name, profiles.avatar_path, profiles.academic_stage,
    profiles.university, profiles.department, profiles.program, profiles.research_description,
    profiles.research_interests, profiles.intents,
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
