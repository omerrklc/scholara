begin;
select plan(22);

select has_table('public', 'legal_documents', 'versioned legal documents exist');
select has_table('public', 'legal_acceptances', 'private legal acceptances exist');
select has_table('public', 'user_notification_preferences', 'private notification preferences exist');
select has_table('public', 'data_export_requests', 'private export requests exist');
select policies_are('public', 'legal_acceptances', array[]::text[], 'legal acceptances have no direct app policies');
select policies_are('public', 'user_notification_preferences', array[]::text[], 'notification preferences have no direct app policies');
select policies_are('public', 'data_export_requests', array[]::text[], 'export requests have no direct app policies');
select ok(not has_table_privilege('authenticated', 'public.legal_acceptances', 'select'), 'app role cannot directly read acceptances');
select ok(not has_table_privilege('authenticated', 'public.data_export_requests', 'select'), 'app role cannot directly read export jobs');
select function_returns('public', 'get_account_settings', array[]::text[], 'jsonb', 'settings RPC returns private settings');
select function_returns('public', 'request_data_export', array[]::text[], 'uuid', 'export RPC returns request id');
select function_returns('public', 'delete_my_account', array['text'], 'boolean', 'deletion RPC returns a result');

insert into auth.users (id) values ('30000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select is((public.get_account_settings() -> 'notifications' ->> 'matches')::boolean, true, 'notifications default to enabled');
select ok(public.update_notification_preferences(false, true, false, true), 'owner updates notification preferences');
select is((public.get_account_settings() -> 'notifications' ->> 'matches')::boolean, false, 'updated preferences are returned');
select is(public.accept_current_legal_documents(), 3, 'all current required documents are accepted once');
select is(public.accept_current_legal_documents(), 0, 'legal acceptance is idempotent');
select is(public.request_data_export(), public.request_data_export(), 'export request is idempotent for 24 hours');
select throws_ok($$ select public.delete_my_account('delete') $$, '22023', 'Invalid confirmation', 'deletion requires exact confirmation');
reset role;

insert into auth.users (id) values ('40000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000001","iat":0}', true);
select throws_ok($$ select public.delete_my_account('DELETE') $$, '42501', 'Recent authentication required', 'stale session cannot delete an account');
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '40000000-0000-4000-8000-000000000001', 'iat', extract(epoch from now())::bigint
)::text, true);
select ok(public.delete_my_account('DELETE'), 'fresh authenticated session deletes its own account');
reset role;
select is((select count(*) from auth.users where id = '40000000-0000-4000-8000-000000000001'), 0::bigint, 'deleted auth identity is gone');

select * from finish();
rollback;
