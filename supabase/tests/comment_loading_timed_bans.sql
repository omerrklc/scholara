begin;

select plan(20);

select has_column('public', 'moderation_account_bans', 'ban_duration', 'ban duration is stored');
select has_column('public', 'moderation_account_bans', 'expires_at', 'ban expiry is stored');
select has_column('public', 'moderation_actions', 'action_detail', 'audit records include action detail');
select function_returns('public', 'moderate_reported_account', array['uuid', 'text', 'text', 'text'], 'boolean', 'timed account enforcement returns a result');
select function_returns('public', 'process_expired_moderation_bans', array[]::text[], 'integer', 'expired ban processing returns a count');
select ok(not has_function_privilege('authenticated', 'public.process_expired_moderation_bans()', 'execute'), 'users cannot run automatic ban expiry directly');
select ok(exists (select 1 from cron.job where jobname = 'expire-moderation-bans'), 'automatic ban expiry is scheduled');

insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('a1000000-0000-4000-8000-000000000001', 'timed-admin@example.com', '', '{}', '{"full_name":"Timed Admin"}', 'authenticated', 'authenticated'),
  ('a2000000-0000-4000-8000-000000000002', 'comment-viewer@example.com', '', '{}', '{"full_name":"Comment Viewer"}', 'authenticated', 'authenticated'),
  ('a3000000-0000-4000-8000-000000000003', 'timed-target@example.com', '', '{}', '{"full_name":"Timed Target"}', 'authenticated', 'authenticated');

update public.profiles set username = 'timed_admin', onboarding_completed = true where id = 'a1000000-0000-4000-8000-000000000001';
update public.profiles set username = 'comment_viewer', onboarding_completed = true where id = 'a2000000-0000-4000-8000-000000000002';
update public.profiles set username = 'timed_target', onboarding_completed = true where id = 'a3000000-0000-4000-8000-000000000003';

insert into public.moderation_roles (user_id, role)
values ('a1000000-0000-4000-8000-000000000001', 'admin');

insert into public.community_posts (id, author_id, category, body)
values ('a4000000-0000-4000-8000-000000000004', 'a3000000-0000-4000-8000-000000000003', 'research', 'A post used to verify reply loading.');

insert into public.community_comments (id, post_id, author_id, body)
values ('a5000000-0000-4000-8000-000000000005', 'a4000000-0000-4000-8000-000000000004', 'a3000000-0000-4000-8000-000000000003', 'A visible reply');

insert into public.user_reports (
  id, reporter_id, reported_user_id, reason, reasons, details, source
) values (
  'a6000000-0000-4000-8000-000000000006', 'a2000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000003', 'harassment', array['harassment'],
  'Evidence for a timed restriction', 'profile'
);

select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select * from public.get_community_comments('a4000000-0000-4000-8000-000000000004', null, 50) $$,
  'comments load without an ambiguous author_id error'
);
select is(
  (select count(*) from public.get_community_comments('a4000000-0000-4000-8000-000000000004', null, 50)),
  1::bigint,
  'the existing reply is returned'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select ok(
  public.moderate_reported_account(
    'a6000000-0000-4000-8000-000000000006', 'ban', 'Confirmed violation for timed ban', '1_day'
  ),
  'an administrator can issue a timed ban'
);
select throws_ok(
  $$ select public.moderate_reported_account('a6000000-0000-4000-8000-000000000006', 'ban', 'Invalid duration attempt', 'forever-ish') $$,
  '22023', 'Invalid ban duration', 'unknown durations are rejected by the server'
);
reset role;

select is((select ban_duration from public.moderation_account_bans where user_id = 'a3000000-0000-4000-8000-000000000003'), '1_day', 'selected duration is stored');
select ok((select expires_at between now() + interval '23 hours 59 minutes' and now() + interval '24 hours 1 minute' from public.moderation_account_bans where user_id = 'a3000000-0000-4000-8000-000000000003'), 'one-day expiry is calculated server-side');
select ok((select banned_until <> 'infinity'::timestamptz and banned_until > now() from auth.users where id = 'a3000000-0000-4000-8000-000000000003'), 'authentication uses a finite ban deadline');
select is((select action_detail from public.moderation_actions where action = 'account_banned' and target_user_id = 'a3000000-0000-4000-8000-000000000003'), '1_day', 'audit history records the chosen duration');

update public.moderation_account_bans
set expires_at = now() - interval '1 minute'
where user_id = 'a3000000-0000-4000-8000-000000000003';

select is(public.process_expired_moderation_bans(), 1, 'expired ban is processed once');
select ok((select lifted_at is not null and lift_reason = 'Expired automatically' from public.moderation_account_bans where user_id = 'a3000000-0000-4000-8000-000000000003'), 'expired ban is retained as lifted history');
select is((select banned_until from auth.users where id = 'a3000000-0000-4000-8000-000000000003'), null::timestamptz, 'authentication restriction is cleared after expiry');
select is((select onboarding_completed from public.profiles where id = 'a3000000-0000-4000-8000-000000000003'), true, 'profile visibility is restored after expiry');
select is((select action_detail from public.moderation_actions where action = 'account_unbanned' and target_user_id = 'a3000000-0000-4000-8000-000000000003'), '1_day', 'automatic expiry is audited with its duration');

select * from finish();
rollback;
