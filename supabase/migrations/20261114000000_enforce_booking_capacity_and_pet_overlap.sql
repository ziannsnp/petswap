-- Capacity-based booking availability and cross-listing pet overlap (ADR 0011,
-- P-02 / P-03).
--
-- Replaces the listing-wide `bookings_no_confirmed_overlap` exclusion, which let
-- one confirmed stay block a whole listing whatever its capacity, with:
--
--   * listing capacity as peak nightly occupancy: a confirmation is valid when no
--     night of its stay holds more confirmed bookings on that listing than
--     `capacity` (with capacity 2, A [1,3), B [3,5) and C [1,5) all fit);
--   * one pet in one place: a pet never has two overlapping confirmed bookings,
--     on any listings; end-exclusive, so back-to-back stays are valid;
--   * capacity edits refused below the confirmed peak of any current or future
--     night (the booking day is booking_today(), the UTC day).
--
-- Only `confirmed` bookings occupy anything; pending, declined, cancelled and
-- completed never block. Every check runs in the database, under row locks taken
-- in one order (listing, then pet), so concurrent confirmations and capacity
-- edits serialize. Refusals use two distinct SQLSTATEs and fixed messages that
-- never name another booking, its dates, its requester or its listing:
--
--   PBC01  listing has no remaining capacity for these dates
--   PBP01  this pet already has a confirmed booking for these dates
--
-- The migration preflights existing data and fails loudly; it never cancels or
-- edits a booking to make the new rules fit.

-- Hold off writers while the rules change, so no booking is confirmed between
-- the preflight and the new trigger.
lock table public.bookings, public.listings in share row exclusive mode;

-- Peak number of confirmed bookings on one listing on any night of
-- [window_start, window_end), optionally ignoring one booking (the one being
-- confirmed). A sweep over arrivals (+1) and departures (-1), clipped to the
-- window; departures and arrivals on the same day net out first, which is what
-- makes back-to-back stays not overlap.
create function public.confirmed_booking_peak(
  target_listing_id uuid,
  window_start date,
  window_end date,
  excluded_booking_id uuid default null
)
returns integer
language sql
volatile -- a fresh snapshot per call: callers rely on it after waiting for a lock
set search_path = ''
as $$
  with stays as (
    select greatest(b.start_date, window_start) as arrival,
           least(b.end_date, window_end) as departure
    from public.bookings b
    where b.listing_id = target_listing_id
      and b.status = 'confirmed'
      and b.id is distinct from excluded_booking_id
      and b.start_date < window_end
      and b.end_date > window_start
  ), events as (
    select arrival as day, 1 as delta from stays
    union all
    select departure as day, -1 as delta from stays
  ), daily as (
    select day, sum(delta) as delta from events group by day
  ), occupancy as (
    select sum(delta) over (order by day) as pets from daily
  )
  select coalesce(max(pets), 0)::integer from occupancy;
$$;

comment on function public.confirmed_booking_peak(uuid, date, date, uuid) is
  'Internal: peak nightly count of confirmed bookings on a listing within [window_start, window_end) (ADR 0011). Not exposed to API roles; search exposes only an aggregate yes/no.';

-- Internal only. Occupancy of a listing is other people's booking data; any
-- public projection (search, P-05) must authorize and aggregate on its own.
revoke all on function public.confirmed_booking_peak(uuid, date, date, uuid)
  from public, anon, authenticated, service_role;

-- The invariants the triggers below maintain, checkable at any time. The
-- migration calls it as its preflight; booking_capacity.test.sql calls it on
-- deliberately broken data to prove it fails loudly. It reports counts only.
create function public.assert_booking_capacity_invariants()
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  overlapping_pets integer;
  over_capacity_listings integer;
begin
  select count(distinct a.pet_id) into overlapping_pets
  from public.bookings a
  join public.bookings b
    on a.pet_id = b.pet_id
   and a.id < b.id
   and a.start_date < b.end_date
   and b.start_date < a.end_date
  where a.status = 'confirmed' and b.status = 'confirmed';

  select count(*) into over_capacity_listings
  from public.listings l
  -- Current and future nights only, like guard_listing_capacity: a host may
  -- lower capacity below a past night's occupancy.
  where public.confirmed_booking_peak(l.id, public.booking_today(), 'infinity'::date) > l.capacity;

  if overlapping_pets > 0 or over_capacity_listings > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Booking capacity invariants violated: %s pet(s) with overlapping confirmed bookings, %s listing(s) with confirmed occupancy above capacity on a current or future night.',
        overlapping_pets, over_capacity_listings
      ),
      hint = 'Resolve these bookings by hand (cancel or move them with the participants); this check never changes data.';
  end if;
