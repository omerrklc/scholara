begin;
select plan(16);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_tokens'::regclass),
  'push tokens have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_deliveries'::regclass),
  'push deliveries have RLS enabled'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'push_tokens' and grantee = 'authenticated'),
  0,
  'authenticated users have no direct push token table grants'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'push_deliveries' and grantee = 'authenticated'),
  0,
  'authenticated users have no push delivery table grants'
);

insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('61000000-0000-4000-8000-000000000001', 'push-one@example.com', '', '{}', '{}', 'authenticated', 'authenticated'),
  ('62000000-0000-4000-8000-000000000002', 'push-two@example.com', '', '{}', '{}', 'authenticated', 'authenticated');

select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select ok(
  public.register_push_token('ExpoPushToken[AAAAAAAAAAAAAAAAAAAAAA]', 'device-identifier-0001', 'android'),
  'signed-in user can register a valid Android token'
);
select throws_ok(
  $$select public.register_push_token('not-a-token', 'device-identifier-0001', 'android')$$,
  '22023', 'Invalid push token', 'malformed push token is rejected'
);
select throws_ok(
  $$select public.register_push_token('ExpoPushToken[BBBBBBBBBBBBBBBBBBBBBB]', 'short', 'android')$$,
  '22023', 'Invalid device identifier', 'short device identifier is rejected'
);
select throws_ok(
  $$select public.register_push_token('ExpoPushToken[BBBBBBBBBBBBBBBBBBBBBB]', 'device-identifier-0002', 'desktop')$$,
  '22023', 'Invalid device platform', 'unsupported platform is rejected'
);
select throws_ok(
  $$select * from public.push_tokens$$,
  '42501', null, 'client cannot read push tokens directly'
);
select throws_ok(
  $$insert into public.push_tokens (user_id, expo_push_token, device_id, platform)
    values ('61000000-0000-4000-8000-000000000001', 'ExpoPushToken[CCCCCCCCCCCCCCCCCCCCCC]', 'device-identifier-0003', 'android')$$,
  '42501', null, 'client cannot insert push tokens directly'
);

reset role;
select is(
  (select count(*)::integer from public.push_tokens where user_id = '61000000-0000-4000-8000-000000000001'),
  1,
  'registration stores exactly one server-protected token'
);

select set_config('request.jwt.claims', '{"sub":"62000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(public.unregister_push_token('device-identifier-0001'), false, 'another user cannot unregister the device');
select ok(
  public.register_push_token('ExpoPushToken[DDDDDDDDDDDDDDDDDDDDDD]', 'device-identifier-0002', 'ios'),
  'second user can register an iOS token'
);
select ok(public.unregister_push_token('device-identifier-0002'), 'owner can unregister the device');

reset role;
select is((select count(*)::integer from public.push_tokens), 1, 'only the first user token remains');
select is((select count(*)::integer from public.push_deliveries), 0, 'clients cannot forge delivery records');

select * from finish();
rollback;
