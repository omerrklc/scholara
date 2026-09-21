-- Fix comment loading ambiguity and add automatically expiring moderation bans.

alter table public.moderation_account_bans
add column if not exists ban_duration text not null default 'permanent';

alter table public.moderation_account_bans
add column if not exists expires_at timestamptz;

alter table public.moderation_account_bans
drop constraint if exists moderation_account_bans_duration_check;

alter table public.moderation_account_bans
add constraint moderation_account_bans_duration_check check (
  ban_duration in ('1_day', '1_week', '1_month', '1_year', 'permanent')
  and ((ban_duration = 'permanent' and expires_at is null)
    or (ban_duration <> 'permanent' and expires_at is not null))
);

alter table public.moderation_actions
add column if not exists action_detail text not null default '';

alter table public.moderation_actions
drop constraint if exists moderation_actions_action_detail_check;

alter table public.moderation_actions
add constraint moderation_actions_action_detail_check
check (char_length(action_detail) <= 100 and action_detail = btrim(action_detail));

create or replace function public.process_expired_moderation_bans()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_ban record;
  processed_count integer := 0;
begin
  for expired_ban in
    update public.moderation_account_bans
    set lifted_at = now(),
        lifted_by = null,
        lift_reason = 'Expired automatically'
    where lifted_at is null
      and expires_at is not null
      and expires_at <= now()
    returning user_id, source_report_id, previous_onboarding_completed, ban_duration
  loop
    update auth.users set banned_until = null where id = expired_ban.user_id;
    update public.profiles
    set onboarding_completed = expired_ban.previous_onboarding_completed
    where id = expired_ban.user_id;

    insert into public.moderation_actions (
      report_id, moderator_id, target_user_id, action, notes, action_detail
    ) values (
      expired_ban.source_report_id, null, expired_ban.user_id, 'account_unbanned',
      'Expired automatically', expired_ban.ban_duration
    );
    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

revoke all on function public.process_expired_moderation_bans() from public, anon, authenticated;
grant execute on function public.process_expired_moderation_bans() to service_role;

create extension if not exists pg_cron;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'expire-moderation-bans';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
  perform cron.schedule(
    'expire-moderation-bans',
    '*/5 * * * *',
    'select public.process_expired_moderation_bans();'
  );
end;
$$;

drop function if exists public.moderate_reported_account(uuid, text, text);

create function public.moderate_reported_account(
  target_report_id uuid,
  account_action text,
  moderator_notes text,
  requested_duration text
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
  duration_key text := coalesce(requested_duration, 'permanent');
  calculated_expiry timestamptz;
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
  if account_action = 'ban' and duration_key not in ('1_day', '1_week', '1_month', '1_year', 'permanent') then
    raise exception using errcode = '22023', message = 'Invalid ban duration';
  end if;

  calculated_expiry := case duration_key
    when '1_day' then now() + interval '1 day'
    when '1_week' then now() + interval '1 week'
    when '1_month' then now() + interval '1 month'
    when '1_year' then now() + interval '1 year'
    else null
  end;

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
  perform public.process_expired_moderation_bans();

  if account_action = 'ban' then
    if exists (
      select 1 from public.moderation_account_bans
      where user_id = report_row.reported_user_id
        and lifted_at is null
        and (expires_at is null or expires_at > now())
    ) then
      raise exception using errcode = '22023', message = 'Account is already banned';
    end if;

    select profiles.onboarding_completed into prior_onboarding
    from public.profiles where profiles.id = report_row.reported_user_id;

    insert into public.moderation_account_bans (
      user_id, source_report_id, banned_by, reason, previous_onboarding_completed,
      banned_at, ban_duration, expires_at, lifted_by, lifted_at, lift_reason
    ) values (
      report_row.reported_user_id, target_report_id, caller_id, clean_notes, coalesce(prior_onboarding, false),
      now(), duration_key, calculated_expiry, null, null, ''
    )
    on conflict (user_id) do update set
      source_report_id = excluded.source_report_id,
      banned_by = excluded.banned_by,
      reason = excluded.reason,
      previous_onboarding_completed = excluded.previous_onboarding_completed,
      banned_at = now(), ban_duration = excluded.ban_duration, expires_at = excluded.expires_at,
      lifted_by = null, lifted_at = null, lift_reason = '';

    update auth.users
    set banned_until = coalesce(calculated_expiry, 'infinity'::timestamptz)
    where id = report_row.reported_user_id;
    update public.profiles set onboarding_completed = false where id = report_row.reported_user_id;

    insert into public.moderation_actions (
      report_id, moderator_id, target_user_id, action, notes, action_detail
    ) values (
      target_report_id, caller_id, report_row.reported_user_id, 'account_banned', clean_notes, duration_key
    );

    if report_row.status <> 'resolved' then
      insert into public.moderation_audit_log (report_id, moderator_id, previous_status, new_status, notes)
      values (target_report_id, caller_id, report_row.status, 'resolved', clean_notes);
    end if;
    update public.user_reports
    set status = 'resolved', review_notes = clean_notes, reviewed_by = caller_id,
        reviewed_at = now(), updated_at = now()
    where id = target_report_id;
  else
    if not exists (
      select 1 from public.moderation_account_bans
      where user_id = report_row.reported_user_id
        and lifted_at is null
        and (expires_at is null or expires_at > now())
    ) then
      raise exception using errcode = '22023', message = 'Account is not banned';
    end if;

    update public.moderation_account_bans
    set lifted_by = caller_id, lifted_at = now(), lift_reason = clean_notes
    where user_id = report_row.reported_user_id and lifted_at is null
    returning previous_onboarding_completed, ban_duration into prior_onboarding, duration_key;

    update auth.users set banned_until = null where id = report_row.reported_user_id;
    update public.profiles set onboarding_completed = coalesce(prior_onboarding, false)
    where id = report_row.reported_user_id;

    insert into public.moderation_actions (
      report_id, moderator_id, target_user_id, action, notes, action_detail
    ) values (
      target_report_id, caller_id, report_row.reported_user_id, 'account_unbanned', clean_notes, duration_key
    );
  end if;

  return true;
end;
$$;

revoke all on function public.moderate_reported_account(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.moderate_reported_account(uuid, text, text, text) to authenticated, service_role;

create function public.moderate_reported_account(
  target_report_id uuid,
  account_action text,
  moderator_notes text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.moderate_reported_account(
    target_report_id,
    account_action,
    moderator_notes,
    case when account_action = 'ban' then 'permanent' else null end
  );
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
    where user_id = auth.uid()
      and lifted_at is null
      and (expires_at is null or expires_at > now())
  ) then
    raise exception using errcode = '42501', message = 'Account is restricted';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_banned_account_write() from public, anon, authenticated;

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

  select posts.author_id into post_author_id
  from public.community_posts posts
  where posts.id = target_post_id;

  if post_author_id is null or exists (
    select 1 from public.blocked_users blocks
    where (blocks.blocker_id = caller_id and blocks.blocked_user_id = post_author_id)
       or (blocks.blocker_id = post_author_id and blocks.blocked_user_id = caller_id)
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
      where bans.user_id = comments.author_id
        and bans.lifted_at is null
        and (bans.expires_at is null or bans.expires_at > now())
    )
  order by comments.created_at desc, comments.id desc
  limit safe_page_size;
end;
$$;

revoke all on function public.get_community_comments(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.get_community_comments(uuid, timestamptz, integer) to authenticated, service_role;