end;
$$;

revoke all on function public.assert_booking_capacity_invariants()
  from public, anon, authenticated, service_role;

-- Preflight. The old exclusion kept one confirmed stay per listing per night, so
-- capacity cannot already be exceeded, but nothing stopped a pet being
-- confirmed on two listings at once. Fail rather than guess which stay wins.
select public.assert_booking_capacity_invariants();

-- P-03 backstop: the guard below refuses an overlapping pet first, with a
-- message that reveals nothing. This constraint only fires if a write bypasses
-- that trigger (session_replication_role = replica), so its DETAIL, which does
-- contain dates, never reaches the API.
alter table public.bookings
  add constraint bookings_no_confirmed_pet_overlap
  exclude using gist (
    pet_id with =,
    daterange(start_date, end_date, '[)') with &&
  ) where (status = 'confirmed');

alter table public.bookings drop constraint bookings_no_confirmed_overlap;

create index bookings_confirmed_listing_window_idx
  on public.bookings (listing_id, start_date, end_date)
  where status = 'confirmed';

-- Every path that makes a booking confirmed (today only the owner's update;
-- inserts must start pending) passes through this trigger.
create function public.guard_booking_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_capacity integer;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'confirmed' then
    -- Already holding its place; dates, listing and pet are immutable
    -- (guard_booking_change), so nothing about its occupancy changed.
    return new;
  end if;

  -- A Repeatable Read or Serializable snapshot can predate a competing
  -- confirmation that committed while we waited for the lock, and would count
  -- stale occupancy. Fail closed. PostgREST runs requests at Read Committed.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using
      errcode = '0A000',
      message = 'Booking confirmation requires a Read Committed transaction.';
  end if;

  -- Lock order: listing, then pet (the same order booking inserts use).
  -- Capacity edits update, and so lock, the same listing row.
  select capacity into listing_capacity
  from public.listings
  where id = new.listing_id
  for update;

  perform 1 from public.pets where id = new.pet_id for update;

  -- Statements below take a new snapshot, so they see every confirmation that
  -- committed while we waited.
  if exists (
    select 1
    from public.bookings
    where pet_id = new.pet_id
      and status = 'confirmed'
      and id <> new.id
      and start_date < new.end_date
      and end_date > new.start_date
  ) then
    raise exception using
      errcode = 'PBP01',
      message = 'This pet already has a confirmed booking for these dates.';
  end if;

  if public.confirmed_booking_peak(new.listing_id, new.start_date, new.end_date, new.id) + 1
       > listing_capacity then
    raise exception using
      errcode = 'PBC01',
      message = 'This listing has no remaining capacity for these dates.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_booking_availability()
  from public, anon, authenticated, service_role;

-- Before-row triggers fire in name order. "hold_…" sorts after
-- guard_booking_insert / guard_booking_update, so the caller has already been
-- authorized and the transition validated before any occupancy is read or any
-- lock taken: a stranger learns nothing about capacity.
create trigger hold_booking_availability
before insert or update of status on public.bookings
for each row
when (new.status = 'confirmed')
execute function public.guard_booking_availability();

-- Capacity edits (direct updates and update_listing_with_images alike). The
-- UPDATE already holds this listing's row lock, which confirmations wait on.
create function public.guard_listing_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.capacity >= old.capacity then
    return new;
  end if;

  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using
      errcode = '0A000',
      message = 'Listing capacity reduction requires a Read Committed transaction.';
  end if;

  -- Only nights from today (UTC) onwards matter; history may have been fuller.
  if public.confirmed_booking_peak(new.id, public.booking_today(), 'infinity'::date) > new.capacity then
    raise exception using
      errcode = 'PBC01',
      message = 'Capacity cannot be lower than the confirmed bookings on any upcoming night.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_listing_capacity()
  from public, anon, authenticated, service_role;

create trigger guard_listing_capacity
before update of capacity on public.listings
for each row
execute function public.guard_listing_capacity();
