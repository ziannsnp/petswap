-- Behavioural test for the UTC booking day (ADR 0011, US-6.1 / US-6.6).
--
-- The booking day is the UTC calendar day, whatever TimeZone a session uses.
-- The web app mirrors it in bookingDates.ts. This file proves that:
--
--   - booking_today() equals the UTC date under far-east and far-west session zones
--   - guard_booking_change() uses booking_today(), not the session-dependent current_date
--   - a request may start on the booking day but not the day before, in any session zone
--   - completion is refused the day before the end date and allowed on it
--
-- Run locally after rebuilding the database:
--   npx supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/booking_day.test.sql
--
-- Everything happens inside one transaction that is rolled back.

\set ON_ERROR_STOP on
\echo '== PetSwap booking day =='

begin;

do $$
declare
  zone text;
begin
  foreach zone in array array['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Bangkok', 'America/New_York'] loop
    perform set_config('TimeZone', zone, true);
    if public.booking_today() <> (now() at time zone 'utc')::date then
      raise exception 'booking day: booking_today() follows session zone % instead of UTC', zone;
    end if;
  end loop;
end;
$$;
\echo 'ok: booking_today() is the UTC day in every session zone'

do $$
declare
  source text;
begin
  select prosrc into source from pg_proc where oid = 'public.guard_booking_change()'::regprocedure;
  if source ilike '%current_date%' then
    raise exception 'booking day: guard_booking_change() still uses session-dependent current_date';
  end if;
  if source not ilike '%booking_today()%' then
    raise exception 'booking day: guard_booking_change() does not use booking_today()';
  end if;
end;
$$;
\echo 'ok: the booking guard reads the UTC booking day'

-- Fixtures from seed.sql: Alex (...001) owns the listing, Casey (...003) requests with Rocket (...004).
-- Rocket already has a confirmed seed stay ten days ago and a pet may not hold two
-- overlapping confirmed stays (ADR 0011), so the confirmed fixture stays use Casey's fixture pet Nova (...605).
set local session_replication_role = replica;

insert into public.pets (id, owner_id, name, species)
values ('20000000-0000-4000-8000-000000000605', '10000000-0000-4000-8000-000000000003', 'Nova', 'dog');

insert into public.listings (
  id, owner_id, title, location, description, capacity, accepted_pet_types, status, published_at
)
values
  ('30000000-0000-4000-8000-000000000601', '10000000-0000-4000-8000-000000000001',
   'Booking day case', 'Test City', 'Holds the UTC boundary cases.',
   1, array['dog']::public.pet_species[], 'published', now());

insert into public.bookings (id, listing_id, pet_id, requester_id, status, start_date, end_date, confirmed_at)
values
  ('40000000-0000-4000-8000-000000000601', '30000000-0000-4000-8000-000000000601',
   '20000000-0000-4000-8000-000000000605', '10000000-0000-4000-8000-000000000003',
   'confirmed', public.booking_today(), public.booking_today() + 1, now()),
  ('40000000-0000-4000-8000-000000000602', '30000000-0000-4000-8000-000000000601',
   '20000000-0000-4000-8000-000000000605', '10000000-0000-4000-8000-000000000003',
   'confirmed', public.booking_today() - 10, public.booking_today(), now());

set local session_replication_role = origin;

-- Casey requests in a session far ahead of UTC (+14), then far behind (-11).
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  zone text;
  refused boolean;
begin
  foreach zone in array array['Pacific/Kiritimati', 'Pacific/Pago_Pago'] loop
    perform set_config('TimeZone', zone, true);

    insert into public.bookings (listing_id, pet_id, requester_id, start_date, end_date)
    values ('30000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000004',
            '10000000-0000-4000-8000-000000000003',
            public.booking_today() + 20, public.booking_today() + 22);

    insert into public.bookings (listing_id, pet_id, requester_id, start_date, end_date)
    values ('30000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000004',
            '10000000-0000-4000-8000-000000000003',
            public.booking_today(), public.booking_today() + 2);

    refused := false;
    begin
      insert into public.bookings (listing_id, pet_id, requester_id, start_date, end_date)
      values ('30000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000004',
              '10000000-0000-4000-8000-000000000003',
              public.booking_today() - 1, public.booking_today() + 2);
    exception
      when raise_exception then
        refused := sqlerrm like '%start date cannot be in the past%';
    end;
    if not refused then
      raise exception 'booking day: a request starting before the UTC day was accepted in zone %', zone;
    end if;
  end loop;
end;
$$;
\echo 'ok: requests may start on the UTC booking day, not the day before, in any session zone'

-- Alex completes in a session far ahead of UTC, where the local date is often already tomorrow.
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
set local timezone = 'Pacific/Kiritimati';

do $$
declare
  refused boolean := false;
  stamped timestamptz;
begin
  begin
    update public.bookings set status = 'completed' where id = '40000000-0000-4000-8000-000000000601';
  exception
    when raise_exception then refused := true;
  end;
  if not refused then
    raise exception 'booking day: completion was allowed before the UTC end day';
  end if;

  update public.bookings set status = 'completed'
  where id = '40000000-0000-4000-8000-000000000602'
  returning completed_at into stamped;
  if stamped is null then
    raise exception 'booking day: completion was refused on the UTC end day';
  end if;
end;
$$;
\echo 'ok: completion opens on the UTC end day, not before'

rollback;
