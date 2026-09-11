-- Require both documented fields on every language object.
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
       or not (language.value ? 'name')
       or not (language.value ? 'proficiency')
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

revoke all on function public.is_valid_languages(jsonb) from public, anon, authenticated;
grant execute on function public.is_valid_languages(jsonb) to authenticated, service_role;
