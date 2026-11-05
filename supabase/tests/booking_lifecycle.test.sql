-- Behavioural test for who may move a booking through its lifecycle.
--
-- booking_rules.test.sql turns the guard trigger off to test the overlap constraint on
-- its own; this file keeps the trigger and RLS on and signs in as each actor, so it is
-- the server-side half of the rules that isValidBookingTransition() and
-- canCompleteBooking() apply in the browser:
--
--   - only the listing owner confirms or declines, and only a pending request
--   - confirming is refused when it would overlap another confirmed booking
--   - only the requester cancels, and only a pending or confirmed booking
--   - only the listing owner completes, only a confirmed booking, and only on or
--     after its end date (end-exclusive: check-out day counts)
--   - strangers and anonymous callers change nothing
--
-- Run locally after rebuilding the database:
--   npx supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/booking_lifecycle.test.sql
--
-- Everything happens inside one transaction that is rolled back.

\set ON_ERROR_STOP on
\echo '== PetSwap booking lifecycle =='

begin;

-- Fixtures. Seed users: Alex (...001) owns the fixture listing, Blair (...002) is a
-- stranger to it, and Casey (...003) requests every booking with Rocket (...004).
-- Dates are relative to current_date so the past/future cases never go stale.
-- Triggers are off for the load so each booking can start in its final status.
set local session_replication_role = replica;

insert into public.listings (
  id, owner_id, title, location, description, capacity, accepted_pet_types,
  status, published_at
)
values
  ('30000000-0000-4000-8000-000000000401', '10000000-0000-4000-8000-000000000001',
   'Lifecycle case', 'Test City', 'Holds one booking per lifecycle case.',
   1, array['dog']::public.pet_species[], 'published', now());

insert into public.bookings (
  id, listing_id, pet_id, requester_id, status, start_date, end_date,
  confirmed_at, declined_at, cancelled_at
)
select
  b.id, '30000000-0000-4000-8000-000000000401', '20000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000003', b.status,
  current_date + b.start_offset, current_date + b.end_offset,
  case when b.status = 'confirmed' then now() end,
  case when b.status = 'declined' then now() end,
  case when b.status = 'cancelled' then now() end
from (values
  ('40000000-0000-4000-8000-000000000401'::uuid, 'pending'::public.booking_status,   30,  34), -- owner confirms
  ('40000000-0000-4000-8000-000000000402'::uuid, 'pending'::public.booking_status,   40,  44), -- owner declines
  ('40000000-0000-4000-8000-000000000403'::uuid, 'pending'::public.booking_status,   32,  36), -- overlaps ...401 once confirmed
  ('40000000-0000-4000-8000-000000000404'::uuid, 'pending'::public.booking_status,   50,  54), -- requester cancels
  ('40000000-0000-4000-8000-000000000405'::uuid, 'confirmed'::public.booking_status, 60,  64), -- requester cancels
  ('40000000-0000-4000-8000-000000000406'::uuid, 'declined'::public.booking_status,  70,  74), -- terminal
  ('40000000-0000-4000-8000-000000000407'::uuid, 'confirmed'::public.booking_status, -10, -6), -- finished: owner completes
  ('40000000-0000-4000-8000-000000000408'::uuid, 'confirmed'::public.booking_status, -3,   0), -- ends today: owner completes
  ('40000000-0000-4000-8000-000000000409'::uuid, 'confirmed'::public.booking_status, 80,  84), -- not finished yet
  ('40000000-0000-4000-8000-000000000410'::uuid, 'pending'::public.booking_status,   -10, -6), -- past but never confirmed
  ('40000000-0000-4000-8000-000000000411'::uuid, 'cancelled'::public.booking_status, -20, -16) -- terminal
) as b(id, status, start_offset, end_offset);

set local session_replication_role = origin;

-- Blair, a signed-in stranger, can neither see nor change any of these bookings.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  attempt record;
  changed integer;
