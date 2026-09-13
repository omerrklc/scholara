begin;
select plan(10);

insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('41000000-0000-4000-8000-000000000001', 'detail-viewer@example.com', '', '{}', '{"full_name":"Detail Viewer"}', 'authenticated', 'authenticated'),
  ('42000000-0000-4000-8000-000000000002', 'detail-target@example.com', '', '{}', '{"full_name":"Detail Target"}', 'authenticated', 'authenticated'),
  ('43000000-0000-4000-8000-000000000003', 'detail-private@example.com', '', '{}', '{"full_name":"Incomplete Target"}', 'authenticated', 'authenticated');

update public.profiles set
  onboarding_completed = true,
  username = 'detail_viewer'
where id = '41000000-0000-4000-8000-000000000001';

update public.profiles set
  onboarding_completed = true,
  username = 'detail_target',
  current_city = 'Private City',
  current_country = 'Private Country',
  show_current_location = false,
  destination_city = 'Visible City',
  destination_country = 'Visible Country',
  is_relocating = true,
  show_relocation_destination = true,
  relocation_date = 'September 2027',
  show_relocation_date = false,
  languages = '[{"name":"Turkish","proficiency":"Native"},{"name":"English","proficiency":"Fluent"}]'::jsonb
where id = '42000000-0000-4000-8000-000000000002';

select set_config('request.jwt.claims', '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::integer from public.get_profile_detail('42000000-0000-4000-8000-000000000002')), 1, 'completed target is available');
select is((select current_city from public.get_profile_detail('42000000-0000-4000-8000-000000000002')), '', 'private current city is hidden');
select is((select destination_city from public.get_profile_detail('42000000-0000-4000-8000-000000000002')), 'Visible City', 'visible destination is returned');
select is((select relocation_date from public.get_profile_detail('42000000-0000-4000-8000-000000000002')), '', 'private relocation date is hidden');
select is((select jsonb_array_length(languages) from public.get_profile_detail('42000000-0000-4000-8000-000000000002')), 2, 'languages are returned on demand');
select is((select connection_state from public.get_profile_detail('42000000-0000-4000-8000-000000000002')), 'none', 'connection state is server-derived');
select is((select count(*)::integer from public.get_profile_detail('43000000-0000-4000-8000-000000000003')), 0, 'incomplete target is hidden');
select throws_ok($$select public.get_profile_detail('41000000-0000-4000-8000-000000000001')$$, '22023', null, 'self profile detail is rejected');

reset role;
insert into public.blocked_users (blocker_id, blocked_user_id)
values ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002');
set local role authenticated;

select is((select count(*)::integer from public.get_profile_detail('42000000-0000-4000-8000-000000000002')), 0, 'blocked target is hidden');

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select throws_ok($$select public.get_profile_detail('42000000-0000-4000-8000-000000000002')$$, '42501', null, 'anonymous users cannot load profile details');

select * from finish();
rollback;
