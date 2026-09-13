begin;
select plan(22);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ),
  'notifications are published for realtime delivery'
);

insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('51000000-0000-4000-8000-000000000001', 'notify-one@example.com', '', '{}', '{"full_name":"Notify One"}', 'authenticated', 'authenticated'),
  ('52000000-0000-4000-8000-000000000002', 'notify-two@example.com', '', '{}', '{"full_name":"Notify Two"}', 'authenticated', 'authenticated'),
  ('53000000-0000-4000-8000-000000000003', 'notify-three@example.com', '', '{}', '{"full_name":"Notify Three"}', 'authenticated', 'authenticated');

update public.profiles set onboarding_completed = true, academic_stage = 'PhD student'
where id in (
  '51000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000002',
  '53000000-0000-4000-8000-000000000003'
);

select set_config('request.jwt.claims', '{"sub":"52000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(public.request_connection('51000000-0000-4000-8000-000000000001'), 'pending', 'connection request succeeds');

select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.get_notifications()), 1, 'recipient sees one notification');
select is((select kind from public.get_notifications()), 'connection_request', 'connection notification has the correct kind');
select is((select actor_name from public.get_notifications()), 'Notify Two', 'actor metadata is resolved server-side');
select is(public.get_unread_notification_count(), 1, 'unread count is available');
select isnt((select notification_id from public.get_notifications()), null, 'notification has an identifier');
select ok(public.mark_notification_read((select notification_id from public.get_notifications())), 'owner can mark notification read');
select is(public.get_unread_notification_count(), 0, 'read notification leaves unread count');
select is(public.mark_notification_read('00000000-0000-4000-8000-000000000099'), false, 'unknown notification cannot be marked');
select is(public.mark_all_notifications_read(), 0, 'mark all is idempotent');
select throws_ok(
  $$insert into public.notifications (user_id, actor_id, kind, event_key)
    values ('51000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000002', 'message', 'forged')$$,
  '42501', null, 'client cannot forge notifications'
);

select is(public.request_connection('52000000-0000-4000-8000-000000000002'), 'matched', 'connecting back creates a match');
select isnt(public.send_message('52000000-0000-4000-8000-000000000002', 'Hello from the notification test'), null, 'matched user can send message');

select set_config('request.jwt.claims', '{"sub":"52000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::integer from public.get_notifications()), 2, 'match and message notifications are delivered');

select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.create_community_post('research', 'A sufficiently detailed community notification test post') as post_id \gset

select set_config('request.jwt.claims', '{"sub":"52000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select isnt(public.create_community_comment(:'post_id', 'A useful comment'), null, 'community comment succeeds');

select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.get_notifications() where kind = 'community_comment'), 1, 'post author receives comment notification');
select ok(public.update_notification_preferences(true, true, false, false), 'community notifications can be disabled');

select set_config('request.jwt.claims', '{"sub":"53000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select isnt(public.create_community_comment(:'post_id', 'Another useful comment'), null, 'second community comment succeeds');

select set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.get_notifications() where kind = 'community_comment'), 1, 'disabled preference prevents new community notification');
select ok(public.block_user('52000000-0000-4000-8000-000000000002'), 'blocking succeeds');
select is((select count(*)::integer from public.notifications where actor_id = '52000000-0000-4000-8000-000000000002'), 0, 'blocking removes prior notifications from that actor');

select * from finish();
rollback;
