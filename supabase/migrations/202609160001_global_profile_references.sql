-- Canonical global institution and location references with legacy-safe profile migration.

create table public.reference_institutions (
  ror_id text primary key,
  display_name text not null,
  country_code text not null,
  country_name text not null,
  city_name text not null default '',
  organization_types text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint reference_institutions_ror_shape check (ror_id ~ '^https://ror\.org/0[0-9a-hjkmnp-tv-z]{8}$'),
  constraint reference_institutions_name_length check (char_length(display_name) between 1 and 200),
  constraint reference_institutions_country_shape check (country_code ~ '^[A-Z]{2}$'),
  constraint reference_institutions_country_length check (char_length(country_name) between 1 and 100),
  constraint reference_institutions_city_length check (char_length(city_name) <= 100),
  constraint reference_institutions_types_limit check (cardinality(organization_types) <= 10)
);

create table public.reference_cities (
  geonames_id bigint primary key check (geonames_id > 0),
  display_name text not null,
  admin1_name text not null default '',
  country_code text not null,
  country_name text not null,
  population bigint,
  updated_at timestamptz not null default now(),
  constraint reference_cities_name_length check (char_length(display_name) between 1 and 120),
  constraint reference_cities_admin_length check (char_length(admin1_name) <= 120),
  constraint reference_cities_country_shape check (country_code ~ '^[A-Z]{2}$'),
  constraint reference_cities_country_length check (char_length(country_name) between 1 and 100),
  constraint reference_cities_population_check check (population is null or population >= 0)
);

create table public.reference_search_cache (
  cache_key text primary key,
  response jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint reference_search_cache_key_shape check (cache_key ~ '^[0-9a-f]{64}$'),
  constraint reference_search_cache_response_shape check (jsonb_typeof(response) = 'array')
);

create table public.reference_search_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count between 1 and 61)
);

alter table public.reference_institutions enable row level security;
alter table public.reference_cities enable row level security;
alter table public.reference_search_cache enable row level security;
alter table public.reference_search_limits enable row level security;

revoke all on table public.reference_institutions, public.reference_cities,
  public.reference_search_cache, public.reference_search_limits from public, anon, authenticated;
grant all on table public.reference_institutions, public.reference_cities,
  public.reference_search_cache, public.reference_search_limits to service_role;

