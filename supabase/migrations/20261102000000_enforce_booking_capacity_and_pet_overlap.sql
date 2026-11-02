-- One pet per booking; confirmed occupancy, rather than any overlap, consumes
-- listing capacity. The pet exclusion remains a separate cross-listing rule.
lock table public.bookings, public.listings in share row exclusive mode;

create function public.confirmed_booking_peak(
  target_listing_id uuid,
  window_start date,
  window_end date,
  excluded_booking_id uuid default null
)
returns bigint
language sql
volatile
set search_path = ''
as $$
  with stays as (
    select greatest(start_date, window_start) as arrival,
           least(end_date, window_end) as departure
    from public.bookings
    where listing_id = target_listing_id
      and status = 'confirmed'
      and id is distinct from excluded_booking_id
      and start_date < window_end and end_date > window_start
  ), events as (
    select arrival as day, 1 as delta from stays
    union all
    select departure as day, -1 as delta from stays
  ), daily as (
    -- Combine arrivals and departures on the same day before accumulating.
    select day, sum(delta) as delta from events group by day
  ), occupancy as (
    select sum(delta) over (order by day) as pets from daily
  )
  select coalesce(max(pets), 0)::bigint from occupancy;
$$;

-- Internal helper only: a future availability RPC must authorize its own
-- projection instead of exposing arbitrary booking occupancy through this API.
revoke all on function public.confirmed_booking_peak(uuid, date, date, uuid)
  from public, anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1 from public.bookings a join public.bookings b
      on a.pet_id = b.pet_id and a.id < b.id
      and a.start_date < b.end_date and b.start_date < a.end_date
    where a.status = 'confirmed' and b.status = 'confirmed'
  ) then
    raise exception 'Resolve overlapping confirmed stays for the same pet before applying this migration.';
  end if;
  if exists (
    select 1 from public.listings l
    where public.confirmed_booking_peak(l.id, '-infinity', 'infinity') > l.capacity
  ) then
    raise exception 'Resolve confirmed listing occupancy above capacity before applying this migration.';
  end if;
end;
$$;

alter table public.bookings add constraint bookings_no_confirmed_pet_overlap
  exclude using gist (
    pet_id with =,
    daterange(start_date, end_date, '[)') with &&
  ) where (status = 'confirmed');

alter table public.bookings drop constraint bookings_no_confirmed_overlap;

create index bookings_confirmed_listing_window_idx
  on public.bookings (listing_id, start_date, end_date)
  where status = 'confirmed';

create function public.guard_booking_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_capacity integer;
begin
  if new.status <> 'confirmed' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status = new.status and old.listing_id = new.listing_id
      and old.pet_id = new.pet_id and old.start_date = new.start_date
      and old.end_date = new.end_date then
      return new;
    end if;
  end if;

  -- A Repeatable Read snapshot can predate a lock waiter committing. Fail
  -- closed rather than count that stale snapshot. PostgREST uses Read Committed.
  if current_setting('transaction_isolation') not in ('read committed', 'read uncommitted') then
    raise exception using errcode = '0A000',
      message = 'Booking confirmation requires a Read Committed transaction.';
  end if;

  -- Same lock order as booking insertion: listing first, then pet. Capacity
  -- edits already lock this listing row. VOLATILE queries after the wait see
  -- newly committed stays at Read Committed, including other requesters' rows.
  select capacity into listing_capacity
  from public.listings where id = new.listing_id for update;
  perform 1 from public.pets where id = new.pet_id for update;

  if exists (
    select 1 from public.bookings
    where pet_id = new.pet_id and status = 'confirmed'
      and id <> new.id
      and start_date < new.end_date and end_date > new.start_date
  ) then
    -- Do not leak another host's dates through an exclusion constraint DETAIL.
    raise exception using errcode = 'PBP01',
      message = 'This pet already has a confirmed booking for these dates.';
  end if;

  if public.confirmed_booking_peak(new.listing_id, new.start_date, new.end_date, new.id) + 1
    > listing_capacity then
    raise exception using errcode = 'PBC01',
      message = 'This listing has no remaining capacity for these dates.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_booking_availability()
  from public, anon, authenticated, service_role;

-- Run after guard_booking_* has checked ownership and immutable fields.
create trigger zz_guard_booking_availability
before insert or update on public.bookings
for each row execute function public.guard_booking_availability();

create function public.guard_listing_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.capacity < old.capacity then
    if current_setting('transaction_isolation') not in ('read committed', 'read uncommitted') then
      raise exception using errcode = '0A000',
        message = 'Listing capacity reduction requires a Read Committed transaction.';
    end if;
    if public.confirmed_booking_peak(new.id, current_date, 'infinity') > new.capacity then
      raise exception using errcode = 'PBC01',
        message = 'Capacity cannot be lower than the confirmed stays that have not ended.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_listing_capacity()
  from public, anon, authenticated, service_role;

create trigger guard_listing_capacity
before update of capacity on public.listings
for each row execute function public.guard_listing_capacity();
