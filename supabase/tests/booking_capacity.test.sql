-- Behavioural test for capacity-based availability and pet overlap (ADR 0011,
-- P-02 / P-03).
--
-- Triggers and RLS stay on and each step signs in as the real actor, so this is
-- the server-side half of what hasBookingConflict() models in the browser:
--
--   - capacity is peak nightly occupancy: with capacity 2, A [1,3), B [3,5) and
--     C [1,5) all confirm, and a stay that would put a third pet on any night is
--     refused (PBC01)
--   - pending, declined, cancelled and completed bookings never occupy a listing
--   - cancelling a confirmed stay frees its place; back-to-back stays fit
--   - a pet cannot be confirmed into overlapping stays on any listings (PBP01),
--     but back-to-back stays and non-confirmed overlaps are fine
--   - refusals carry a fixed message, no DETAIL or HINT, and the other host still
--     cannot read the booking that caused them
--   - capacity cannot drop below the confirmed peak of any current or future
--     night, through a direct update or update_listing_with_images; past nights
--     do not count
--   - assert_booking_capacity_invariants() (the migration preflight) fails loudly
--     on broken data and changes nothing
--
-- booking_concurrency.test.py covers the same rules under real concurrent sessions.
--
-- Run locally after rebuilding the database:
--   npx supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/booking_capacity.test.sql
--
-- Everything happens inside one transaction that is rolled back.

\set ON_ERROR_STOP on
\pset tuples_only on
\echo '== PetSwap booking capacity and pet overlap =='

begin;

-- Seed users: Alex (...001) and Blair (...002) host, Casey (...003) requests.
-- Fixture pets are Casey's, so no seed stay can overlap them. Dates sit 100+
-- days after the UTC booking day so they never go stale.
set local session_replication_role = replica;

insert into public.pets (id, owner_id, name, species)
select ('20000000-0000-4000-8000-0000000007' || lpad(n::text, 2, '0'))::uuid,
       '10000000-0000-4000-8000-000000000003', 'Capacity pet ' || n, 'dog'
from generate_series(1, 6) as n;

insert into public.listings (
  id, owner_id, title, location, description, capacity, accepted_pet_types, status, published_at
)
values
  ('30000000-0000-4000-8000-000000000701', '10000000-0000-4000-8000-000000000001',
   'Capacity one', 'Test City', 'One place.', 1, array['dog']::public.pet_species[], 'published', now()),
  ('30000000-0000-4000-8000-000000000702', '10000000-0000-4000-8000-000000000001',
   'Capacity two', 'Test City', 'Two places.', 2, array['dog']::public.pet_species[], 'published', now()),
  ('30000000-0000-4000-8000-000000000703', '10000000-0000-4000-8000-000000000002',
   'Blair capacity three', 'Test City', 'Another host.', 3, array['dog']::public.pet_species[], 'published', now()),
  ('30000000-0000-4000-8000-000000000704', '10000000-0000-4000-8000-000000000001',
   'Past occupancy', 'Test City', 'Was full in the past.', 2, array['dog']::public.pet_species[], 'published', now()),
  ('30000000-0000-4000-8000-000000000705', '10000000-0000-4000-8000-000000000001',
   'Occupied now', 'Test City', 'Full tonight.', 2, array['dog']::public.pet_species[], 'published', now());

-- Bookings by short name; offsets are days after booking_today() + 100 unless noted.
create temporary table _b (name text primary key, id uuid not null) on commit drop;
grant select on _b to authenticated;

insert into _b (name, id)
select name, ('40000000-0000-4000-8000-0000000007' || lpad(n::text, 2, '0'))::uuid
from unnest(array[
  'A', 'B', 'C', 'D', 'F', 'G', 'H', 'I', 'J', 'K',
  'P_pending', 'P_declined', 'P_cancelled', 'P_completed', 'P_confirm',
  'past1', 'past2', 'now1', 'now2'
]) with ordinality as names(name, n);

