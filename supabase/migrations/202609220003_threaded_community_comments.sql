-- Threaded community discussions with server-validated parent comments.

alter table public.community_comments
add column if not exists parent_comment_id uuid references public.community_comments(id) on delete set null;

alter table public.community_comments
drop constraint if exists community_comments_parent_not_self;

alter table public.community_comments
add constraint community_comments_parent_not_self
check (parent_comment_id is null or parent_comment_id <> id);

create index if not exists community_comments_thread_idx
on public.community_comments (post_id, parent_comment_id, created_at, id);

drop function if exists public.get_community_comments(uuid, timestamptz, integer);
create function public.get_community_comments(
  target_post_id uuid,
  before_time timestamptz default null,
  page_size integer default 50
)
returns table (
  comment_id uuid,
  parent_comment_id uuid,
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
  select comments.id, comments.parent_comment_id, profiles.id, profiles.full_name,
    profiles.academic_stage, profiles.university, comments.body, comments.created_at,
    comments.author_id = caller_id
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

drop function if exists public.create_community_comment(uuid, text, uuid);
create function public.create_community_comment(
  target_post_id uuid,
  comment_body text,
  target_parent_comment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  post_author_id uuid;
  parent_author_id uuid;
  parent_post_id uuid;
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

  if target_parent_comment_id is not null then
    select comments.post_id, comments.author_id into parent_post_id, parent_author_id
    from public.community_comments comments
    where comments.id = target_parent_comment_id;

    if parent_post_id is null or parent_post_id <> target_post_id then
      raise exception using errcode = '22023', message = 'Parent comment is unavailable';
    end if;
    if exists (
      select 1 from public.blocked_users blocks
      where (blocks.blocker_id = caller_id and blocks.blocked_user_id = parent_author_id)
         or (blocks.blocker_id = parent_author_id and blocks.blocked_user_id = caller_id)
    ) or exists (
      select 1 from public.moderation_account_bans bans
      where bans.user_id = parent_author_id
        and bans.lifted_at is null
        and (bans.expires_at is null or bans.expires_at > now())
    ) then
      raise exception using errcode = '42501', message = 'Parent comment is unavailable';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('community-comment:' || caller_id::text, 0));
  if (select count(*) from public.community_comments where author_id = caller_id and created_at > now() - interval '10 minutes') >= 30 then
    raise exception using errcode = 'P0001', message = 'Comment rate limit exceeded';
  end if;

  insert into public.community_comments (post_id, parent_comment_id, author_id, body)
  values (target_post_id, target_parent_comment_id, caller_id, clean_body)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.create_community_comment(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.create_community_comment(uuid, text, uuid) to authenticated, service_role;

drop function if exists public.create_community_comment(uuid, text);
create function public.create_community_comment(target_post_id uuid, comment_body text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.create_community_comment(target_post_id, comment_body, null);
$$;

revoke all on function public.create_community_comment(uuid, text) from public, anon, authenticated;
grant execute on function public.create_community_comment(uuid, text) to authenticated, service_role;

create or replace function public.notify_new_community_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
  if new.parent_comment_id is not null then
    select comments.author_id into recipient_id
    from public.community_comments comments
    where comments.id = new.parent_comment_id;
  else
    select posts.author_id into recipient_id
    from public.community_posts posts
    where posts.id = new.post_id;
  end if;

  perform public.create_notification(
    recipient_id,
    new.author_id,
    'community_comment',
    new.post_id,
    'comment:' || new.id::text
  );
  return new;
end;
$$;

revoke all on function public.notify_new_community_comment() from public, anon, authenticated;