begin
  if exists (select 1 from public.bookings where listing_id = '30000000-0000-4000-8000-000000000401') then
    raise exception 'booking lifecycle: a stranger could read bookings on someone else''s listing';
  end if;

  for attempt in
    select * from (values
      ('40000000-0000-4000-8000-000000000401'::uuid, 'confirmed'::public.booking_status),
      ('40000000-0000-4000-8000-000000000402'::uuid, 'declined'::public.booking_status),
      ('40000000-0000-4000-8000-000000000404'::uuid, 'cancelled'::public.booking_status),
      ('40000000-0000-4000-8000-000000000405'::uuid, 'cancelled'::public.booking_status),
      ('40000000-0000-4000-8000-000000000407'::uuid, 'completed'::public.booking_status)
    ) as a(booking_id, target)
  loop
    changed := 0;
    begin
      update public.bookings set status = attempt.target where id = attempt.booking_id;
      get diagnostics changed = row_count;
    exception
      when raise_exception or insufficient_privilege then changed := 0;
    end;

    if changed <> 0 then
      raise exception 'booking lifecycle: a stranger set booking % to %', attempt.booking_id, attempt.target;
    end if;
  end loop;
end;
$$;
\echo 'ok: a stranger cannot read or change bookings'

-- Alex, the listing owner.
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  stamped timestamptz;
begin
  update public.bookings set status = 'confirmed'
  where id = '40000000-0000-4000-8000-000000000401'
  returning confirmed_at into stamped;
  if stamped is null then
    raise exception 'booking lifecycle: the owner could not confirm a pending request';
  end if;

  stamped := null;
  update public.bookings set status = 'declined'
  where id = '40000000-0000-4000-8000-000000000402'
  returning declined_at into stamped;
  if stamped is null then
    raise exception 'booking lifecycle: the owner could not decline a pending request';
  end if;

  stamped := null;
  update public.bookings set status = 'completed'
  where id = '40000000-0000-4000-8000-000000000407'
  returning completed_at into stamped;
  if stamped is null then
    raise exception 'booking lifecycle: the owner could not complete a finished confirmed booking';
  end if;

  stamped := null;
  update public.bookings set status = 'completed'
  where id = '40000000-0000-4000-8000-000000000408'
  returning completed_at into stamped;
  if stamped is null then
    raise exception 'booking lifecycle: the owner could not complete a booking on its end date';
  end if;
end;
$$;
\echo 'ok: the owner confirms, declines, and completes finished bookings'

do $$
begin
  update public.bookings set status = 'confirmed'
  where id = '40000000-0000-4000-8000-000000000403';
  raise exception 'booking lifecycle: the owner confirmed a request overlapping a confirmed booking';
exception
  when exclusion_violation then null;
end;
$$;
\echo 'ok: confirming an overlapping request is refused'

do $$
declare
  attempt record;
  changed integer;
begin
  for attempt in
    select * from (values
      ('40000000-0000-4000-8000-000000000404'::uuid, 'cancelled'::public.booking_status, 'cancel a pending booking'),
      ('40000000-0000-4000-8000-000000000405'::uuid, 'cancelled'::public.booking_status, 'cancel a confirmed booking'),
      ('40000000-0000-4000-8000-000000000409'::uuid, 'completed'::public.booking_status, 'complete a booking before its end date'),
      ('40000000-0000-4000-8000-000000000410'::uuid, 'completed'::public.booking_status, 'complete a pending booking'),
      ('40000000-0000-4000-8000-000000000411'::uuid, 'completed'::public.booking_status, 'complete a cancelled booking'),
      ('40000000-0000-4000-8000-000000000406'::uuid, 'confirmed'::public.booking_status, 'confirm a declined booking'),
      ('40000000-0000-4000-8000-000000000409'::uuid, 'declined'::public.booking_status,  'decline a confirmed booking'),
      ('40000000-0000-4000-8000-000000000407'::uuid, 'confirmed'::public.booking_status, 'reopen a completed booking')
    ) as a(booking_id, target, action)
  loop
    changed := 0;
    begin
      update public.bookings set status = attempt.target where id = attempt.booking_id;
      get diagnostics changed = row_count;
    exception
      when raise_exception or insufficient_privilege then changed := 0;
    end;

    if changed <> 0 then
      raise exception 'booking lifecycle: the owner was allowed to %', attempt.action;
    end if;
  end loop;
end;
$$;
\echo 'ok: the owner cannot cancel, complete early, or leave a terminal status'

