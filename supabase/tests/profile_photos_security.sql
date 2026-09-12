begin;
select plan(11);

insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('10000000-0000-0000-0000-000000000001', 'photo-owner@example.com', '', '{}', '{"full_name":"Photo Owner"}', 'authenticated', 'authenticated'),
  ('20000000-0000-0000-0000-000000000002', 'photo-viewer@example.com', '', '{}', '{"full_name":"Photo Viewer"}', 'authenticated', 'authenticated'),
  ('30000000-0000-0000-0000-000000000003', 'photo-private@example.com', '', '{}', '{"full_name":"Private User"}', 'authenticated', 'authenticated');

update public.profiles set onboarding_completed = true where id in (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('profile-photos', '10000000-0000-0000-0000-000000000001/avatar.jpg',
      '10000000-0000-0000-0000-000000000001', '{"mimetype":"image/jpeg","size":1024}')$$,
  'owner can upload the exact avatar path'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('profile-photos', '20000000-0000-0000-0000-000000000002/avatar.jpg',
      '10000000-0000-0000-0000-000000000001', '{"mimetype":"image/jpeg","size":1024}')$$,
  '42501', null, 'owner cannot upload into another user folder'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('profile-photos', '10000000-0000-0000-0000-000000000001/avatar.png',
      '10000000-0000-0000-0000-000000000001', '{"mimetype":"image/png","size":1024}')$$,
  '42501', null, 'unexpected avatar filenames are rejected'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*)::integer from storage.objects where bucket_id = 'profile-photos'),
  1, 'authenticated user can read a discoverable profile photo'
);

reset role;
insert into public.blocked_users (blocker_id, blocked_user_id)
values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001');
set local role authenticated;

select is(
  (select count(*)::integer from storage.objects where bucket_id = 'profile-photos'),
  0, 'blocked profile photo is hidden'
);

select is(
  (select count(*)::integer from public.discover_profiles() where id = '10000000-0000-0000-0000-000000000001'),
  0, 'blocked profile is absent from discovery'
);

reset role;
delete from public.blocked_users
where blocker_id = '20000000-0000-0000-0000-000000000002'
  and blocked_user_id = '10000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select avatar_path from public.discover_profiles() where id = '10000000-0000-0000-0000-000000000001'),
  '', 'discovery exposes only the stored avatar path'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$update public.profiles set avatar_path = '10000000-0000-0000-0000-000000000001/avatar.jpg'
    where id = '10000000-0000-0000-0000-000000000001'$$,
  'owner can save their valid avatar path'
);

select throws_ok(
  $$update public.profiles set avatar_path = '20000000-0000-0000-0000-000000000002/avatar.jpg'
    where id = '10000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'profile cannot reference another user photo'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role anon;

select is(
  (select count(*)::integer from storage.objects where bucket_id = 'profile-photos'),
  0, 'anonymous users cannot read profile photos'
);

select throws_ok(
  $$select public.can_view_profile_photo('10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'anonymous users cannot call photo authorization helper'
);

select * from finish();
rollback;
