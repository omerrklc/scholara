-- Scholara security hardening: enforce bounded, well-formed profile data in PostgreSQL.
-- Constraints are NOT VALID so deployment cannot be blocked by legacy rows;
-- PostgreSQL still enforces them for every new or updated row.

create or replace function public.is_valid_bounded_text_array(
  values_to_check text[],
  maximum_items integer,
  maximum_item_length integer
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    cardinality(values_to_check) <= maximum_items
    and array_position(values_to_check, null) is null
    and coalesce(bool_and(char_length(btrim(item)) between 1 and maximum_item_length), true)
  from unnest(values_to_check) as item;
$$;

revoke all on function public.is_valid_bounded_text_array(text[], integer, integer)
from public, anon, authenticated;
grant execute on function public.is_valid_bounded_text_array(text[], integer, integer)
to authenticated, service_role;

create or replace function public.is_valid_languages(value_to_check jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  if jsonb_typeof(value_to_check) <> 'array'
     or jsonb_array_length(value_to_check) < 1
     or jsonb_array_length(value_to_check) > 10 then
    return false;
  end if;

  return not exists (
    select 1
    from jsonb_array_elements(value_to_check) as language(value)
    where jsonb_typeof(language.value) <> 'object'
       or jsonb_typeof(language.value -> 'name') <> 'string'
       or jsonb_typeof(language.value -> 'proficiency') <> 'string'
       or char_length(btrim(language.value ->> 'name')) not between 1 and 50
       or char_length(btrim(language.value ->> 'proficiency')) not between 1 and 30
       or exists (
         select 1
         from jsonb_object_keys(language.value) as key
         where key not in ('name', 'proficiency')
       )
  );
end;
$$;

revoke all on function public.is_valid_languages(jsonb)
from public, anon, authenticated;
grant execute on function public.is_valid_languages(jsonb)
to authenticated, service_role;

alter table public.profiles
  add constraint profiles_university_length check (char_length(university) <= 160) not valid,
  add constraint profiles_department_length check (char_length(department) <= 120) not valid,
  add constraint profiles_program_length check (char_length(program) <= 160) not valid,
  add constraint profiles_current_city_length check (char_length(current_city) <= 100) not valid,
  add constraint profiles_current_country_length check (char_length(current_country) <= 100) not valid,
  add constraint profiles_destination_city_length check (char_length(destination_city) <= 100) not valid,
  add constraint profiles_destination_country_length check (char_length(destination_country) <= 100) not valid,
  add constraint profiles_research_interests_shape check (
    public.is_valid_bounded_text_array(research_interests, 20, 60)
  ) not valid,
  add constraint profiles_intents_shape check (
    public.is_valid_bounded_text_array(intents, 10, 80)
  ) not valid,
  add constraint profiles_languages_shape check (
    public.is_valid_languages(languages)
  ) not valid,
  add constraint profiles_relocation_date_format check (
    relocation_date = ''
    or relocation_date ~ '^(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}$'
  ) not valid,
  add constraint profiles_relocation_consistency check (
    is_relocating
    or (destination_city = '' and destination_country = '' and relocation_date = '')
  ) not valid;

comment on function public.is_valid_bounded_text_array(text[], integer, integer)
is 'Internal CHECK helper for bounded, non-empty text arrays.';

comment on function public.is_valid_languages(jsonb)
is 'Internal CHECK helper for the bounded Scholara language object array.';
