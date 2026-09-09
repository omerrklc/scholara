begin;

select plan(7);

select has_table('public', 'messages', 'messages table exists');
select has_check('public', 'messages', 'messages_not_self', 'self-messaging is rejected');
select has_check('public', 'messages', 'messages_body_length', 'message length is bounded');
select has_check('public', 'messages', 'messages_body_trimmed', 'message body must be trimmed');
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
