-- Scholara Phase 2: authenticated academic profiles with least-privilege access.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text not null unique,
  academic_stage text not null default '' check (
    academic_stage in ('', 'Final-year undergraduate', 'Master''s student', 'PhD student', 'Postdoc')
  ),
  university text not null default '',
  department text not null default '',
  program text not null default '',
  research_description text not null default '',
  research_interests text[] not null default '{}',
  intents text[] not null default '{}',
  current_city text not null default '',
  current_country text not null default '',
  is_relocating boolean not null default false,
  destination_city text not null default '',
  destination_country text not null default '',
  relocation_date text not null default '',
  languages jsonb not null default '[{"name":"English","proficiency":"Fluent"}]'::jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) <= 100),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_research_length check (char_length(research_description) <= 3000),
  constraint profiles_languages_array check (jsonb_typeof(languages) = 'array')
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

drop policy if exists "Authenticated users can discover profiles" on public.profiles;
create policy "Authenticated users can discover profiles"
on public.profiles for select
to authenticated
using (onboarding_completed or (select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100),
    'user_' || left(replace(new.id::text, '-', ''), 24)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for accounts created before this migration.
insert into public.profiles (id, full_name, username)
select
  users.id,
  left(coalesce(users.raw_user_meta_data ->> 'full_name', ''), 100),
  'user_' || left(replace(users.id::text, '-', ''), 24)
from auth.users as users
on conflict (id) do nothing;
