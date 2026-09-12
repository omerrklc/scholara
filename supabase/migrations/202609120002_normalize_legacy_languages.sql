-- Normalize legacy language arrays created before duplicate prevention existed.
-- Keep the first valid occurrence of each name, case-insensitively.

update public.profiles as profile
set languages = coalesce(
  (
    select jsonb_agg(deduplicated.value order by deduplicated.ordinality)
    from (
      select distinct on (lower(btrim(language.value ->> 'name')))
        language.value,
        language.ordinality
      from jsonb_array_elements(profile.languages) with ordinality as language(value, ordinality)
      where jsonb_typeof(language.value) = 'object'
        and language.value ? 'name'
        and language.value ? 'proficiency'
        and jsonb_typeof(language.value -> 'name') = 'string'
        and jsonb_typeof(language.value -> 'proficiency') = 'string'
        and char_length(btrim(language.value ->> 'name')) between 1 and 50
        and char_length(btrim(language.value ->> 'proficiency')) between 1 and 30
        and not exists (
          select 1
          from jsonb_object_keys(language.value) as key
          where key not in ('name', 'proficiency')
        )
      order by lower(btrim(language.value ->> 'name')), language.ordinality
    ) as deduplicated
  ),
  '[{"name":"English","proficiency":"Fluent"}]'::jsonb
)
where not public.is_valid_languages(profile.languages);
