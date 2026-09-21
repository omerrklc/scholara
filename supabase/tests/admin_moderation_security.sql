begin;

select plan(22);

select has_table('public', 'moderation_roles', 'moderation roles table exists');
select has_table('public', 'moderation_audit_log', 'moderation audit table exists');
select policies_are('public', 'moderation_roles', array[]::text[], 'role assignments are never directly exposed');
select policies_are('public', 'moderation_audit_log', array[]::text[], 'audit history is never directly exposed');
select ok(not has_table_privilege('authenticated', 'public.moderation_roles', 'select'), 'users cannot enumerate moderation roles');
select ok(not has_table_privilege('authenticated', 'public.moderation_roles', 'insert'), 'users cannot grant themselves moderation access');
select ok(not has_table_privilege('authenticated', 'public.moderation_audit_log', 'select'), 'users cannot read private audit history');
select has_column('public', 'user_reports', 'reviewed_by', 'reports retain the reviewing moderator');
select has_column('public', 'user_reports', 'content_excerpt', 'reports retain a bounded content snapshot');
select function_returns('public', 'get_my_moderation_role', array[]::text[], 'text', 'role lookup returns the caller role');
select function_returns('public', 'review_moderation_report', array['uuid', 'text', 'text'], 'boolean', 'report review returns a result');

insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('81000000-0000-4000-8000-000000000001', 'moderator@example.com', '', '{}', '{"full_name":"Test Moderator"}', 'authenticated', 'authenticated'),
  ('82000000-0000-4000-8000-000000000002', 'member@example.com', '', '{}', '{"full_name":"Test Member"}', 'authenticated', 'authenticated'),
  ('83000000-0000-4000-8000-000000000003', 'reported@example.com', '', '{}', '{"full_name":"Reported Member"}', 'authenticated', 'authenticated');

update public.profiles set username = 'test_moderator' where id = '81000000-0000-4000-8000-000000000001';
update public.profiles set username = 'test_member' where id = '82000000-0000-4000-8000-000000000002';
update public.profiles set username = 'reported_member' where id = '83000000-0000-4000-8000-000000000003';

insert into public.moderation_roles (user_id, role)
values ('81000000-0000-4000-8000-000000000001', 'admin');

insert into public.user_reports (id, reporter_id, reported_user_id, reason, reasons, details, source)
values (
  '84000000-0000-4000-8000-000000000004',
  '82000000-0000-4000-8000-000000000002',
  '83000000-0000-4000-8000-000000000003',
  'spam', array['spam'], 'Test details', 'profile'
);

select set_config('request.jwt.claims', '{"sub":"82000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(public.get_my_moderation_role(), null::text, 'ordinary users have no moderation role');
select throws_ok(
  $$ select * from public.get_moderation_reports('open', 50) $$,
  '42501', 'Moderation access required', 'ordinary users cannot list reports'
);
select throws_ok(
  $$ select public.review_moderation_report('84000000-0000-4000-8000-000000000004', 'resolved', '') $$,
  '42501', 'Moderation access required', 'ordinary users cannot review reports'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.get_my_moderation_role(), 'admin', 'assigned moderator role is returned');
select is((select count(*) from public.get_moderation_reports('open', 50)), 1::bigint, 'moderators can list open reports');
select is((select reported_name from public.get_moderation_reports('open', 50)), 'Reported Member', 'moderation queue includes the reported account label');
select throws_ok(
  $$ select * from public.get_moderation_reports('invalid', 50) $$,
  '22023', 'Invalid report status', 'report filters are allowlisted'
);
select ok(public.review_moderation_report((select report_id from public.get_moderation_reports('open', 50)), 'resolved', 'Reviewed safely'), 'moderators can resolve reports');
reset role;

select is((select status from public.user_reports limit 1), 'resolved', 'review updates the private report');
select is((select count(*) from public.moderation_audit_log), 1::bigint, 'review writes one immutable audit event');
select is((select notes from public.moderation_audit_log limit 1), 'Reviewed safely', 'audit event records bounded review notes');

select * from finish();
rollback;
