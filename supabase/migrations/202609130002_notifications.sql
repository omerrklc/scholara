-- Private, server-generated in-app notifications.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('connection_request', 'match', 'message', 'community_comment', 'community_helpful')),
  resource_id uuid,
  event_key text not null unique check (char_length(event_key) between 1 and 200),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_not_self check (actor_id is null or actor_id <> user_id),
  constraint notifications_read_after_create check (read_at is null or read_at >= created_at)
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc, id);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant select, delete on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant all on table public.notifications to service_role;

create policy "Users can read their own notifications"
on public.notifications for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can mark their own notifications"
on public.notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own notifications"
on public.notifications for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.create_notification(
  recipient_id uuid,
  notification_actor_id uuid,
  notification_kind text,
  notification_resource_id uuid,
  notification_event_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  preference_enabled boolean;
begin
  if recipient_id is null or notification_actor_id is null or recipient_id = notification_actor_id then return; end if;
  if notification_kind not in ('connection_request', 'match', 'message', 'community_comment', 'community_helpful') then
    raise exception using errcode = '22023', message = 'Invalid notification kind';
  end if;
  if exists (
    select 1 from public.blocked_users
    where (blocker_id = recipient_id and blocked_user_id = notification_actor_id)
       or (blocker_id = notification_actor_id and blocked_user_id = recipient_id)
  ) then return; end if;

  select case
    when notification_kind in ('connection_request', 'match') then preferences.matches_enabled
    when notification_kind = 'message' then preferences.messages_enabled
    else preferences.community_enabled
  end into preference_enabled
  from public.user_notification_preferences as preferences
  where preferences.user_id = recipient_id;

  if coalesce(preference_enabled, true) then
    insert into public.notifications (user_id, actor_id, kind, resource_id, event_key)
    values (recipient_id, notification_actor_id, notification_kind, notification_resource_id, notification_event_key)
    on conflict (event_key) do nothing;

    delete from public.notifications
    where id in (
      select id from public.notifications
      where user_id = recipient_id
      order by created_at desc, id desc
      offset 500
    );
  end if;
end;
$$;

revoke all on function public.create_notification(uuid, uuid, text, uuid, text) from public, anon, authenticated;

create or replace function public.notify_connection_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.create_notification(new.recipient_id, new.requester_id, 'connection_request', new.requester_id,
      'connection:' || new.requester_id::text || ':' || new.recipient_id::text);
  elsif old.status = 'pending' and new.status = 'accepted' then
    perform public.create_notification(new.requester_id, new.recipient_id, 'match', new.recipient_id,
      'match:' || least(new.requester_id::text, new.recipient_id::text) || ':' || greatest(new.requester_id::text, new.recipient_id::text));
  end if;
  return new;
end;
$$;
revoke all on function public.notify_connection_change() from public, anon, authenticated;

create trigger connection_requests_notify
after insert or update of status on public.connection_requests
for each row execute function public.notify_connection_change();

create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.create_notification(new.recipient_id, new.sender_id, 'message', new.sender_id, 'message:' || new.id::text);
  return new;
end;
$$;
revoke all on function public.notify_new_message() from public, anon, authenticated;

create trigger messages_notify after insert on public.messages
for each row execute function public.notify_new_message();

create or replace function public.notify_new_community_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare post_author_id uuid;
begin
  select author_id into post_author_id from public.community_posts where id = new.post_id;
  perform public.create_notification(post_author_id, new.author_id, 'community_comment', new.post_id, 'comment:' || new.id::text);
  return new;
end;
$$;
revoke all on function public.notify_new_community_comment() from public, anon, authenticated;

create trigger community_comments_notify after insert on public.community_comments
for each row execute function public.notify_new_community_comment();

create or replace function public.notify_new_helpful_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare post_author_id uuid;
begin
  select author_id into post_author_id from public.community_posts where id = new.post_id;
  perform public.create_notification(post_author_id, new.user_id, 'community_helpful', new.post_id,
    'helpful:' || new.post_id::text || ':' || new.user_id::text);
  return new;
end;
$$;
revoke all on function public.notify_new_helpful_vote() from public, anon, authenticated;

create trigger community_helpful_notify after insert on public.community_post_helpful
for each row execute function public.notify_new_helpful_vote();

create or replace function public.remove_notifications_on_block()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications
  where (user_id = new.blocker_id and actor_id = new.blocked_user_id)
     or (user_id = new.blocked_user_id and actor_id = new.blocker_id);
  return new;
end;
$$;
revoke all on function public.remove_notifications_on_block() from public, anon, authenticated;

create trigger blocked_users_remove_notifications after insert on public.blocked_users
for each row execute function public.remove_notifications_on_block();

create or replace function public.get_notifications(before_time timestamptz default null, page_size integer default 30)
returns table (
  notification_id uuid, kind text, actor_id uuid, actor_name text, actor_avatar_path text,
  resource_id uuid, created_at timestamptz, read_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if page_size not between 1 and 50 then raise exception using errcode = '22023', message = 'Invalid page size'; end if;

  return query
  select notifications.id, notifications.kind, notifications.actor_id,
    coalesce(profiles.full_name, 'Scholara researcher'), coalesce(profiles.avatar_path, ''),
    notifications.resource_id, notifications.created_at, notifications.read_at
  from public.notifications
  left join public.profiles on profiles.id = notifications.actor_id
  where notifications.user_id = caller_id
    and (before_time is null or notifications.created_at < before_time)
    and not exists (
      select 1 from public.blocked_users
      where (blocker_id = caller_id and blocked_user_id = notifications.actor_id)
         or (blocker_id = notifications.actor_id and blocked_user_id = caller_id)
    )
  order by notifications.created_at desc, notifications.id desc
  limit page_size;
end;
$$;

create or replace function public.get_unread_notification_count()
returns integer language plpgsql stable security definer set search_path = '' as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  return (select count(*)::integer from public.notifications where user_id = caller_id and read_at is null);
end;
$$;

create or replace function public.mark_notification_read(target_notification_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  update public.notifications set read_at = coalesce(read_at, now())
  where id = target_notification_id and user_id = caller_id;
  return found;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := auth.uid();
declare changed integer;
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  update public.notifications set read_at = now() where user_id = caller_id and read_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.get_notifications(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.get_unread_notification_count() from public, anon, authenticated;
revoke all on function public.mark_notification_read(uuid) from public, anon, authenticated;
revoke all on function public.mark_all_notifications_read() from public, anon, authenticated;
grant execute on function public.get_notifications(timestamptz, integer) to authenticated, service_role;
grant execute on function public.get_unread_notification_count() to authenticated, service_role;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;
