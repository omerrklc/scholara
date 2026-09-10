-- Scholara moderation: allow one private report to contain multiple applicable reasons.

alter table public.user_reports
add column if not exists reasons text[];

update public.user_reports
set reasons = array[reason]
where reasons is null;

alter table public.user_reports
alter column reasons set not null;

alter table public.user_reports
drop constraint if exists user_reports_reasons_valid;

alter table public.user_reports
add constraint user_reports_reasons_valid check (
  cardinality(reasons) between 1 and 6
  and array_position(reasons, null) is null
  and reasons <@ array['spam', 'harassment', 'impersonation', 'inappropriate_content', 'privacy', 'other']::text[]
);

create or replace function public.report_user(
  target_user_id uuid,
  report_reasons text[],
  report_details text default '',
  report_source text default 'profile'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_details text := btrim(coalesce(report_details, ''));
  clean_reasons text[];
  report_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if target_user_id is null or target_user_id = caller_id then
    raise exception using errcode = '22023', message = 'Invalid reported user';
  end if;

  select array_agg(reason order by first_position)
  into clean_reasons
  from (
    select reason, min(position) as first_position
    from unnest(coalesce(report_reasons, array[]::text[])) with ordinality as selected(reason, position)
    group by reason
  ) deduplicated;

  if clean_reasons is null
    or cardinality(clean_reasons) > 6
    or array_position(clean_reasons, null) is not null
    or not clean_reasons <@ array['spam', 'harassment', 'impersonation', 'inappropriate_content', 'privacy', 'other']::text[] then
    raise exception using errcode = '22023', message = 'Invalid report reasons';
  end if;
  if report_source not in ('discover', 'matches', 'chat', 'profile') then
    raise exception using errcode = '22023', message = 'Invalid report source';
  end if;
  if char_length(clean_details) > 1000 then
    raise exception using errcode = '22023', message = 'Report details are too long';
  end if;
  if not exists (select 1 from public.profiles where profiles.id = target_user_id) then
    raise exception using errcode = '22023', message = 'User is unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
  if (
    select count(*) from public.user_reports
    where reporter_id = caller_id
      and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception using errcode = 'P0001', message = 'Daily report limit exceeded';
  end if;

  insert into public.user_reports (reporter_id, reported_user_id, reason, reasons, details, source)
  values (caller_id, target_user_id, clean_reasons[1], clean_reasons, clean_details, report_source)
  returning id into report_id;
  return report_id;
end;
$$;

revoke all on function public.report_user(uuid, text[], text, text) from public, anon, authenticated;
grant execute on function public.report_user(uuid, text[], text, text) to authenticated, service_role;
