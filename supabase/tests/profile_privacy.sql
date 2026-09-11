begin;

select plan(12);

select has_column('public', 'profiles', 'show_current_location', 'current location visibility exists');
select has_column('public', 'profiles', 'show_relocation_destination', 'destination visibility exists');
select has_column('public', 'profiles', 'show_relocation_date', 'relocation date visibility exists');
select col_default_is('public', 'profiles', 'show_current_location', 'false', 'current location is private by default');
select col_default_is('public', 'profiles', 'show_relocation_destination', 'false', 'destination is private by default');
select col_default_is('public', 'profiles', 'show_relocation_date', 'false', 'relocation date is private by default');
select policies_are(
  'public', 'profiles',
  array['Users can create their own profile', 'Users can read their own profile', 'Users can update their own profile'],
  'profiles retain owner-only policies'
);
select matches(
  pg_get_function_result('public.discover_profiles()'::regprocedure),
  '.*current_city text.*relocation_date text.*',
  'discovery exposes only its explicit bounded result contract'
);
select matches(
  pg_get_functiondef('public.discover_profiles()'::regprocedure),
  '.*show_current_location.*show_relocation_destination.*show_relocation_date.*',
  'discovery applies all location visibility preferences server-side'
);
select matches(
  pg_get_functiondef('public.discover_profiles()'::regprocedure),
  '.*limit 50.*',
  'discovery remains bounded to 50 profiles'
);
select ok(
  pg_get_function_result('public.discover_profiles()'::regprocedure) !~ '(username|languages|created_at)',
  'discovery does not expose private or unnecessary profile columns'
);
select throws_ok(
  $$ select * from public.discover_profiles() $$,
  '42501',
  'Authentication required',
  'anonymous callers cannot discover profiles'
);

select * from finish();
rollback;
