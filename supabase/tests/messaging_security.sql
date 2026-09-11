begin;

select plan(7);

select has_table('public', 'messages', 'messages table exists');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.messages'::regclass
  and conname = 'messages_not_self' and contype = 'c'), 'self-messaging is rejected');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.messages'::regclass
  and conname = 'messages_body_length' and contype = 'c'), 'message length is bounded');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.messages'::regclass
  and conname = 'messages_body_trimmed' and contype = 'c'), 'message body must be trimmed');
select policies_are('public', 'messages', array['Matched participants can read messages'], 'messages expose one explicit read policy');
select function_returns('public', 'send_message', array['uuid', 'text'], 'uuid', 'send_message returns its new id');
select throws_ok(
  $$ select public.send_message('00000000-0000-4000-8000-000000000001'::uuid, 'hello') $$,
  '42501',
  'Authentication required',
  'anonymous callers cannot send messages'
);

select * from finish();
rollback;
