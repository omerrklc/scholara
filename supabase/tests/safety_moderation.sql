begin;

select plan(11);

select has_table('public', 'blocked_users', 'blocked users table exists');
select has_check('public', 'blocked_users', 'blocked_users_not_self', 'users cannot block themselves');
select policies_are('public', 'blocked_users', array['Users can view their own blocks'], 'blocks have one owner-only read policy');
select has_table('public', 'user_reports', 'private reports table exists');
select policies_are('public', 'user_reports', array[]::text[], 'reports cannot be read directly by app users');
select function_returns('public', 'block_user', array['uuid'], 'boolean', 'block function returns a result');
select function_returns('public', 'unblock_user', array['uuid'], 'boolean', 'unblock function returns a result');
select function_returns('public', 'report_user', array['uuid', 'text', 'text', 'text'], 'uuid', 'report function returns its private id');
select function_returns('public', 'report_user', array['uuid', 'text[]', 'text', 'text'], 'uuid', 'multi-reason report function returns its private id');
select has_check('public', 'user_reports', 'user_reports_reasons_valid', 'report reasons are bounded and allowlisted');
select throws_ok(
  $$ select public.block_user('00000000-0000-4000-8000-000000000001'::uuid) $$,
  '42501',
  'Authentication required',
  'anonymous callers cannot block users'
);

select * from finish();
rollback;
