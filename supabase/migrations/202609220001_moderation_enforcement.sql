-- Scholara moderation enforcement: evidence signals, reversible account bans and content removal.

create table if not exists public.moderation_account_bans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  source_report_id uuid references public.user_reports(id) on delete set null,
  banned_by uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 2000 and reason = btrim(reason)),
  previous_onboarding_completed boolean not null default false,
  banned_at timestamptz not null default now(),
  lifted_by uuid references auth.users(id) on delete set null,
  lifted_at timestamptz,
  lift_reason text not null default '' check (char_length(lift_reason) <= 2000 and lift_reason = btrim(lift_reason)),
  constraint moderation_account_bans_lift_fields check (
    (lifted_at is null and lifted_by is null and lift_reason = '')
    or (lifted_at is not null and char_length(lift_reason) >= 5)
  )
);

create index if not exists moderation_account_bans_active_idx
on public.moderation_account_bans (user_id)
where lifted_at is null;

alter table public.moderation_account_bans enable row level security;
revoke all on table public.moderation_account_bans from public, anon, authenticated;
grant all on table public.moderation_account_bans to service_role;

create table if not exists public.moderation_actions (
  id bigint generated always as identity primary key,
  report_id uuid references public.user_reports(id) on delete set null,
  moderator_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('content_removed', 'account_banned', 'account_unbanned')),
  notes text not null check (char_length(notes) between 5 and 2000 and notes = btrim(notes)),
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_report_idx
on public.moderation_actions (report_id, created_at desc);

create index if not exists moderation_actions_target_idx
on public.moderation_actions (target_user_id, created_at desc);

alter table public.moderation_actions enable row level security;
revoke all on table public.moderation_actions from public, anon, authenticated;
grant all on table public.moderation_actions to service_role;
grant usage, select on sequence public.moderation_actions_id_seq to service_role;

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
  elsif new.reported_user_id is not null then
    select left(btrim(concat_ws(E'\n',
      'Profile: ' || profiles.full_name || ' (@' || profiles.username || ')',
      nullif('Institution: ' || profiles.university, 'Institution: '),
      nullif('Research: ' || profiles.research_description, 'Research: ')
    )), 2000)
      into new.content_excerpt
    from public.profiles
    where profiles.id = new.reported_user_id;
  end if;

  new.content_excerpt := coalesce(new.content_excerpt, '');
  return new;
end;
$$;

revoke all on function public.capture_report_content_excerpt() from public, anon, authenticated;

update public.user_reports
set content_excerpt = coalesce((
  select left(btrim(concat_ws(E'\n',
    'Profile: ' || profiles.full_name || ' (@' || profiles.username || ')',
    nullif('Institution: ' || profiles.university, 'Institution: '),
    nullif('Research: ' || profiles.research_description, 'Research: ')
  )), 2000)
  from public.profiles
  where profiles.id = user_reports.reported_user_id
), '')
where content_excerpt = ''
  and community_post_id is null
  and community_comment_id is null;

