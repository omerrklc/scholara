begin;

select plan(17);

select ok(public.is_valid_bounded_text_array(array['GIS', 'Mobility'], 20, 60), 'accepts valid interests');
select isnt(public.is_valid_bounded_text_array(array_fill('x'::text, array[21]), 20, 60), true, 'rejects too many interests');
select isnt(public.is_valid_bounded_text_array(array[repeat('x', 61)], 20, 60), true, 'rejects long interests');
select isnt(public.is_valid_bounded_text_array(array[''], 20, 60), true, 'rejects empty interests');
select isnt(public.is_valid_bounded_text_array(array['GIS', null], 20, 60), true, 'rejects null interests');

select ok(public.is_valid_languages('[{"name":"English","proficiency":"Fluent"}]'::jsonb), 'accepts valid language objects');
select isnt(public.is_valid_languages('[]'::jsonb), true, 'requires at least one language');
select isnt(public.is_valid_languages('{}'::jsonb), true, 'rejects a non-array language value');
select isnt(public.is_valid_languages('[{"name":"","proficiency":"Fluent"}]'::jsonb), true, 'rejects an empty language name');
select isnt(public.is_valid_languages('[{"name":"English","proficiency":"Fluent","admin":true}]'::jsonb), true, 'rejects unexpected language keys');
select isnt(public.is_valid_languages('[{}]'::jsonb), true, 'rejects missing language fields');
select isnt(public.is_valid_languages('[{"name":"English"}]'::jsonb), true, 'requires proficiency');
select isnt(public.is_valid_languages('[{"proficiency":"Fluent"}]'::jsonb), true, 'requires language name');
select isnt(public.is_valid_languages('["English"]'::jsonb), true, 'rejects scalar array elements without throwing');
select isnt(public.is_valid_languages('[{"name":"English","proficiency":"Fluent"},{"name":" english ","proficiency":"Native"}]'::jsonb), true, 'rejects duplicate language names');

select ok(exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_research_interests_shape' and contype = 'c'), 'interests CHECK exists');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_languages_shape' and contype = 'c'), 'languages CHECK exists');

select * from finish();
rollback;
