begin;

select plan(12);

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

select has_check('public', 'profiles', 'profiles_research_interests_shape', 'interests CHECK exists');
select has_check('public', 'profiles', 'profiles_languages_shape', 'languages CHECK exists');

select * from finish();
rollback;
