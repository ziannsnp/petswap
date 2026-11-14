-- Behavioural test for the booking constraints that hold even with triggers off.
--
-- database_contract.sql checks that the constraints *exist*; this file checks
-- that they *behave*. Since ADR 0011 listing capacity is enforced by the
-- hold_booking_availability trigger (booking_capacity.test.sql), so the only
-- overlap constraint left is the per-pet backstop `bookings_no_confirmed_pet_overlap`:
-- one pet never has two overlapping confirmed stays, on any listings. This file
-- covers it the same way hasBookingConflict() is covered in the browser:
-- overlap, back-to-back, a different pet, and a non-confirmed booking. It also
-- proves the old listing-wide exclusion is gone.
--
-- Run locally after rebuilding the database:
--   npx supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/booking_rules.test.sql
--
-- Everything happens inside one transaction that is rolled back, so the database
-- is untouched afterwards. session_replication_role = replica disables the
-- app-level guard triggers and foreign-key checks so the test exercises the
-- database constraints directly rather than the triggers in front of them; CHECK and
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
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'Contract Pet', 'dog'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'Second Pet', 'dog');

insert into public.listings (id, owner_id, title, location, description, capacity, accepted_pet_types, status, published_at)
values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Contract Listing A', 'Test City', 'Fixture listing for contract tests.', 2, array['dog', 'cat']::public.pet_species[], 'published', now()),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Contract Listing B', 'Test City', 'Second fixture listing.', 1, array['dog']::public.pet_species[], 'published', now());

-- Anchor: Contract Pet confirmed on listing A for 1-5 Oct (end-exclusive).
insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002', 'confirmed', date '2026-10-01', date '2026-10-05');

-- The same pet confirmed on another listing for overlapping dates is refused.
do $$
begin
  insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
  values ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
          'a0000000-0000-4000-8000-000000000002', 'confirmed', date '2026-10-03', date '2026-10-08');
  raise exception 'REGRESSION: one pet was confirmed on two listings for overlapping dates';
exception
  when exclusion_violation then
    raise notice 'ok: overlapping confirmed stays for one pet rejected across listings';
end;
$$;

-- ...and on the same listing.
do $$
begin
  insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
  values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
          'a0000000-0000-4000-8000-000000000002', 'confirmed', date '2026-10-04', date '2026-10-06');
  raise exception 'REGRESSION: one pet was confirmed twice on one listing for overlapping dates';
exception
  when exclusion_violation then
    raise notice 'ok: overlapping confirmed stays for one pet rejected on one listing';
end;
$$;

-- Back-to-back: the pet may start a stay elsewhere on the day the anchor ends.
insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
values ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002', 'confirmed', date '2026-10-05', date '2026-10-09');
\echo 'ok: back-to-back confirmed stays for one pet allowed'

-- Non-confirmed bookings never block, even for the same pet (the constraint is
-- partial: WHERE status = 'confirmed').
insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
values
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'pending', date '2026-10-02', date '2026-10-06'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'cancelled', date '2026-10-02', date '2026-10-06'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'completed', date '2026-10-02', date '2026-10-06');
\echo 'ok: pending, cancelled and completed stays for the same pet allowed'

-- A different pet on the same listing and dates is no longer blocked by a
-- constraint: the listing-wide exclusion is gone, and capacity (2 here) is the
-- trigger's job.
insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
        'a0000000-0000-4000-8000-000000000002', 'confirmed', date '2026-10-01', date '2026-10-05');
\echo 'ok: a different pet on the same listing and dates is not blocked by a constraint'

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
