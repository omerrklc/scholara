begin;
select plan(7);

insert into auth.users (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');
update public.profiles set full_name = 'Reader', onboarding_completed = true
where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set full_name = 'Owner', onboarding_completed = true,
  current_city = 'Istanbul', current_country = 'Turkey', is_relocating = true,
  destination_city = 'Berlin', destination_country = 'Germany', relocation_date = 'October 2026'
where id = '20000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.profiles), 1::bigint, 'authenticated reader sees only own base profile');
select is((select count(*) from public.discover_profiles() where id = '20000000-0000-4000-8000-000000000002'),
  1::bigint, 'eligible other profile appears in discovery');
select is((select current_city || current_country || destination_city || destination_country || relocation_date
  from public.discover_profiles() where id = '20000000-0000-4000-8000-000000000002'), '', 'private locations never leave discovery RPC');
with changed as (
  update public.profiles set full_name = 'Unauthorized edit'
  where id = '20000000-0000-4000-8000-000000000002' returning id
)
select is((select count(*) from changed), 0::bigint, 'reader cannot update another profile');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
update public.profiles set show_current_location = true where id = auth.uid();
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select current_city from public.discover_profiles() where id = '20000000-0000-4000-8000-000000000002'),
  'Istanbul', 'owner opt-in makes only selected location visible');
select public.block_user('20000000-0000-4000-8000-000000000002');
select is((select count(*) from public.discover_profiles() where id = '20000000-0000-4000-8000-000000000002'),
  0::bigint, 'blocker cannot discover blocked user');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.discover_profiles() where id = '10000000-0000-4000-8000-000000000001'),
  0::bigint, 'blocked user cannot discover blocker');
reset role;
select * from finish();
rollback;