create or replace function public.consume_reference_search_quota(
  target_user_id uuid,
  maximum_requests integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if target_user_id is null or maximum_requests is null or maximum_requests not between 1 and 60 then
    raise exception using errcode = '22023', message = 'Invalid quota request';
  end if;
  if not exists (select 1 from auth.users where id = target_user_id) then
    return false;
  end if;

  insert into public.reference_search_limits as limits (user_id, window_started_at, request_count)
  values (target_user_id, now(), 1)
  on conflict (user_id) do update set
    window_started_at = case
      when limits.window_started_at <= now() - interval '5 minutes' then now()
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at <= now() - interval '5 minutes' then 1
      else least(61, limits.request_count + 1)
    end
  returning request_count <= maximum_requests into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_reference_search_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_reference_search_quota(uuid, integer) to service_role;

create or replace function public.cleanup_reference_search_cache(batch_size integer default 200)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if batch_size is null or batch_size not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'Invalid cleanup batch';
  end if;
  with expired as (
    select cache_key from public.reference_search_cache
    where expires_at <= now()
    order by expires_at
    limit batch_size
  )
  delete from public.reference_search_cache cache
  using expired
  where cache.cache_key = expired.cache_key;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.cleanup_reference_search_cache(integer) from public, anon, authenticated;
grant execute on function public.cleanup_reference_search_cache(integer) to service_role;

alter table public.profiles
  add column normalization_version smallint not null default 0,
  add column institution_ror_id text references public.reference_institutions(ror_id),
  add column institution_country_code text,
  add column current_city_geonames_id bigint references public.reference_cities(geonames_id),
  add column current_country_code text,
  add column destination_city_geonames_id bigint references public.reference_cities(geonames_id),
  add column destination_country_code text;

alter table public.profiles
  add constraint profiles_normalization_version_check check (normalization_version in (0, 1)),
  add constraint profiles_institution_country_code_shape check (
    institution_country_code is null or institution_country_code ~ '^[A-Z]{2}$'
  ),
  add constraint profiles_current_country_code_shape check (
    current_country_code is null or current_country_code ~ '^[A-Z]{2}$'
  ),
  add constraint profiles_destination_country_code_shape check (
    destination_country_code is null or destination_country_code ~ '^[A-Z]{2}$'
  ),
  add constraint profiles_normalized_references_complete check (
    normalization_version = 0
    or (
      current_city_geonames_id is not null
      and current_country_code is not null
      and (
        institution_ror_id is not null
        or (char_length(btrim(university)) between 1 and 160 and institution_country_code is not null)
      )
      and (
        (not is_relocating and destination_city_geonames_id is null and destination_country_code is null
          and destination_city = '' and destination_country = '')
        or (is_relocating and destination_city_geonames_id is not null and destination_country_code is not null)
      )
    )
  );

create index profiles_institution_ror_idx on public.profiles (institution_ror_id)
where institution_ror_id is not null and onboarding_completed;
create index profiles_current_location_ref_idx on public.profiles (current_country_code, current_city_geonames_id)
where normalization_version = 1 and onboarding_completed;
create index profiles_destination_location_ref_idx on public.profiles (destination_country_code, destination_city_geonames_id)
where normalization_version = 1 and onboarding_completed and is_relocating;

create or replace function public.canonicalize_profile_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  institution public.reference_institutions%rowtype;
  current_place public.reference_cities%rowtype;
  destination_place public.reference_cities%rowtype;
begin
  if tg_op = 'UPDATE' and old.normalization_version = 1 and new.normalization_version <> 1 then
    raise exception using errcode = '22023', message = 'Normalized profiles cannot be downgraded';
  end if;

  if new.normalization_version = 1 then
    if new.institution_ror_id is not null then
      select * into institution from public.reference_institutions where ror_id = new.institution_ror_id;
      if not found then
        raise exception using errcode = '22023', message = 'Choose a verified institution';
      end if;
      new.university := institution.display_name;
      new.institution_country_code := institution.country_code;
    elsif char_length(btrim(new.university)) < 1 or new.institution_country_code is null then
      raise exception using errcode = '22023', message = 'Confirm the institution and country';
    end if;

    select * into current_place from public.reference_cities where geonames_id = new.current_city_geonames_id;
    if not found then
      raise exception using errcode = '22023', message = 'Choose a verified current city';
    end if;
    new.current_city := current_place.display_name;
    new.current_country := current_place.country_name;
    new.current_country_code := current_place.country_code;

    if new.is_relocating then
      select * into destination_place from public.reference_cities where geonames_id = new.destination_city_geonames_id;
      if not found then
        raise exception using errcode = '22023', message = 'Choose a verified destination city';
      end if;
      new.destination_city := destination_place.display_name;
      new.destination_country := destination_place.country_name;
      new.destination_country_code := destination_place.country_code;
    else
      new.destination_city := '';
      new.destination_country := '';
      new.destination_city_geonames_id := null;
      new.destination_country_code := null;
      new.relocation_date := '';
      new.show_relocation_destination := false;
      new.show_relocation_date := false;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.canonicalize_profile_references() from public, anon, authenticated;

create trigger profiles_canonicalize_references
before insert or update on public.profiles
for each row execute function public.canonicalize_profile_references();

drop function if exists public.discover_profiles();
create function public.discover_profiles()
returns table (
  id uuid, full_name text, avatar_path text, academic_stage text, university text,
  institution_ror_id text, institution_country_code text,
  department text, program text, research_description text, research_interests text[], intents text[],
  current_city text, current_country text, current_city_geonames_id bigint, current_country_code text,
  is_relocating boolean, destination_city text, destination_country text,
  destination_city_geonames_id bigint, destination_country_code text, relocation_date text
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
    profiles.university, profiles.institution_ror_id, profiles.institution_country_code,
    profiles.department, profiles.program, profiles.research_description,
    profiles.research_interests, profiles.intents,
    case when profiles.show_current_location then profiles.current_city else '' end,
    case when profiles.show_current_location then profiles.current_country else '' end,
    case when profiles.show_current_location then profiles.current_city_geonames_id else null end,
    case when profiles.show_current_location then profiles.current_country_code else null end,
    profiles.is_relocating,
    case when profiles.show_relocation_destination then profiles.destination_city else '' end,
    case when profiles.show_relocation_destination then profiles.destination_country else '' end,
    case when profiles.show_relocation_destination then profiles.destination_city_geonames_id else null end,
    case when profiles.show_relocation_destination then profiles.destination_country_code else null end,
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

drop function if exists public.get_profile_detail(uuid);
create function public.get_profile_detail(target_profile_id uuid)
returns table (
  id uuid, full_name text, username text, avatar_path text, academic_stage text,
  university text, institution_ror_id text, institution_country_code text,
  department text, program text, research_description text, research_interests text[], intents text[],
  current_city text, current_country text, current_city_geonames_id bigint, current_country_code text,
  is_relocating boolean, destination_city text, destination_country text,
  destination_city_geonames_id bigint, destination_country_code text, relocation_date text,
  languages jsonb, connection_state text, viewer_saved boolean
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
  select profiles.id, profiles.full_name, profiles.username, profiles.avatar_path, profiles.academic_stage,
    profiles.university, profiles.institution_ror_id, profiles.institution_country_code,
    profiles.department, profiles.program, profiles.research_description,
    profiles.research_interests, profiles.intents,
    case when profiles.show_current_location then profiles.current_city else '' end,
    case when profiles.show_current_location then profiles.current_country else '' end,
    case when profiles.show_current_location then profiles.current_city_geonames_id else null end,
    case when profiles.show_current_location then profiles.current_country_code else null end,
    profiles.is_relocating,
    case when profiles.show_relocation_destination then profiles.destination_city else '' end,
    case when profiles.show_relocation_destination then profiles.destination_country else '' end,
    case when profiles.show_relocation_destination then profiles.destination_city_geonames_id else null end,
    case when profiles.show_relocation_destination then profiles.destination_country_code else null end,
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
      where saved_profiles.user_id = caller_id and saved_profiles.saved_profile_id = profiles.id
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
