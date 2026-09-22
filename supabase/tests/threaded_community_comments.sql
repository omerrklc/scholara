begin;

select plan(14);

select has_column('public', 'community_comments', 'parent_comment_id', 'comments can reference a parent');
select col_is_fk('public', 'community_comments', 'parent_comment_id', 'comment parents use a foreign key');
select function_returns('public', 'create_community_comment', array['uuid', 'text'], 'uuid', 'legacy top-level comment creation remains available');
select function_returns('public', 'create_community_comment', array['uuid', 'text', 'uuid'], 'uuid', 'threaded comment creation returns an id');

insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('b1000000-0000-4000-8000-000000000001', 'thread-author@example.com', '', '{}', '{"full_name":"Thread Author"}', 'authenticated', 'authenticated'),
  ('b2000000-0000-4000-8000-000000000002', 'thread-replier@example.com', '', '{}', '{"full_name":"Thread Replier"}', 'authenticated', 'authenticated'),
  ('b3000000-0000-4000-8000-000000000003', 'other-author@example.com', '', '{}', '{"full_name":"Other Author"}', 'authenticated', 'authenticated');

update public.profiles set username = 'thread_author', onboarding_completed = true where id = 'b1000000-0000-4000-8000-000000000001';
update public.profiles set username = 'thread_replier', onboarding_completed = true where id = 'b2000000-0000-4000-8000-000000000002';
update public.profiles set username = 'other_author', onboarding_completed = true where id = 'b3000000-0000-4000-8000-000000000003';

insert into public.community_posts (id, author_id, category, body)
values
  ('b4000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'research', 'A post used for a threaded discussion.'),
  ('b5000000-0000-4000-8000-000000000005', 'b3000000-0000-4000-8000-000000000003', 'research', 'A separate post used for validation.');

select set_config('request.jwt.claims', '{"sub":"b2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select isnt(
  public.create_community_comment('b4000000-0000-4000-8000-000000000004', 'Top-level thought'),
  null::uuid,
  'existing clients can still create a top-level comment'
);
reset role;

select is((select parent_comment_id from public.community_comments where body = 'Top-level thought'), null::uuid, 'top-level comment has no parent');

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select isnt(
  public.create_community_comment(
    'b4000000-0000-4000-8000-000000000004',
    'A nested response',
    (select id from public.community_comments where body = 'Top-level thought')
  ),
  null::uuid,
  'a signed-in user can reply to a comment'
);
select throws_ok(
  format(
    'select public.create_community_comment(%L, %L, %L)',
    'b5000000-0000-4000-8000-000000000005',
    'Invalid cross-post reply',
    (select id from public.community_comments where body = 'Top-level thought')
  ),
  '22023', 'Parent comment is unavailable', 'a parent from another post is rejected'
);
reset role;

select is(
  (select parent_comment_id from public.community_comments where body = 'A nested response'),
  (select id from public.community_comments where body = 'Top-level thought'),
  'nested reply stores the validated parent'
);
select is(
  (select user_id from public.notifications where event_key = 'comment:' || (select id from public.community_comments where body = 'A nested response')::text),
  'b2000000-0000-4000-8000-000000000002'::uuid,
  'a nested reply notifies the parent comment author'
);

select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select * from public.get_community_comments('b4000000-0000-4000-8000-000000000004', null, 100) $$,
  'threaded comments load for an allowed viewer'
);
select is(
  (select count(*) from public.get_community_comments('b4000000-0000-4000-8000-000000000004', null, 100)),
  2::bigint,
  'the thread returns both comments'
);
select is(
  (select parent_comment_id from public.get_community_comments('b4000000-0000-4000-8000-000000000004', null, 100) where body = 'A nested response'),
  (select id from public.community_comments where body = 'Top-level thought'),
  'the comment API returns parent relationships'
);
reset role;

select ok(not has_table_privilege('authenticated', 'public.community_comments', 'update'), 'users cannot rewrite parent relationships directly');

select * from finish();
rollback;