insert into public.bookings (id, listing_id, pet_id, requester_id, status, start_date, end_date,
                             confirmed_at, declined_at, cancelled_at, completed_at)
select _b.id, f.listing_id::uuid,
       ('20000000-0000-4000-8000-0000000007' || lpad(f.pet::text, 2, '0'))::uuid,
       '10000000-0000-4000-8000-000000000003', f.status::public.booking_status,
       f.base + f.s, f.base + f.e,
       case when f.status in ('confirmed', 'completed') then now() end,
       case when f.status = 'declined' then now() end,
       case when f.status = 'cancelled' then now() end,
       case when f.status = 'completed' then now() end
from (
  select v.*, case when v.relative_to_today then public.booking_today() else public.booking_today() + 100 end as base
  from (values
    -- capacity 2: A [1,3), B [3,5), C [1,5) all fit; D [2,4) would make three on night 3
    ('A', '30000000-0000-4000-8000-000000000702', 1, 'pending', 1, 3, false),
    ('B', '30000000-0000-4000-8000-000000000702', 2, 'pending', 3, 5, false),
    ('C', '30000000-0000-4000-8000-000000000702', 3, 'pending', 1, 5, false),
    ('D', '30000000-0000-4000-8000-000000000702', 4, 'pending', 2, 4, false),
    -- F [1,3) only fits once A is cancelled
    ('F', '30000000-0000-4000-8000-000000000702', 5, 'pending', 1, 3, false),
    -- capacity 1: G [10,12) and H [12,14) back to back; I [11,13) overlaps both
    ('G', '30000000-0000-4000-8000-000000000701', 1, 'pending', 10, 12, false),
    ('H', '30000000-0000-4000-8000-000000000701', 2, 'pending', 12, 14, false),
    ('I', '30000000-0000-4000-8000-000000000701', 4, 'pending', 11, 13, false),
    -- Blair's listing: pet 3 (confirmed on C [1,5) at Alex's) overlapping, then back to back
    ('J', '30000000-0000-4000-8000-000000000703', 3, 'pending', 4, 6, false),
    ('K', '30000000-0000-4000-8000-000000000703', 3, 'pending', 5, 7, false),
    -- pet 6 holds every non-confirmed status over [20,22); confirming it at Alex's must still work
    ('P_pending',   '30000000-0000-4000-8000-000000000703', 6, 'pending',   20, 22, false),
    ('P_declined',  '30000000-0000-4000-8000-000000000703', 6, 'declined',  20, 22, false),
    ('P_cancelled', '30000000-0000-4000-8000-000000000703', 6, 'cancelled', 20, 22, false),
    ('P_completed', '30000000-0000-4000-8000-000000000703', 6, 'completed', 20, 22, false),
    ('P_confirm',   '30000000-0000-4000-8000-000000000701', 6, 'pending',   20, 22, false),
    -- full only in the past, relative to today
    ('past1', '30000000-0000-4000-8000-000000000704', 1, 'confirmed', -30, -25, true),
    ('past2', '30000000-0000-4000-8000-000000000704', 2, 'confirmed', -29, -26, true),
    -- full tonight: both stays cover today
    ('now1', '30000000-0000-4000-8000-000000000705', 1, 'confirmed', -2, 2, true),
    ('now2', '30000000-0000-4000-8000-000000000705', 2, 'confirmed', -1, 1, true)
  ) as v(name, listing_id, pet, status, s, e, relative_to_today)
) as f
join _b using (name);

set local session_replication_role = origin;

