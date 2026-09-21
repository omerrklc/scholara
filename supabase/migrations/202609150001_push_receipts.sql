-- Bounded, service-only Expo push receipt processing.

alter table public.push_deliveries
  add column receipt_status text
    constraint push_deliveries_receipt_status_check check (receipt_status in ('ok', 'error')),
  add column receipt_attempts integer not null default 0
    constraint push_deliveries_receipt_attempts_check check (receipt_attempts between 0 and 6),
  add column receipt_checked_at timestamptz,
  add column next_receipt_check_at timestamptz;

alter table public.push_deliveries
  add constraint push_deliveries_receipt_state_check check (
    (receipt_status is null and receipt_checked_at is null)
    or (receipt_status is not null and receipt_checked_at is not null)
  );

create index push_deliveries_pending_receipt_idx
on public.push_deliveries (next_receipt_check_at, attempted_at, id)
where status = 'sent' and ticket_id is not null and receipt_status is null;

create or replace function public.claim_pending_push_receipts(batch_size integer default 100)
returns table (
  delivery_id uuid,
  push_token_id uuid,
  ticket_id text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if batch_size is null or batch_size < 1 or batch_size > 1000 then
    raise exception using errcode = '22023', message = 'Batch size must be between 1 and 1000';
  end if;

  return query
  with candidates as (
    select deliveries.id
    from public.push_deliveries as deliveries
    where deliveries.status = 'sent'
      and deliveries.ticket_id is not null
      and deliveries.receipt_status is null
      and deliveries.receipt_attempts < 6
      and deliveries.attempted_at <= now() - interval '5 minutes'
      and coalesce(deliveries.next_receipt_check_at, '-infinity'::timestamptz) <= now()
    order by deliveries.attempted_at, deliveries.id
    for update skip locked
    limit batch_size
  ), claimed as (
    update public.push_deliveries as deliveries
    set receipt_attempts = deliveries.receipt_attempts + 1,
        next_receipt_check_at = now() + make_interval(
          secs => least(3600, 60 * (2 ^ deliveries.receipt_attempts)::integer)
        )
    from candidates
    where deliveries.id = candidates.id
    returning deliveries.id, deliveries.push_token_id, deliveries.ticket_id, deliveries.receipt_attempts
  )
  select claimed.id, claimed.push_token_id, claimed.ticket_id, claimed.receipt_attempts
  from claimed;
end;
$$;

create or replace function public.cleanup_old_push_deliveries(batch_size integer default 500)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if batch_size is null or batch_size < 1 or batch_size > 1000 then
    raise exception using errcode = '22023', message = 'Batch size must be between 1 and 1000';
  end if;

  delete from public.push_deliveries
  where id in (
    select id
    from public.push_deliveries
    where attempted_at < now() - interval '30 days'
    order by attempted_at, id
    limit batch_size
  );
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.claim_pending_push_receipts(integer) from public, anon, authenticated;
revoke all on function public.cleanup_old_push_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_push_receipts(integer) to service_role;
grant execute on function public.cleanup_old_push_deliveries(integer) to service_role;