drop function if exists public.get_moderation_reports(text, integer);
create function public.get_moderation_reports(
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
  content_excerpt text,
  reported_content_exists boolean,
  account_banned boolean,
  target_report_count_30d bigint,
  target_distinct_reporters_30d bigint,
  target_resolved_count_30d bigint,
  reporter_report_count_30d bigint,
  reporter_dismissed_count_30d bigint
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
  select reports.id,
    reports.reported_user_id,
    coalesce(profiles.full_name, 'Unavailable account'),
    coalesce(profiles.username, ''),
    reports.reasons,
    reports.details,
    reports.source,
    reports.status,
    reports.created_at,
    reports.reviewed_at,
    reports.review_notes,
    reports.community_post_id,
    reports.community_comment_id,
    reports.content_excerpt,
    case
      when reports.community_comment_id is not null then exists (
        select 1 from public.community_comments where id = reports.community_comment_id
      )
      when reports.community_post_id is not null then exists (
        select 1 from public.community_posts where id = reports.community_post_id
      )
      else false
    end,
    exists (
      select 1 from public.moderation_account_bans bans
      where bans.user_id = reports.reported_user_id and bans.lifted_at is null
    ),
    (select count(*) from public.user_reports target_reports
      where target_reports.reported_user_id = reports.reported_user_id
        and target_reports.created_at > now() - interval '30 days'),
    (select count(distinct target_reports.reporter_id) from public.user_reports target_reports
      where target_reports.reported_user_id = reports.reported_user_id
        and target_reports.created_at > now() - interval '30 days'),
    (select count(*) from public.user_reports target_reports
      where target_reports.reported_user_id = reports.reported_user_id
        and target_reports.status = 'resolved'
        and target_reports.created_at > now() - interval '30 days'),
    (select count(*) from public.user_reports reporter_reports
      where reporter_reports.reporter_id = reports.reporter_id
        and reporter_reports.created_at > now() - interval '30 days'),
    (select count(*) from public.user_reports reporter_reports
      where reporter_reports.reporter_id = reports.reporter_id
        and reporter_reports.status = 'dismissed'
        and reporter_reports.created_at > now() - interval '30 days')
  from public.user_reports reports
  left join public.profiles on profiles.id = reports.reported_user_id
  where status_filter = 'all' or reports.status = status_filter
  order by reports.created_at desc, reports.id
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
  if char_length(clean_notes) > 2000
    or (next_status in ('resolved', 'dismissed') and char_length(clean_notes) < 5) then
    raise exception using errcode = '22023', message = 'A decision note of at least 5 characters is required';
  end if;

  select reports.status into old_status
  from public.user_reports reports
  where reports.id = target_report_id
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

create or replace function public.moderate_reported_content(
  target_report_id uuid,
  moderator_notes text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_notes text := btrim(coalesce(moderator_notes, ''));
  report_row public.user_reports%rowtype;
  removed_count integer := 0;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not exists (select 1 from public.moderation_roles where user_id = caller_id) then
    raise exception using errcode = '42501', message = 'Moderation access required';
  end if;
  if char_length(clean_notes) not between 5 and 2000 then
    raise exception using errcode = '22023', message = 'A removal note of at least 5 characters is required';
  end if;

  select * into report_row from public.user_reports where id = target_report_id for update;
  if report_row.id is null then
    raise exception using errcode = '22023', message = 'Report is unavailable';
  end if;

  if report_row.community_comment_id is not null then
    delete from public.community_comments where id = report_row.community_comment_id;
    get diagnostics removed_count = row_count;
  elsif report_row.community_post_id is not null then
    delete from public.community_posts where id = report_row.community_post_id;
    get diagnostics removed_count = row_count;
  else
    raise exception using errcode = '22023', message = 'This report has no removable content';
  end if;

  if removed_count = 0 then
    raise exception using errcode = '22023', message = 'Reported content is already unavailable';
  end if;

  insert into public.moderation_actions (report_id, moderator_id, target_user_id, action, notes)
  values (target_report_id, caller_id, report_row.reported_user_id, 'content_removed', clean_notes);

  if report_row.status <> 'resolved' then
    insert into public.moderation_audit_log (report_id, moderator_id, previous_status, new_status, notes)
    values (target_report_id, caller_id, report_row.status, 'resolved', clean_notes);
  end if;

  update public.user_reports
  set status = 'resolved', review_notes = clean_notes, reviewed_by = caller_id,
      reviewed_at = now(), updated_at = now()
  where id = target_report_id;

  return true;
end;
$$;

revoke all on function public.moderate_reported_content(uuid, text) from public, anon, authenticated;
grant execute on function public.moderate_reported_content(uuid, text) to authenticated, service_role;

create or replace function public.moderate_reported_account(
  target_report_id uuid,
  account_action text,
  moderator_notes text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_notes text := btrim(coalesce(moderator_notes, ''));
  caller_role text;
  report_row public.user_reports%rowtype;
  prior_onboarding boolean;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select roles.role into caller_role from public.moderation_roles roles where roles.user_id = caller_id;
  if caller_role is distinct from 'admin' then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  if account_action not in ('ban', 'unban') then
    raise exception using errcode = '22023', message = 'Invalid account action';
  end if;
  if char_length(clean_notes) not between 5 and 2000 then
    raise exception using errcode = '22023', message = 'An account action note of at least 5 characters is required';
  end if;

  select * into report_row from public.user_reports where id = target_report_id for update;
  if report_row.id is null or report_row.reported_user_id is null then
    raise exception using errcode = '22023', message = 'Reported account is unavailable';
  end if;
  if report_row.reported_user_id = caller_id then
    raise exception using errcode = '42501', message = 'Administrators cannot restrict their own account';
  end if;
  if exists (select 1 from public.moderation_roles where user_id = report_row.reported_user_id) then
    raise exception using errcode = '42501', message = 'Moderation accounts require an out-of-band role review';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('moderation-account:' || report_row.reported_user_id::text, 0));

  if account_action = 'ban' then
    if exists (select 1 from public.moderation_account_bans where user_id = report_row.reported_user_id and lifted_at is null) then
      raise exception using errcode = '22023', message = 'Account is already banned';
    end if;

    select profiles.onboarding_completed into prior_onboarding
    from public.profiles where profiles.id = report_row.reported_user_id;

    insert into public.moderation_account_bans (
      user_id, source_report_id, banned_by, reason, previous_onboarding_completed,
      banned_at, lifted_by, lifted_at, lift_reason
    ) values (
      report_row.reported_user_id, target_report_id, caller_id, clean_notes, coalesce(prior_onboarding, false),
      now(), null, null, ''
    )
    on conflict (user_id) do update set
      source_report_id = excluded.source_report_id,
      banned_by = excluded.banned_by,
      reason = excluded.reason,
      previous_onboarding_completed = excluded.previous_onboarding_completed,
      banned_at = now(), lifted_by = null, lifted_at = null, lift_reason = '';

    update auth.users set banned_until = 'infinity'::timestamptz where id = report_row.reported_user_id;
    update public.profiles set onboarding_completed = false where id = report_row.reported_user_id;

    insert into public.moderation_actions (report_id, moderator_id, target_user_id, action, notes)
    values (target_report_id, caller_id, report_row.reported_user_id, 'account_banned', clean_notes);

    if report_row.status <> 'resolved' then
      insert into public.moderation_audit_log (report_id, moderator_id, previous_status, new_status, notes)
      values (target_report_id, caller_id, report_row.status, 'resolved', clean_notes);
    end if;
    update public.user_reports
    set status = 'resolved', review_notes = clean_notes, reviewed_by = caller_id,
        reviewed_at = now(), updated_at = now()
    where id = target_report_id;
  else
    if not exists (select 1 from public.moderation_account_bans where user_id = report_row.reported_user_id and lifted_at is null) then
      raise exception using errcode = '22023', message = 'Account is not banned';
    end if;

    update public.moderation_account_bans
    set lifted_by = caller_id, lifted_at = now(), lift_reason = clean_notes
    where user_id = report_row.reported_user_id and lifted_at is null
    returning previous_onboarding_completed into prior_onboarding;

    update auth.users set banned_until = null where id = report_row.reported_user_id;
    update public.profiles set onboarding_completed = coalesce(prior_onboarding, false)
    where id = report_row.reported_user_id;

    insert into public.moderation_actions (report_id, moderator_id, target_user_id, action, notes)
    values (target_report_id, caller_id, report_row.reported_user_id, 'account_unbanned', clean_notes);
  end if;

  return true;
end;
$$;

revoke all on function public.moderate_reported_account(uuid, text, text) from public, anon, authenticated;
grant execute on function public.moderate_reported_account(uuid, text, text) to authenticated, service_role;

create or replace function public.reject_banned_account_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and exists (
    select 1 from public.moderation_account_bans
    where user_id = auth.uid() and lifted_at is null
  ) then
    raise exception using errcode = '42501', message = 'Account is restricted';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_banned_account_write() from public, anon, authenticated;

drop trigger if exists community_posts_reject_banned on public.community_posts;
create trigger community_posts_reject_banned before insert or update on public.community_posts
for each row execute function public.reject_banned_account_write();

drop trigger if exists community_comments_reject_banned on public.community_comments;
create trigger community_comments_reject_banned before insert or update on public.community_comments
for each row execute function public.reject_banned_account_write();

drop trigger if exists community_helpful_reject_banned on public.community_post_helpful;
create trigger community_helpful_reject_banned before insert or update on public.community_post_helpful
for each row execute function public.reject_banned_account_write();

drop trigger if exists connection_requests_reject_banned on public.connection_requests;
create trigger connection_requests_reject_banned before insert or update on public.connection_requests
for each row execute function public.reject_banned_account_write();

drop trigger if exists messages_reject_banned on public.messages;
create trigger messages_reject_banned before insert or update on public.messages
for each row execute function public.reject_banned_account_write();

drop trigger if exists saved_profiles_reject_banned on public.saved_profiles;
create trigger saved_profiles_reject_banned before insert or update on public.saved_profiles
for each row execute function public.reject_banned_account_write();

create or replace function public.get_community_comments(
  target_post_id uuid,
  before_time timestamptz default null,
  page_size integer default 50
)
returns table (
  comment_id uuid,
  author_id uuid,
  author_name text,
  author_stage text,
  author_university text,
  body text,
  created_at timestamptz,
  viewer_owns boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  post_author_id uuid;
  safe_page_size integer := least(greatest(coalesce(page_size, 50), 1), 100);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select author_id into post_author_id from public.community_posts where id = target_post_id;
  if post_author_id is null or exists (
    select 1 from public.blocked_users
    where (blocker_id = caller_id and blocked_user_id = post_author_id)
       or (blocker_id = post_author_id and blocked_user_id = caller_id)
  ) then
    raise exception using errcode = '42501', message = 'Post is unavailable';
  end if;

  return query
  select comments.id, profiles.id, profiles.full_name, profiles.academic_stage, profiles.university,
    comments.body, comments.created_at, comments.author_id = caller_id
  from public.community_comments comments
  join public.profiles profiles on profiles.id = comments.author_id
  where comments.post_id = target_post_id
    and (before_time is null or comments.created_at < before_time)
    and not exists (
      select 1 from public.blocked_users blocks
      where (blocks.blocker_id = caller_id and blocks.blocked_user_id = comments.author_id)
         or (blocks.blocker_id = comments.author_id and blocks.blocked_user_id = caller_id)
    )
    and not exists (
      select 1 from public.moderation_account_bans bans
      where bans.user_id = comments.author_id and bans.lifted_at is null
    )
  order by comments.created_at desc, comments.id desc
  limit safe_page_size;
end;
$$;

revoke all on function public.get_community_comments(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.get_community_comments(uuid, timestamptz, integer) to authenticated, service_role;