-- Acting as a signed-in user. Each helper switches role for its own statement and
-- back again, so a refusal (which aborts the enclosing block) leaves no role behind.
create function pg_temp.act_as(actor uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.set_status(actor uuid, booking_name text, target public.booking_status)
returns void language plpgsql as $$
declare
  target_id uuid := (select id from _b where name = booking_name);
  changed integer;
begin
  perform pg_temp.act_as(actor);
  update public.bookings set status = target where id = target_id;
  get diagnostics changed = row_count;
  execute 'reset role';
  if changed <> 1 then
    raise exception 'booking capacity: % could not set booking % to % (RLS hid it?)', actor, booking_name, target;
  end if;
end;
$$;

-- Expects a refusal with this SQLSTATE and exactly this message, and no DETAIL
-- or HINT that could describe someone else's booking.
create function pg_temp.expect_refusal(
  actor uuid, booking_name text, target public.booking_status,
  expected_state text, expected_message text, label text
) returns void language plpgsql as $$
declare
  got_state text;
  got_message text;
  got_detail text;
  got_hint text;
begin
  begin
    perform pg_temp.set_status(actor, booking_name, target);
  exception when others then
    get stacked diagnostics
      got_state = returned_sqlstate, got_message = message_text,
      got_detail = pg_exception_detail, got_hint = pg_exception_hint;
  end;
  if got_state is null then
    raise exception 'REGRESSION: % was accepted', label;
  end if;
  if got_state <> expected_state or got_message <> expected_message then
    raise exception 'REGRESSION: % refused with % "%" instead of % "%"',
      label, got_state, got_message, expected_state, expected_message;
  end if;
  if coalesce(got_detail, '') <> '' or coalesce(got_hint, '') <> '' then
    raise exception 'REGRESSION: % exposed DETAIL "%" / HINT "%"', label, got_detail, got_hint;
  end if;
  raise notice 'ok: % refused (%)', label, got_state;
end;
$$;

create function pg_temp.status_of(booking_name text) returns public.booking_status
language sql as $$
  select status from public.bookings where id = (select id from _b where name = booking_name);
$$;

\set alex   '''10000000-0000-4000-8000-000000000001'''
\set blair  '''10000000-0000-4000-8000-000000000002'''
\set casey  '''10000000-0000-4000-8000-000000000003'''
\set full   '''This listing has no remaining capacity for these dates.'''
\set petbusy '''This pet already has a confirmed booking for these dates.'''

-- Peak occupancy, not overlap count ------------------------------------------
select pg_temp.set_status(:alex, 'A', 'confirmed');
select pg_temp.set_status(:alex, 'B', 'confirmed');
select pg_temp.set_status(:alex, 'C', 'confirmed');
\echo 'ok: capacity 2 confirms A [1,3), B [3,5) and C [1,5) (no night holds more than two)'

select pg_temp.expect_refusal(:alex, 'D', 'confirmed', 'PBC01', :full,
  'a third pet on nights 2-3 of a capacity-2 listing');
select pg_temp.expect_refusal(:alex, 'F', 'confirmed', 'PBC01', :full,
  'a third pet on nights 1-2 of a capacity-2 listing');

-- Pending D and F overlapped everything above and blocked nothing; now cancel A.
select pg_temp.set_status(:casey, 'A', 'cancelled');
select pg_temp.set_status(:alex, 'F', 'confirmed');
\echo 'ok: cancelling a confirmed stay releases its place'

-- Back to back on capacity 1 ----------------------------------------------------
select pg_temp.set_status(:alex, 'G', 'confirmed');
select pg_temp.set_status(:alex, 'H', 'confirmed');
\echo 'ok: back-to-back stays fit a capacity-1 listing'
select pg_temp.expect_refusal(:alex, 'I', 'confirmed', 'PBC01', :full,
  'a different pet overlapping a full capacity-1 listing');

-- One pet, one place, across hosts ---------------------------------------------
select pg_temp.expect_refusal(:blair, 'J', 'confirmed', 'PBP01', :petbusy,
  'a pet already confirmed at another host for overlapping dates');

do $$
begin
  perform pg_temp.act_as('10000000-0000-4000-8000-000000000002');
  if exists (select 1 from public.bookings where id = (select id from _b where name = 'C')) then
    raise exception 'REGRESSION: the refused host can read the booking that blocked the pet';
  end if;
  execute 'reset role';
end;
$$;
\echo 'ok: the refused host still cannot read the blocking booking'

select pg_temp.set_status(:blair, 'K', 'confirmed');
\echo 'ok: the same pet starts a stay at another host on the day its last stay ends'

select pg_temp.set_status(:alex, 'P_confirm', 'confirmed');
\echo 'ok: the pet''s pending, declined, cancelled and completed overlaps never block'

do $$
begin
  if pg_temp.status_of('D') <> 'pending' or pg_temp.status_of('I') <> 'pending'
     or pg_temp.status_of('J') <> 'pending' or pg_temp.status_of('P_pending') <> 'pending' then
    raise exception 'REGRESSION: a refused or untouched booking changed status';
  end if;
end;
$$;
\echo 'ok: refused confirmations leave the requests pending'

-- Capacity edits -----------------------------------------------------------------
-- Listing 702 now holds C [1,5), B [3,5) and F [1,3): two pets every night.
do $$
declare
  got_state text;
  got_message text;
begin
  perform pg_temp.act_as('10000000-0000-4000-8000-000000000001');
  begin
    update public.listings set capacity = 1 where id = '30000000-0000-4000-8000-000000000702';
    raise exception 'REGRESSION: capacity dropped below the confirmed upcoming peak';
  exception when sqlstate 'PBC01' then
    get stacked diagnostics got_message = message_text;
    if got_message <> 'Capacity cannot be lower than the confirmed bookings on any upcoming night.' then
      raise exception 'REGRESSION: unexpected capacity refusal "%"', got_message;
    end if;
  end;

  begin
    perform public.update_listing_with_images(
      '30000000-0000-4000-8000-000000000702', 'Capacity two', 'Test City', 'Two places.',
      1, array['dog']::public.pet_species[], null, 'published', now(),
      '{}'::uuid[], '[]'::jsonb, '{}'::uuid[]);
    raise exception 'REGRESSION: update_listing_with_images dropped capacity below the confirmed peak';
  exception when sqlstate 'PBC01' then null;
  end;

  update public.listings set capacity = 3 where id = '30000000-0000-4000-8000-000000000702';
  update public.listings set capacity = 2 where id = '30000000-0000-4000-8000-000000000702';
  execute 'reset role';
end;
$$;
\echo 'ok: capacity cannot drop below the upcoming confirmed peak (direct update and RPC); raising and returning to the peak works'

do $$
begin
  perform pg_temp.act_as('10000000-0000-4000-8000-000000000001');
  update public.listings set capacity = 1 where id = '30000000-0000-4000-8000-000000000704';
  begin
    update public.listings set capacity = 1 where id = '30000000-0000-4000-8000-000000000705';
    raise exception 'REGRESSION: capacity dropped below tonight''s confirmed occupancy';
  exception when sqlstate 'PBC01' then null;
  end;
  execute 'reset role';
end;
$$;
\echo 'ok: past nights do not count, tonight does'

-- Preflight ---------------------------------------------------------------------
select public.assert_booking_capacity_invariants();
\echo 'ok: the invariants hold on the data above'

do $$
declare
  got_message text;
begin
  begin
    -- Break capacity behind the trigger's back: a second confirmed pet over G.
    perform set_config('session_replication_role', 'replica', true);
    update public.bookings set status = 'confirmed'
    where id = (select id from _b where name = 'I');
    perform set_config('session_replication_role', 'origin', true);

    perform public.assert_booking_capacity_invariants();
    raise exception using errcode = 'XX000', message = 'REGRESSION: the preflight accepted a listing over capacity';
  exception when sqlstate 'P0001' then
    get stacked diagnostics got_message = message_text;
    if got_message not like 'Booking capacity invariants violated: 0 pet(s)%, 1 listing(s)%' then
      raise exception 'REGRESSION: unexpected preflight message "%"', got_message;
    end if;
  end;

  if pg_temp.status_of('I') <> 'pending' then
    raise exception 'REGRESSION: the broken row survived the rolled-back block';
  end if;
end;
$$;
\echo 'ok: the preflight fails loudly on over-capacity data and changes nothing'

rollback;

\echo '== booking capacity: all checks passed =='
