-- Phase 1: private account settings, consent records, export requests, and account deletion.

create table public.legal_documents (
  document_key text not null,
  version text not null,
  published_at timestamptz not null,
  required boolean not null default true,
  primary key (document_key, version),
  constraint legal_documents_key_check check (document_key in ('terms', 'privacy', 'community_guidelines')),
  constraint legal_documents_version_check check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);

insert into public.legal_documents (document_key, version, published_at) values
  ('terms', '2026-09-11', '2026-09-11 00:00:00+00'),
  ('privacy', '2026-09-11', '2026-09-11 00:00:00+00'),
  ('community_guidelines', '2026-09-11', '2026-09-11 00:00:00+00');

create table public.legal_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, document_key, version),
  foreign key (document_key, version) references public.legal_documents(document_key, version)
);

create table public.user_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  matches_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  community_enabled boolean not null default true,
  product_updates_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  constraint data_export_status_check check (status in ('pending', 'processing', 'completed', 'failed', 'expired')),
  constraint data_export_completion_check check ((status = 'completed') = (completed_at is not null))
);
create index data_export_requests_user_requested_idx
on public.data_export_requests (user_id, requested_at desc);

alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.data_export_requests enable row level security;
revoke all on table public.legal_documents, public.legal_acceptances,
  public.user_notification_preferences, public.data_export_requests from anon, authenticated;
grant all on table public.legal_documents, public.legal_acceptances,
  public.user_notification_preferences, public.data_export_requests to service_role;

create or replace function public.get_account_settings()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
declare result jsonb;
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  insert into public.user_notification_preferences (user_id) values (caller_id) on conflict do nothing;
  select jsonb_build_object(
    'notifications', jsonb_build_object(
      'matches', n.matches_enabled, 'messages', n.messages_enabled,
      'community', n.community_enabled, 'productUpdates', n.product_updates_enabled),
    'privacy', jsonb_build_object(
      'currentLocation', p.show_current_location,
      'relocationDestination', p.show_relocation_destination,
      'relocationDate', p.show_relocation_date),
    'legal', coalesce((select jsonb_object_agg(d.document_key, jsonb_build_object(
      'version', d.version, 'accepted', exists (select 1 from public.legal_acceptances a
        where a.user_id = caller_id and a.document_key = d.document_key and a.version = d.version)))
      from public.legal_documents d where d.required), '{}'::jsonb),
    'latestExport', (select jsonb_build_object('id', e.id, 'status', e.status, 'requestedAt', e.requested_at)
      from public.data_export_requests e where e.user_id = caller_id order by e.requested_at desc limit 1)
  ) into result
  from public.user_notification_preferences n
  join public.profiles p on p.id = n.user_id
  where n.user_id = caller_id;
  return coalesce(result, '{}'::jsonb);
end; $$;

create or replace function public.update_notification_preferences(
  matches_enabled boolean, messages_enabled boolean, community_enabled boolean, product_updates_enabled boolean
) returns boolean language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if matches_enabled is null or messages_enabled is null or community_enabled is null or product_updates_enabled is null then
    raise exception using errcode = '22023', message = 'Preferences cannot be null';
  end if;
  insert into public.user_notification_preferences as preferences
    (user_id, matches_enabled, messages_enabled, community_enabled, product_updates_enabled)
  values (caller_id, matches_enabled, messages_enabled, community_enabled, product_updates_enabled)
  on conflict (user_id) do update set matches_enabled = excluded.matches_enabled,
    messages_enabled = excluded.messages_enabled, community_enabled = excluded.community_enabled,
    product_updates_enabled = excluded.product_updates_enabled, updated_at = now();
  return true;
end; $$;

create or replace function public.update_profile_privacy(
  current_location_visible boolean, relocation_destination_visible boolean, relocation_date_visible boolean
) returns boolean language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if current_location_visible is null or relocation_destination_visible is null or relocation_date_visible is null then
    raise exception using errcode = '22023', message = 'Privacy choices cannot be null';
  end if;
  update public.profiles set show_current_location = current_location_visible,
    show_relocation_destination = is_relocating and relocation_destination_visible,
    show_relocation_date = is_relocating and relocation_date_visible
  where id = caller_id;
  return found;
end; $$;

create or replace function public.accept_current_legal_documents()
returns integer language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
declare accepted_count integer;
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  insert into public.legal_acceptances (user_id, document_key, version)
  select caller_id, document_key, version from public.legal_documents where required
  on conflict do nothing;
  get diagnostics accepted_count = row_count;
  return accepted_count;
end; $$;

create or replace function public.request_data_export()
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
declare request_id uuid;
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text || ':export', 0));
  select id into request_id from public.data_export_requests
    where user_id = caller_id and requested_at > now() - interval '24 hours'
    order by requested_at desc limit 1;
  if request_id is not null then return request_id; end if;
  insert into public.data_export_requests (user_id) values (caller_id) returning id into request_id;
  return request_id;
end; $$;

create or replace function public.delete_my_account(confirmation text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
declare issued_at bigint := coalesce((select auth.jwt() ->> 'iat')::bigint, 0);
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if confirmation is distinct from 'DELETE' then raise exception using errcode = '22023', message = 'Invalid confirmation'; end if;
  if extract(epoch from now())::bigint - issued_at > 600 then
    raise exception using errcode = '42501', message = 'Recent authentication required';
  end if;
  delete from auth.users where id = caller_id;
  return found;
end; $$;

revoke all on function public.get_account_settings(),
  public.update_notification_preferences(boolean, boolean, boolean, boolean),
  public.update_profile_privacy(boolean, boolean, boolean), public.accept_current_legal_documents(),
  public.request_data_export(), public.delete_my_account(text) from public, anon, authenticated;
grant execute on function public.get_account_settings(),
  public.update_notification_preferences(boolean, boolean, boolean, boolean),
  public.update_profile_privacy(boolean, boolean, boolean), public.accept_current_legal_documents(),
  public.request_data_export(), public.delete_my_account(text) to authenticated, service_role;
