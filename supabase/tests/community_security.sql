begin;

select plan(16);

select has_table('public', 'community_posts', 'community posts table exists');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.community_posts'::regclass
  and conname = 'community_posts_body_check' and contype = 'c'), 'post content is bounded and trimmed');
select has_table('public', 'community_comments', 'community comments table exists');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.community_comments'::regclass
  and conname = 'community_comments_body_check' and contype = 'c'), 'comment content is bounded and trimmed');
select has_table('public', 'community_post_helpful', 'helpful votes table exists');
select policies_are('public', 'community_posts', array[]::text[], 'posts cannot be accessed directly by app users');
select policies_are('public', 'community_comments', array[]::text[], 'comments cannot be accessed directly by app users');
select policies_are('public', 'community_post_helpful', array[]::text[], 'votes cannot be accessed directly by app users');
select function_returns('public', 'create_community_post', array['text', 'text'], 'uuid', 'post creation returns its id');
select function_returns('public', 'delete_community_post', array['uuid'], 'boolean', 'post deletion returns a result');
select function_returns('public', 'toggle_community_post_helpful', array['uuid'], 'boolean', 'vote toggling returns its new state');
select function_returns('public', 'create_community_comment', array['uuid', 'text'], 'uuid', 'comment creation returns its id');
select function_returns('public', 'delete_community_comment', array['uuid'], 'boolean', 'comment deletion returns a result');
select function_returns('public', 'report_community_post', array['uuid', 'text[]', 'text'], 'uuid', 'post reporting returns its private id');
select function_returns('public', 'report_community_comment', array['uuid', 'text[]', 'text'], 'uuid', 'comment reporting returns its private id');
select throws_ok(
  $$ select public.create_community_post('research', 'A sufficiently long post') $$,
  '42501',
  'Authentication required',
  'anonymous callers cannot create posts'
);

select * from finish();
rollback;
