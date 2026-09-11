-- Scholara Phase 4: secure community posts, comments, helpful votes and post reports.

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('research', 'relocation', 'academic_life')),
  body text not null check (char_length(body) between 10 and 2000 and body = btrim(body)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_posts_feed_idx on public.community_posts (created_at desc, id);
create index community_posts_author_idx on public.community_posts (author_id, created_at desc);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000 and body = btrim(body)),
  created_at timestamptz not null default now()
);

create index community_comments_post_idx on public.community_comments (post_id, created_at, id);
create index community_comments_author_idx on public.community_comments (author_id, created_at desc);

create table public.community_post_helpful (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index community_post_helpful_user_idx on public.community_post_helpful (user_id, created_at desc);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_post_helpful enable row level security;

revoke all on table public.community_posts, public.community_comments, public.community_post_helpful from anon, authenticated;
grant all on table public.community_posts, public.community_comments, public.community_post_helpful to service_role;

create trigger community_posts_set_updated_at
before update on public.community_posts
for each row execute function public.set_updated_at();

create or replace function public.get_community_posts(
  category_filter text default null,
  before_time timestamptz default null,
  page_size integer default 20
)
returns table (
  post_id uuid,
  author_id uuid,
  author_name text,
  author_stage text,
  author_university text,
  category text,
  body text,
  created_at timestamptz,
  reply_count bigint,
  helpful_count bigint,
  viewer_helpful boolean,
  viewer_owns boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  safe_page_size integer := least(greatest(coalesce(page_size, 20), 1), 30);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if category_filter is not null and category_filter not in ('research', 'relocation', 'academic_life') then
    raise exception using errcode = '22023', message = 'Invalid category';
  end if;

  return query
  select posts.id, profiles.id, profiles.full_name, profiles.academic_stage, profiles.university,
    posts.category, posts.body, posts.created_at,
    (select count(*) from public.community_comments comments
      where comments.post_id = posts.id
        and not exists (
          select 1 from public.blocked_users blocks
          where (blocks.blocker_id = caller_id and blocks.blocked_user_id = comments.author_id)
             or (blocks.blocker_id = comments.author_id and blocks.blocked_user_id = caller_id)
        )),
    (select count(*) from public.community_post_helpful helpful where helpful.post_id = posts.id),
    exists (select 1 from public.community_post_helpful helpful where helpful.post_id = posts.id and helpful.user_id = caller_id),
    posts.author_id = caller_id
  from public.community_posts posts
  join public.profiles profiles on profiles.id = posts.author_id
  where profiles.onboarding_completed
    and (category_filter is null or posts.category = category_filter)
    and (before_time is null or posts.created_at < before_time)
    and not exists (
      select 1 from public.blocked_users blocks
      where (blocks.blocker_id = caller_id and blocks.blocked_user_id = posts.author_id)
         or (blocks.blocker_id = posts.author_id and blocks.blocked_user_id = caller_id)
    )
  order by posts.created_at desc, posts.id desc
  limit safe_page_size;
end;
$$;

revoke all on function public.get_community_posts(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.get_community_posts(text, timestamptz, integer) to authenticated, service_role;

create or replace function public.create_community_post(post_category text, post_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_body text := btrim(coalesce(post_body, ''));
  new_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if post_category not in ('research', 'relocation', 'academic_life') then
    raise exception using errcode = '22023', message = 'Invalid category';
  end if;
  if char_length(clean_body) not between 10 and 2000 then
    raise exception using errcode = '22023', message = 'Post must contain 10 to 2000 characters';
  end if;
  if not exists (select 1 from public.profiles where id = caller_id and onboarding_completed) then
    raise exception using errcode = '42501', message = 'Complete your profile before posting';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('community-post:' || caller_id::text, 0));
  if (select count(*) from public.community_posts where author_id = caller_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception using errcode = 'P0001', message = 'Post rate limit exceeded';
  end if;

  insert into public.community_posts (author_id, category, body)
  values (caller_id, post_category, clean_body)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.create_community_post(text, text) from public, anon, authenticated;
grant execute on function public.create_community_post(text, text) to authenticated, service_role;

create or replace function public.delete_community_post(target_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  removed_count integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  delete from public.community_posts where id = target_post_id and author_id = caller_id;
  get diagnostics removed_count = row_count;
  return removed_count > 0;
end;
$$;

revoke all on function public.delete_community_post(uuid) from public, anon, authenticated;
grant execute on function public.delete_community_post(uuid) to authenticated, service_role;

create or replace function public.toggle_community_post_helpful(target_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  post_author_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not exists (select 1 from public.profiles where id = caller_id and onboarding_completed) then
    raise exception using errcode = '42501', message = 'Complete your profile before voting';
  end if;
  select author_id into post_author_id from public.community_posts where id = target_post_id;
  if post_author_id is null or exists (
    select 1 from public.blocked_users
    where (blocker_id = caller_id and blocked_user_id = post_author_id)
       or (blocker_id = post_author_id and blocked_user_id = caller_id)
  ) then
    raise exception using errcode = '42501', message = 'Post is unavailable';
  end if;

  delete from public.community_post_helpful where post_id = target_post_id and user_id = caller_id;
  if found then return false; end if;
  insert into public.community_post_helpful (post_id, user_id) values (target_post_id, caller_id);
  return true;
end;
$$;

revoke all on function public.toggle_community_post_helpful(uuid) from public, anon, authenticated;
grant execute on function public.toggle_community_post_helpful(uuid) to authenticated, service_role;

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
  order by comments.created_at desc, comments.id desc
  limit safe_page_size;
end;
$$;

revoke all on function public.get_community_comments(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.get_community_comments(uuid, timestamptz, integer) to authenticated, service_role;

create or replace function public.create_community_comment(target_post_id uuid, comment_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  post_author_id uuid;
  clean_body text := btrim(coalesce(comment_body, ''));
  new_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if char_length(clean_body) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'Comment must contain 1 to 1000 characters';
  end if;
  if not exists (select 1 from public.profiles where id = caller_id and onboarding_completed) then
    raise exception using errcode = '42501', message = 'Complete your profile before commenting';
  end if;
  select author_id into post_author_id from public.community_posts where id = target_post_id;
  if post_author_id is null or exists (
    select 1 from public.blocked_users
    where (blocker_id = caller_id and blocked_user_id = post_author_id)
       or (blocker_id = post_author_id and blocked_user_id = caller_id)
  ) then
    raise exception using errcode = '42501', message = 'Post is unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('community-comment:' || caller_id::text, 0));
  if (select count(*) from public.community_comments where author_id = caller_id and created_at > now() - interval '10 minutes') >= 30 then
    raise exception using errcode = 'P0001', message = 'Comment rate limit exceeded';
  end if;

  insert into public.community_comments (post_id, author_id, body)
  values (target_post_id, caller_id, clean_body)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.create_community_comment(uuid, text) from public, anon, authenticated;
grant execute on function public.create_community_comment(uuid, text) to authenticated, service_role;

create or replace function public.delete_community_comment(target_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  removed_count integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  delete from public.community_comments where id = target_comment_id and author_id = caller_id;
  get diagnostics removed_count = row_count;
  return removed_count > 0;
end;
$$;

revoke all on function public.delete_community_comment(uuid) from public, anon, authenticated;
grant execute on function public.delete_community_comment(uuid) to authenticated, service_role;

alter table public.user_reports
add column if not exists community_post_id uuid references public.community_posts(id) on delete set null;

alter table public.user_reports
add column if not exists community_comment_id uuid references public.community_comments(id) on delete set null;

alter table public.user_reports drop constraint if exists user_reports_source_check;
alter table public.user_reports add constraint user_reports_source_check
check (source in ('discover', 'matches', 'chat', 'profile', 'community'));

create index user_reports_community_post_idx
on public.user_reports (community_post_id, created_at desc)
where community_post_id is not null;

create index user_reports_community_comment_idx
on public.user_reports (community_comment_id, created_at desc)
where community_comment_id is not null;

create or replace function public.report_community_post(
  target_post_id uuid,
  report_reasons text[],
  report_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  reported_author_id uuid;
  clean_details text := btrim(coalesce(report_details, ''));
  clean_reasons text[];
  report_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select author_id into reported_author_id from public.community_posts where id = target_post_id;
  if reported_author_id is null or reported_author_id = caller_id then
    raise exception using errcode = '22023', message = 'Invalid reported post';
  end if;

  select array_agg(reason order by first_position)
  into clean_reasons
  from (
    select reason, min(position) as first_position
    from unnest(coalesce(report_reasons, array[]::text[])) with ordinality as selected(reason, position)
    group by reason
  ) deduplicated;

  if clean_reasons is null
    or cardinality(clean_reasons) > 6
    or array_position(clean_reasons, null) is not null
    or not clean_reasons <@ array['spam', 'harassment', 'impersonation', 'inappropriate_content', 'privacy', 'other']::text[] then
    raise exception using errcode = '22023', message = 'Invalid report reasons';
  end if;
  if char_length(clean_details) > 1000 then
    raise exception using errcode = '22023', message = 'Report details are too long';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
  if (select count(*) from public.user_reports where reporter_id = caller_id and created_at > now() - interval '1 day') >= 10 then
    raise exception using errcode = 'P0001', message = 'Daily report limit exceeded';
  end if;

  insert into public.user_reports (reporter_id, reported_user_id, reason, reasons, details, source, community_post_id)
  values (caller_id, reported_author_id, clean_reasons[1], clean_reasons, clean_details, 'community', target_post_id)
  returning id into report_id;
  return report_id;
end;
$$;

revoke all on function public.report_community_post(uuid, text[], text) from public, anon, authenticated;
grant execute on function public.report_community_post(uuid, text[], text) to authenticated, service_role;

create or replace function public.report_community_comment(
  target_comment_id uuid,
  report_reasons text[],
  report_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  reported_author_id uuid;
  parent_post_id uuid;
  clean_details text := btrim(coalesce(report_details, ''));
  clean_reasons text[];
  report_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select author_id, post_id into reported_author_id, parent_post_id
  from public.community_comments where id = target_comment_id;
  if reported_author_id is null or reported_author_id = caller_id then
    raise exception using errcode = '22023', message = 'Invalid reported comment';
  end if;

  select array_agg(reason order by first_position)
  into clean_reasons
  from (
    select reason, min(position) as first_position
    from unnest(coalesce(report_reasons, array[]::text[])) with ordinality as selected(reason, position)
    group by reason
  ) deduplicated;

  if clean_reasons is null
    or cardinality(clean_reasons) > 6
    or array_position(clean_reasons, null) is not null
    or not clean_reasons <@ array['spam', 'harassment', 'impersonation', 'inappropriate_content', 'privacy', 'other']::text[] then
    raise exception using errcode = '22023', message = 'Invalid report reasons';
  end if;
  if char_length(clean_details) > 1000 then
    raise exception using errcode = '22023', message = 'Report details are too long';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
  if (select count(*) from public.user_reports where reporter_id = caller_id and created_at > now() - interval '1 day') >= 10 then
    raise exception using errcode = 'P0001', message = 'Daily report limit exceeded';
  end if;

  insert into public.user_reports (
    reporter_id, reported_user_id, reason, reasons, details, source, community_post_id, community_comment_id
  ) values (
    caller_id, reported_author_id, clean_reasons[1], clean_reasons, clean_details, 'community', parent_post_id, target_comment_id
  ) returning id into report_id;
  return report_id;
end;
$$;

revoke all on function public.report_community_comment(uuid, text[], text) from public, anon, authenticated;
grant execute on function public.report_community_comment(uuid, text[], text) to authenticated, service_role;
