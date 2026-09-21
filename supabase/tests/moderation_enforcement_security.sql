begin;

select plan(26);

select has_table('public', 'moderation_account_bans', 'account bans table exists');
select has_table('public', 'moderation_actions', 'moderation actions table exists');
select policies_are('public', 'moderation_account_bans', array[]::text[], 'account bans are never directly exposed');
select policies_are('public', 'moderation_actions', array[]::text[], 'enforcement history is never directly exposed');
select ok(not has_table_privilege('authenticated', 'public.moderation_account_bans', 'select'), 'users cannot inspect private account bans');
select ok(not has_table_privilege('authenticated', 'public.moderation_account_bans', 'insert'), 'users cannot ban accounts directly');
select function_returns('public', 'moderate_reported_content', array['uuid', 'text'], 'boolean', 'content enforcement returns a result');
select function_returns('public', 'moderate_reported_account', array['uuid', 'text', 'text'], 'boolean', 'account enforcement returns a result');

insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('91000000-0000-4000-8000-000000000001', 'enforcement-admin@example.com', '', '{}', '{"full_name":"Enforcement Admin"}', 'authenticated', 'authenticated'),
  ('92000000-0000-4000-8000-000000000002', 'enforcement-moderator@example.com', '', '{}', '{"full_name":"Enforcement Moderator"}', 'authenticated', 'authenticated'),
  ('93000000-0000-4000-8000-000000000003', 'enforcement-reporter@example.com', '', '{}', '{"full_name":"Enforcement Reporter"}', 'authenticated', 'authenticated'),
  ('94000000-0000-4000-8000-000000000004', 'enforcement-target@example.com', '', '{}', '{"full_name":"Enforcement Target"}', 'authenticated', 'authenticated');

update public.profiles set username = 'enforcement_admin', onboarding_completed = true where id = '91000000-0000-4000-8000-000000000001';
update public.profiles set username = 'enforcement_moderator', onboarding_completed = true where id = '92000000-0000-4000-8000-000000000002';
update public.profiles set username = 'enforcement_reporter', onboarding_completed = true where id = '93000000-0000-4000-8000-000000000003';
update public.profiles set username = 'enforcement_target', onboarding_completed = true where id = '94000000-0000-4000-8000-000000000004';

insert into public.moderation_roles (user_id, role) values
  ('91000000-0000-4000-8000-000000000001', 'admin'),
  ('92000000-0000-4000-8000-000000000002', 'moderator');

insert into public.community_posts (id, author_id, category, body)
values ('95000000-0000-4000-8000-000000000005', '94000000-0000-4000-8000-000000000004', 'research', 'A reported test post with enough content.');

insert into public.community_comments (id, post_id, author_id, body)
values ('96000000-0000-4000-8000-000000000006', '95000000-0000-4000-8000-000000000005', '94000000-0000-4000-8000-000000000004', 'Reported reply');

insert into public.user_reports (
  id, reporter_id, reported_user_id, reason, reasons, details, source, community_post_id, community_comment_id
) values (
  '97000000-0000-4000-8000-000000000007', '93000000-0000-4000-8000-000000000003',
  '94000000-0000-4000-8000-000000000004', 'harassment', array['harassment'], 'Evidence details',
  'community', '95000000-0000-4000-8000-000000000005', '96000000-0000-4000-8000-000000000006'
), (
  '98000000-0000-4000-8000-000000000008', '93000000-0000-4000-8000-000000000003',
  '94000000-0000-4000-8000-000000000004', 'impersonation', array['impersonation'], 'Account evidence',
  'profile', null, null
);

select is((select content_excerpt from public.user_reports where id = '97000000-0000-4000-8000-000000000007'), 'Reported reply', 'report captures content before enforcement');

select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.moderate_reported_content('97000000-0000-4000-8000-000000000007', 'Unauthorized removal') $$,
  '42501', 'Moderation access required', 'ordinary users cannot remove reported content'
);
select throws_ok(
  $$ select public.moderate_reported_account('98000000-0000-4000-8000-000000000008', 'ban', 'Unauthorized ban') $$,
  '42501', 'Administrator access required', 'ordinary users cannot ban accounts'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select ok(public.moderate_reported_content('97000000-0000-4000-8000-000000000007', 'Confirmed policy violation'), 'moderators can remove reported content');
select throws_ok(
  $$ select public.moderate_reported_account('98000000-0000-4000-8000-000000000008', 'ban', 'Confirmed account abuse') $$,
  '42501', 'Administrator access required', 'moderators cannot ban accounts'
);
reset role;

select is((select count(*) from public.community_comments where id = '96000000-0000-4000-8000-000000000006'), 0::bigint, 'content removal deletes the reported reply');
select is((select status from public.user_reports where id = '97000000-0000-4000-8000-000000000007'), 'resolved', 'content removal resolves its report');
select is((select count(*) from public.moderation_actions where action = 'content_removed'), 1::bigint, 'content removal is audited');

select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select ok(public.moderate_reported_account('98000000-0000-4000-8000-000000000008', 'ban', 'Confirmed repeated account abuse'), 'administrators can ban a reported account');
reset role;

select ok(exists (select 1 from public.moderation_account_bans where user_id = '94000000-0000-4000-8000-000000000004' and lifted_at is null), 'active ban is stored privately');
select is((select onboarding_completed from public.profiles where id = '94000000-0000-4000-8000-000000000004'), false, 'banned account is removed from discovery surfaces');
select is((select banned_until::text from auth.users where id = '94000000-0000-4000-8000-000000000004'), 'infinity', 'authentication is disabled for the banned account');
select is((select count(*) from public.moderation_actions where action = 'account_banned'), 1::bigint, 'account ban is audited');

select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select ok(public.moderate_reported_account('98000000-0000-4000-8000-000000000008', 'unban', 'Appeal accepted after review'), 'administrators can reverse a ban');
reset role;

select ok(exists (select 1 from public.moderation_account_bans where user_id = '94000000-0000-4000-8000-000000000004' and lifted_at is not null), 'lifted ban retains its history');
select is((select banned_until from auth.users where id = '94000000-0000-4000-8000-000000000004'), null::timestamptz, 'authentication ban is cleared');
select is((select onboarding_completed from public.profiles where id = '94000000-0000-4000-8000-000000000004'), true, 'previous profile visibility is restored');
select is((select count(*) from public.moderation_actions where action = 'account_unbanned'), 1::bigint, 'ban reversal is audited');

select * from finish();
rollback;
