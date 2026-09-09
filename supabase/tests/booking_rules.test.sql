-- Behavioural test for the confirmed-booking overlap rule.
--
-- database_contract.sql checks that the constraint *exists*; this file checks
-- that it *behaves*. The Postgres exclusion constraint is the server-side half of
-- the rule that hasBookingConflict() enforces in the browser (see docs/testing.md
-- "Booking minimum coverage"), so it is covered the same way: overlap, back-to-
-- back, a different listing, and a non-confirmed existing booking.
--
-- Run locally after rebuilding the database:
--   npx supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/booking_rules.test.sql
--
-- Everything happens inside one transaction that is rolled back, so the database
-- is untouched afterwards. session_replication_role = replica disables the
-- app-level guard trigger and foreign-key checks so the test exercises the
-- database constraint directly rather than the trigger in front of it; CHECK and
-- EXCLUDE constraints stay enforced under replica and are what we assert on.

\set ON_ERROR_STOP on
\echo '== PetSwap booking rules =='

begin;

set local session_replication_role = replica;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'contract-owner@petswap.test', '', now(), now()),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'contract-requester@petswap.test', '', now(), now());

insert into public.profiles (id, display_name, username, consent_version, consent_given_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'Contract Owner', 'contract_owner', 'test', now()),
  ('a0000000-0000-4000-8000-000000000002', 'Contract Requester', 'contract_requester', 'test', now());

insert into public.pets (id, owner_id, name, species)
values ('b0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002', 'Contract Pet', 'dog');

insert into public.listings (id, owner_id, title, location, description, capacity, accepted_pet_types, status, published_at)
values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Contract Listing A', 'Test City', 'Fixture listing for contract tests.', 2, array['dog', 'cat'], 'published', now()),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Contract Listing B', 'Test City', 'Second fixture listing.', 1, array['dog'], 'published', now());

-- Anchor: a confirmed stay on listing A for 1-5 Oct (end-exclusive).
insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002', 'confirmed', date '2026-10-01', date '2026-10-05');

do $$
begin
  insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
  values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
          'a0000000-0000-4000-8000-000000000002', 'confirmed', date '2026-10-03', date '2026-10-08');
  raise exception 'REGRESSION: a confirmed booking overlapping 1-5 Oct on listing A was accepted';
exception
  when exclusion_violation then
    raise notice 'ok: overlapping confirmed booking rejected';
end;
$$;

-- Back-to-back: a stay starting the day the anchor ends must be allowed.
insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002', 'confirmed', date '2026-10-05', date '2026-10-09');
\echo 'ok: back-to-back confirmed booking allowed'

-- A non-confirmed booking overlapping the anchor must be allowed (the constraint
-- is partial: WHERE status = 'confirmed').
insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002', 'pending', date '2026-10-02', date '2026-10-06');
\echo 'ok: pending booking overlapping a confirmed stay allowed'

-- A confirmed booking on a different listing for the same dates must be allowed.
insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
values ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002', 'confirmed', date '2026-10-01', date '2026-10-05');
\echo 'ok: confirmed booking on a different listing allowed'

do $$
begin
  insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
  values ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
          'a0000000-0000-4000-8000-000000000002', 'pending', date '2026-10-10', date '2026-10-10');
  raise exception 'REGRESSION: a booking whose end is not after its start was accepted';
exception
  when check_violation then
    raise notice 'ok: zero-length booking window rejected';
end;
$$;

rollback;

\echo '== booking rules: all checks passed =='
