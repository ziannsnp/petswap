-- Behavioural test for the rules added in 20261114000000_tighten_booking_transitions.sql:
--
--   - a booking's pet must be a species the listing accepts
--   - the same pet cannot have two identical pending requests
--   - a pending request cannot be confirmed once its start date has passed (it can be declined)
--   - a confirmed stay cannot be cancelled from its check-out day on (end-exclusive)
--
-- Seed users: Alex (...001) owns the fixture listings, Casey (...003) owns Rocket (...004, a dog).
-- Dates are relative to current_date so the cases never go stale. Everything is rolled back.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/booking_transition_rules.test.sql

\set ON_ERROR_STOP on
\echo '== PetSwap booking transition rules =='

begin;

set local session_replication_role = replica;

insert into public.listings (
  id, owner_id, title, location, description, capacity, accepted_pet_types, status, published_at
)
values
  ('30000000-0000-4000-8000-000000000501', '10000000-0000-4000-8000-000000000001',
   'Cats only', 'Test City', 'Accepts cats only.', 2, array['cat']::public.pet_species[], 'published', now()),
  ('30000000-0000-4000-8000-000000000502', '10000000-0000-4000-8000-000000000001',
   'Dogs welcome', 'Test City', 'Accepts dogs.', 2, array['dog']::public.pet_species[], 'published', now());

insert into public.bookings (id, listing_id, pet_id, requester_id, status, start_date, end_date, confirmed_at)
values
  -- pending, start date has passed: may be declined, not confirmed
  ('40000000-0000-4000-8000-000000000501', '30000000-0000-4000-8000-000000000502',
   '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'pending', current_date - 3, current_date + 2, null),
  -- pending, starts today: may still be confirmed
  ('40000000-0000-4000-8000-000000000502', '30000000-0000-4000-8000-000000000502',
   '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'pending', current_date, current_date + 1, null),
  -- confirmed, checks out today: may not be cancelled
  ('40000000-0000-4000-8000-000000000503', '30000000-0000-4000-8000-000000000502',
   '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'confirmed', current_date - 4, current_date, now()),
  -- confirmed, checks out tomorrow: may still be cancelled
  ('40000000-0000-4000-8000-000000000504', '30000000-0000-4000-8000-000000000502',
   '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'confirmed', current_date + 20, current_date + 22, now());

set local session_replication_role = origin;

-- Casey requests.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.bookings (listing_id, pet_id, requester_id, start_date, end_date)
    values ('30000000-0000-4000-8000-000000000501', '20000000-0000-4000-8000-000000000004',
            '10000000-0000-4000-8000-000000000003', current_date + 40, current_date + 42);
    raise exception 'booking transition rules: a dog was booked at a cats-only listing';
  exception when raise_exception then
    if sqlerrm not like '%species is not accepted%' then raise; end if;
  end;

  insert into public.bookings (listing_id, pet_id, requester_id, start_date, end_date)
  values ('30000000-0000-4000-8000-000000000502', '20000000-0000-4000-8000-000000000004',
          '10000000-0000-4000-8000-000000000003', current_date + 50, current_date + 52);

  begin
    insert into public.bookings (listing_id, pet_id, requester_id, start_date, end_date)
    values ('30000000-0000-4000-8000-000000000502', '20000000-0000-4000-8000-000000000004',
            '10000000-0000-4000-8000-000000000003', current_date + 50, current_date + 52);
    raise exception 'booking transition rules: an identical pending request was stored twice';
  exception when raise_exception then
    if sqlerrm not like '%identical booking request%' then raise; end if;
  end;

  -- Different dates for the same pet and listing are still a separate request.
  insert into public.bookings (listing_id, pet_id, requester_id, start_date, end_date)
  values ('30000000-0000-4000-8000-000000000502', '20000000-0000-4000-8000-000000000004',
          '10000000-0000-4000-8000-000000000003', current_date + 53, current_date + 55);

  begin
    update public.bookings set status = 'cancelled' where id = '40000000-0000-4000-8000-000000000503';
    raise exception 'booking transition rules: a stay that ended today was cancelled';
  exception when raise_exception then
    if sqlerrm not like '%stay that has ended%' then raise; end if;
  end;

  update public.bookings set status = 'cancelled' where id = '40000000-0000-4000-8000-000000000504';
  if (select status from public.bookings where id = '40000000-0000-4000-8000-000000000504') <> 'cancelled' then
    raise exception 'booking transition rules: a future confirmed stay could not be cancelled';
  end if;
end;
$$;
\echo 'ok: species, duplicate requests, and late cancellation are enforced'

reset role;

-- Alex hosts.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  begin
    update public.bookings set status = 'confirmed' where id = '40000000-0000-4000-8000-000000000501';
    raise exception 'booking transition rules: a request past its start date was confirmed';
  exception when raise_exception then
    if sqlerrm not like '%start date has passed%' then raise; end if;
  end;

  update public.bookings set status = 'declined' where id = '40000000-0000-4000-8000-000000000501';
  if (select status from public.bookings where id = '40000000-0000-4000-8000-000000000501') <> 'declined' then
    raise exception 'booking transition rules: an expired request could not be declined';
  end if;

  update public.bookings set status = 'confirmed' where id = '40000000-0000-4000-8000-000000000502';
  if (select status from public.bookings where id = '40000000-0000-4000-8000-000000000502') <> 'confirmed' then
    raise exception 'booking transition rules: a request starting today could not be confirmed';
  end if;
end;
$$;
\echo 'ok: expired requests can be declined but not confirmed'

rollback;
