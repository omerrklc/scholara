-- Scholara moderation console: server-enforced roles, bounded report review and audit history.

create table if not exists public.moderation_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('moderator', 'admin')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.moderation_roles enable row level security;
revoke all on table public.moderation_roles from public, anon, authenticated;
grant all on table public.moderation_roles to service_role;

alter table public.user_reports
add column if not exists review_notes text not null default '';

alter table public.user_reports
add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.user_reports
add column if not exists updated_at timestamptz not null default now();

alter table public.user_reports
add column if not exists content_excerpt text not null default '';

alter table public.user_reports drop constraint if exists user_reports_review_notes_check;
alter table public.user_reports add constraint user_reports_review_notes_check
check (char_length(review_notes) <= 2000 and review_notes = btrim(review_notes));

alter table public.user_reports drop constraint if exists user_reports_content_excerpt_check;
alter table public.user_reports add constraint user_reports_content_excerpt_check
check (char_length(content_excerpt) <= 2000 and content_excerpt = btrim(content_excerpt));

create table if not exists public.moderation_audit_log (
  id bigint generated always as identity primary key,
  report_id uuid references public.user_reports(id) on delete set null,
  moderator_id uuid references auth.users(id) on delete set null,
  previous_status text not null check (previous_status in ('open', 'reviewing', 'resolved', 'dismissed')),
  new_status text not null check (new_status in ('open', 'reviewing', 'resolved', 'dismissed')),
  notes text not null default '' check (char_length(notes) <= 2000 and notes = btrim(notes)),
  created_at timestamptz not null default now()
);

create index if not exists moderation_audit_log_report_idx
on public.moderation_audit_log (report_id, created_at desc);

alter table public.moderation_audit_log enable row level security;
revoke all on table public.moderation_audit_log from public, anon, authenticated;
grant all on table public.moderation_audit_log to service_role;
grant usage, select on sequence public.moderation_audit_log_id_seq to service_role;

create or replace function public.capture_report_content_excerpt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.community_comment_id is not null then
    select left(btrim(community_comments.body), 2000)
      into new.content_excerpt
    from public.community_comments
    where community_comments.id = new.community_comment_id;
  elsif new.community_post_id is not null then
    select left(btrim(community_posts.body), 2000)
      into new.content_excerpt
    from public.community_posts
    where community_posts.id = new.community_post_id;
  end if;

  new.content_excerpt := coalesce(new.content_excerpt, '');
  return new;
end;
$$;

revoke all on function public.capture_report_content_excerpt() from public, anon, authenticated;

drop trigger if exists user_reports_capture_content_excerpt on public.user_reports;
create trigger user_reports_capture_content_excerpt
before insert on public.user_reports
for each row execute function public.capture_report_content_excerpt();

update public.user_reports
set content_excerpt = case
  when community_comment_id is not null then coalesce((
    select left(btrim(community_comments.body), 2000)
    from public.community_comments
    where community_comments.id = user_reports.community_comment_id
  ), '')
  when community_post_id is not null then coalesce((
    select left(btrim(community_posts.body), 2000)
    from public.community_posts
    where community_posts.id = user_reports.community_post_id
  ), '')
  else ''
end
where content_excerpt = '';

create or replace function public.get_my_moderation_role()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select moderation_roles.role into caller_role
  from public.moderation_roles
  where moderation_roles.user_id = caller_id;

  return caller_role;
end;
$$;

revoke all on function public.get_my_moderation_role() from public, anon, authenticated;
grant execute on function public.get_my_moderation_role() to authenticated, service_role;

create or replace function public.get_moderation_reports(
  status_filter text default 'open',
  page_size integer default 50
)
returns table (
  report_id uuid,
  reported_user_id uuid,
  reported_name text,
  reported_username text,
  reasons text[],
  details text,
  source text,
  report_status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  review_notes text,
  community_post_id uuid,
  community_comment_id uuid,
  content_excerpt text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  safe_page_size integer := least(greatest(coalesce(page_size, 50), 1), 100);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not exists (select 1 from public.moderation_roles where user_id = caller_id) then
    raise exception using errcode = '42501', message = 'Moderation access required';
  end if;
  if status_filter not in ('open', 'reviewing', 'resolved', 'dismissed', 'all') then
    raise exception using errcode = '22023', message = 'Invalid report status';
  end if;

  return query
  select user_reports.id,
    user_reports.reported_user_id,
    coalesce(profiles.full_name, 'Unavailable account'),
    coalesce(profiles.username, ''),
    user_reports.reasons,
    user_reports.details,
    user_reports.source,
    user_reports.status,
    user_reports.created_at,
    user_reports.reviewed_at,
    user_reports.review_notes,
    user_reports.community_post_id,
    user_reports.community_comment_id,
    user_reports.content_excerpt
  from public.user_reports
  left join public.profiles on profiles.id = user_reports.reported_user_id
  where status_filter = 'all' or user_reports.status = status_filter
  order by user_reports.created_at desc, user_reports.id
  limit safe_page_size;
end;
$$;

revoke all on function public.get_moderation_reports(text, integer) from public, anon, authenticated;
grant execute on function public.get_moderation_reports(text, integer) to authenticated, service_role;

create or replace function public.review_moderation_report(
  target_report_id uuid,
  next_status text,
  moderator_notes text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_notes text := btrim(coalesce(moderator_notes, ''));
  old_status text;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not exists (select 1 from public.moderation_roles where user_id = caller_id) then
    raise exception using errcode = '42501', message = 'Moderation access required';
  end if;
  if next_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception using errcode = '22023', message = 'Invalid report status';
  end if;
  if char_length(clean_notes) > 2000 then
    raise exception using errcode = '22023', message = 'Review notes are too long';
  end if;

  select user_reports.status into old_status
  from public.user_reports
  where user_reports.id = target_report_id
  for update;

  if old_status is null then
    raise exception using errcode = '22023', message = 'Report is unavailable';
  end if;
  if old_status = next_status then
    raise exception using errcode = '22023', message = 'Report already has this status';
  end if;

  update public.user_reports
  set status = next_status,
      review_notes = clean_notes,
      reviewed_by = caller_id,
      reviewed_at = case when next_status in ('resolved', 'dismissed') then now() else null end,
      updated_at = now()
  where id = target_report_id;

  insert into public.moderation_audit_log (
    report_id, moderator_id, previous_status, new_status, notes
  ) values (
    target_report_id, caller_id, old_status, next_status, clean_notes
  );

  return true;
end;
$$;

revoke all on function public.review_moderation_report(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_moderation_report(uuid, text, text) to authenticated, service_role;

