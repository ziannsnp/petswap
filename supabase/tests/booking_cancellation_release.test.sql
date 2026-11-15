-- Regression: cancelling a Confirmed booking gives back what it held.
--
-- A confirmed stay holds one place on its listing and holds its pet for its dates.
-- When the requester cancels it, both must be released, so a pending request that
-- was refused only because of that stay can now be confirmed. Each case first
-- proves the request is refused for that one reason, so the later confirmation can
-- only succeed because the cancellation released it:
--
--   - capacity: a one-place listing is full; cancelling its confirmed stay lets a
--     different pet's overlapping request be confirmed, and the listing is full again
--   - pet: a pet is confirmed at another host; cancelling that stay lets the same
--     pet's overlapping request be confirmed here
--
-- Seed users: Alex (...001) owns the fixture listing, Blair (...002) hosts the other
-- listing, and Casey (...003) owns every fixture pet and requests every booking.
-- Dates are relative to current_date so the cases never go stale.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/booking_cancellation_release.test.sql
--
-- Everything happens inside one transaction that is rolled back.

\set ON_ERROR_STOP on
\echo '== PetSwap cancellation releases capacity and pet availability =='

begin;

create function pg_temp.assert_true(passed boolean, message text) returns void
language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'cancellation release: %', message; end if;
end;
$$;

-- Try to confirm as the signed-in actor; it must be refused with expected_code and
-- the booking must still be Pending afterwards.
create function pg_temp.confirm_refused(booking_id uuid, expected_code text) returns void
language plpgsql as $$
declare
  code text;
begin
  begin
    update public.bookings set status = 'confirmed' where id = booking_id;
  exception when others then
    get stacked diagnostics code = returned_sqlstate;
  end;
  perform pg_temp.assert_true(code = expected_code,
    format('confirming %s raised %s, expected %s', booking_id, coalesce(code, 'nothing'), expected_code));
  perform pg_temp.assert_true(
    (select status = 'pending' from public.bookings where id = booking_id),
    format('refused booking %s did not stay Pending', booking_id));
end;
$$;

create function pg_temp.status_of(booking_id uuid) returns public.booking_status
language sql as $$ select status from public.bookings where id = booking_id $$;

-- Fixtures. Triggers are off for the load only, so each booking can start in its
-- final status; every action below runs with the guards and RLS on.
set local session_replication_role = replica;

insert into public.pets (id, owner_id, name, species)
select ('81000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       '10000000-0000-4000-8000-000000000003', 'Release pet ' || n, 'dog'
from generate_series(1, 4) n;

insert into public.listings (
  id, owner_id, title, location, description, capacity, accepted_pet_types,
  status, published_at
)
values
  ('82000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'Release: one place', 'Test City', 'Holds one pet at a time.',
   1, array['dog']::public.pet_species[], 'published', now()),
  ('82000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   'Release: other host', 'Test City', 'Has room to spare.',
   2, array['dog']::public.pet_species[], 'published', now());

insert into public.bookings (
  id, listing_id, pet_id, requester_id, status, start_date, end_date, confirmed_at
)
select b.id, b.listing_id, b.pet_id, '10000000-0000-4000-8000-000000000003', b.status,
       current_date + b.start_offset, current_date + b.end_offset,
       case when b.status = 'confirmed' then now() end
from (values
  -- Capacity case, at Alex's one-place listing.
  ('83000000-0000-4000-8000-000000000001'::uuid, '82000000-0000-4000-8000-000000000001'::uuid,
   '81000000-0000-4000-8000-000000000001'::uuid, 'confirmed'::public.booking_status, 30, 34), -- fills the only place
  ('83000000-0000-4000-8000-000000000002'::uuid, '82000000-0000-4000-8000-000000000001'::uuid,
   '81000000-0000-4000-8000-000000000002'::uuid, 'pending'::public.booking_status,   31, 33), -- different pet, inside that stay
  ('83000000-0000-4000-8000-000000000003'::uuid, '82000000-0000-4000-8000-000000000001'::uuid,
   '81000000-0000-4000-8000-000000000003'::uuid, 'pending'::public.booking_status,   32, 34), -- a third pet, for after the release
  -- Pet case: pet 4 is confirmed at Blair's listing and requested at Alex's.
  ('83000000-0000-4000-8000-000000000004'::uuid, '82000000-0000-4000-8000-000000000002'::uuid,
   '81000000-0000-4000-8000-000000000004'::uuid, 'confirmed'::public.booking_status, 50, 54), -- holds pet 4
  ('83000000-0000-4000-8000-000000000005'::uuid, '82000000-0000-4000-8000-000000000001'::uuid,
   '81000000-0000-4000-8000-000000000004'::uuid, 'pending'::public.booking_status,   52, 56)  -- same pet, overlapping
) as b(id, listing_id, pet_id, status, start_offset, end_offset);

set local session_replication_role = origin;

-- Alex, the listing owner: both requests are refused while the confirmed stays hold.
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.confirm_refused('83000000-0000-4000-8000-000000000002', 'PBC01');
select pg_temp.confirm_refused('83000000-0000-4000-8000-000000000005', 'PBP01');
\echo 'ok: while the confirmed stays hold, the full listing and the booked pet refuse confirmation'

-- Casey, the requester, cancels both confirmed stays.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

update public.bookings set status = 'cancelled'
where id in ('83000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000004');

select pg_temp.assert_true(
  (select count(*) = 2 from public.bookings
   where id in ('83000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000004')
     and status = 'cancelled' and cancelled_at is not null),
  'the requester could not cancel both confirmed stays');
\echo 'ok: the requester cancels both confirmed stays'

-- Alex again: the same requests now confirm.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

update public.bookings set status = 'confirmed' where id = '83000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(
  pg_temp.status_of('83000000-0000-4000-8000-000000000002') = 'confirmed',
  'cancelling the confirmed stay did not release its place on the listing');
\echo 'ok: cancelling a confirmed stay releases its place for another pet'

update public.bookings set status = 'confirmed' where id = '83000000-0000-4000-8000-000000000005';
select pg_temp.assert_true(
  pg_temp.status_of('83000000-0000-4000-8000-000000000005') = 'confirmed',
  'cancelling the confirmed stay did not release its pet for those dates');
\echo 'ok: cancelling a confirmed stay releases its pet for another listing'

-- The release gave back exactly one place: with the new stay confirmed the listing is
-- full again, so a third overlapping pet is refused.
select pg_temp.confirm_refused('83000000-0000-4000-8000-000000000003', 'PBC01');
\echo 'ok: the released place is taken again by the newly confirmed stay'

reset role;
rollback;

\echo '== cancellation release: all checks passed =='
