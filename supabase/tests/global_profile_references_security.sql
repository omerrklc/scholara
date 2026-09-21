begin;
select plan(16);

select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.reference_institutions'::regclass, 'public.reference_cities'::regclass,
  'public.reference_search_cache'::regclass, 'public.reference_search_limits'::regclass
)), 'all reference tables enforce row level security');
select ok(not has_table_privilege('authenticated', 'public.reference_institutions', 'select')
  and not has_table_privilege('authenticated', 'public.reference_cities', 'select'), 'authenticated clients cannot read protected reference tables');
select ok(not has_table_privilege('authenticated', 'public.reference_institutions', 'insert')
  and not has_table_privilege('authenticated', 'public.reference_cities', 'insert'), 'authenticated clients cannot forge reference rows');
select ok(not has_function_privilege('authenticated', 'public.consume_reference_search_quota(uuid, integer)', 'execute'), 'clients cannot invoke the internal quota function');
select ok(not has_function_privilege('authenticated', 'public.cleanup_reference_search_cache(integer)', 'execute'), 'clients cannot invoke internal cache cleanup');
select has_column('public', 'profiles', 'institution_ror_id', 'profiles store a ROR identity');
select has_column('public', 'profiles', 'current_city_geonames_id', 'profiles store a GeoNames city identity');

insert into public.reference_institutions (ror_id, display_name, country_code, country_name, city_name, organization_types)
values ('https://ror.org/059636586', 'Istanbul Technical University', 'TR', 'Türkiye', 'Istanbul', array['education']);
insert into public.reference_cities (geonames_id, display_name, admin1_name, country_code, country_name, population)
values (745044, 'Istanbul', 'Istanbul', 'TR', 'Türkiye', 15000000),
       (2950159, 'Berlin', 'Berlin', 'DE', 'Germany', 3500000);

insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('71000000-0000-4000-8000-000000000001', 'normalized-owner@example.com', '', '{}', '{"full_name":"Normalized Owner"}', 'authenticated', 'authenticated'),
  ('72000000-0000-4000-8000-000000000002', 'normalized-viewer@example.com', '', '{}', '{"full_name":"Normalized Viewer"}', 'authenticated', 'authenticated');

select is((select normalization_version from public.profiles where id = '71000000-0000-4000-8000-000000000001'), 0::smallint, 'existing and newly-created legacy profiles begin at version zero');

select set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$
  update public.profiles set
    username = 'normalized_owner', university = 'Forged label', institution_ror_id = 'https://ror.org/059636586',
    institution_country_code = 'US', current_city = 'Forged city', current_country = 'Forged country',
    current_city_geonames_id = 745044, current_country_code = 'US', normalization_version = 1,
    onboarding_completed = true
  where id = '71000000-0000-4000-8000-000000000001'
$$, 'owner can choose protected reference identities');
reset role;

select is((select university from public.profiles where id = '71000000-0000-4000-8000-000000000001'), 'Istanbul Technical University', 'institution label is canonicalized server-side');
select is((select current_country_code from public.profiles where id = '71000000-0000-4000-8000-000000000001'), 'TR', 'location country is canonicalized server-side');

select set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$update public.profiles set normalization_version = 0 where id = '71000000-0000-4000-8000-000000000001'$$, '22023', 'Normalized profiles cannot be downgraded', 'normalized profiles cannot be downgraded');
select throws_ok($$update public.profiles set current_city_geonames_id = 999999999 where id = '71000000-0000-4000-8000-000000000001'$$, '22023', 'Choose a verified current city', 'unknown reference identities are rejected');
reset role;

update public.profiles set username = 'normalized_viewer', onboarding_completed = true where id = '72000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims', '{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select current_city_geonames_id from public.get_profile_detail('71000000-0000-4000-8000-000000000001')), null::bigint, 'private location identity is hidden from profile details');
reset role;
update public.profiles set show_current_location = true where id = '71000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select current_city_geonames_id from public.get_profile_detail('71000000-0000-4000-8000-000000000001')), 745044::bigint, 'visible location identity is returned by bounded profile details');
reset role;

select set_config('request.jwt.claims', '{"sub":"72000000-0000-4000-8000-000000000002","role":"service_role"}', true);
set local role service_role;
select ok(public.consume_reference_search_quota('72000000-0000-4000-8000-000000000002', 60), 'service role can atomically consume search quota');

select * from finish();
rollback;