-- Casey, the requester.
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  stamped timestamptz;
begin
  update public.bookings set status = 'cancelled'
  where id = '40000000-0000-4000-8000-000000000404'
  returning cancelled_at into stamped;
  if stamped is null then
    raise exception 'booking lifecycle: the requester could not cancel a pending booking';
  end if;

  stamped := null;
  update public.bookings set status = 'cancelled'
  where id = '40000000-0000-4000-8000-000000000405'
  returning cancelled_at into stamped;
  if stamped is null then
    raise exception 'booking lifecycle: the requester could not cancel a confirmed booking';
  end if;
end;
$$;
\echo 'ok: the requester cancels pending and confirmed bookings'

do $$
declare
  attempt record;
  changed integer;
begin
  for attempt in
    select * from (values
      ('40000000-0000-4000-8000-000000000403'::uuid, 'confirmed'::public.booking_status, 'confirm their own request'),
      ('40000000-0000-4000-8000-000000000403'::uuid, 'declined'::public.booking_status,  'decline their own request'),
      ('40000000-0000-4000-8000-000000000409'::uuid, 'completed'::public.booking_status, 'complete their own booking'),
      ('40000000-0000-4000-8000-000000000402'::uuid, 'cancelled'::public.booking_status, 'cancel a declined booking'),
      ('40000000-0000-4000-8000-000000000407'::uuid, 'cancelled'::public.booking_status, 'cancel a completed booking'),
      ('40000000-0000-4000-8000-000000000411'::uuid, 'pending'::public.booking_status,   'reopen a cancelled booking')
    ) as a(booking_id, target, action)
  loop
    changed := 0;
    begin
      update public.bookings set status = attempt.target where id = attempt.booking_id;
      get diagnostics changed = row_count;
    exception
      when raise_exception or insufficient_privilege then changed := 0;
    end;

    if changed <> 0 then
      raise exception 'booking lifecycle: the requester was allowed to %', attempt.action;
    end if;
  end loop;
end;
$$;
\echo 'ok: the requester cannot respond to, complete, or cancel a finished booking'

-- Signed out: no user id in the claims, so auth.uid() is null.
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  changed integer := 0;
begin
  begin
    update public.bookings set status = 'confirmed'
    where id = '40000000-0000-4000-8000-000000000403';
    get diagnostics changed = row_count;
  exception
    when insufficient_privilege then changed := 0;
  end;

  if changed <> 0 then
    raise exception 'booking lifecycle: an anonymous caller changed a booking';
  end if;
end;
$$;
\echo 'ok: an anonymous caller cannot change a booking'

-- Every refused attempt above must have left its booking untouched.
reset role;

do $$
declare
  mismatch record;
begin
  for mismatch in
    select expected.booking_id, expected.status as expected_status, actual.status as actual_status
    from (values
      ('40000000-0000-4000-8000-000000000401'::uuid, 'confirmed'::public.booking_status),
      ('40000000-0000-4000-8000-000000000402'::uuid, 'declined'::public.booking_status),
      ('40000000-0000-4000-8000-000000000403'::uuid, 'pending'::public.booking_status),
      ('40000000-0000-4000-8000-000000000404'::uuid, 'cancelled'::public.booking_status),
      ('40000000-0000-4000-8000-000000000405'::uuid, 'cancelled'::public.booking_status),
      ('40000000-0000-4000-8000-000000000406'::uuid, 'declined'::public.booking_status),
      ('40000000-0000-4000-8000-000000000407'::uuid, 'completed'::public.booking_status),
      ('40000000-0000-4000-8000-000000000408'::uuid, 'completed'::public.booking_status),
      ('40000000-0000-4000-8000-000000000409'::uuid, 'confirmed'::public.booking_status),
      ('40000000-0000-4000-8000-000000000410'::uuid, 'pending'::public.booking_status),
      ('40000000-0000-4000-8000-000000000411'::uuid, 'cancelled'::public.booking_status)
    ) as expected(booking_id, status)
    left join public.bookings as actual on actual.id = expected.booking_id
    where actual.status is distinct from expected.status
  loop
    raise exception 'booking lifecycle: booking % ended as % instead of %',
      mismatch.booking_id, coalesce(mismatch.actual_status::text, 'missing'), mismatch.expected_status;
  end loop;
end;
$$;
\echo 'ok: refused attempts left every booking unchanged'

rollback;

\echo '== booking lifecycle: all checks passed =='
