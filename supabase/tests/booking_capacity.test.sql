\set ON_ERROR_STOP on
\echo '== PetSwap booking capacity and pet availability =='
begin;

create function pg_temp.assert_true(passed boolean, message text) returns void
language plpgsql as $$
begin
  if passed is distinct from true then raise exception '%', message; end if;
end;
$$;

create function pg_temp.confirm_conflict(booking_id uuid, expected_code text) returns void
language plpgsql as $$
declare code text; detail text;
begin
  begin
    update public.bookings set status = 'confirmed' where id = booking_id;
  exception when others then
    get stacked diagnostics code = returned_sqlstate, detail = pg_exception_detail;
  end;
  perform pg_temp.assert_true(code = expected_code, 'Wrong or missing conflict: ' || coalesce(code, 'none'));
  perform pg_temp.assert_true(coalesce(detail, '') = '', 'Conflict exposed private booking details');
  perform pg_temp.assert_true((select status = 'pending' from public.bookings where id = booking_id), 'Rejected booking did not remain Pending');
end;
$$;

-- Only fixture loading skips triggers. Actions use real JWTs, RLS and guards.
set local session_replication_role = replica;
insert into public.pets (id, owner_id, name, species)
select ('62000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  '10000000-0000-4000-8000-000000000003', 'Capacity pet ' || n, 'dog'
from generate_series(1,8) n;
insert into public.listings (id, owner_id, title, location, description, capacity, accepted_pet_types, status)
select ('61000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  case when n=3 then '10000000-0000-4000-8000-000000000002'::uuid
       else '10000000-0000-4000-8000-000000000001'::uuid end,
  'Capacity listing ' || n, 'Test City', 'Capacity fixture',
  case when n=5 then 1 else 2 end, array['dog']::public.pet_species[], 'published'
from generate_series(1,5) n;
insert into public.bookings (id,listing_id,pet_id,requester_id,status,start_date,end_date)
select ('63000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  ('61000000-0000-4000-8000-' || lpad(listing::text,12,'0'))::uuid,
  ('62000000-0000-4000-8000-' || lpad(pet::text,12,'0'))::uuid,
  '10000000-0000-4000-8000-000000000003', 'pending', current_date+arrival, current_date+departure
from (values
  (1,1,1,30,32),(2,1,2,32,34),(3,1,3,30,34),(4,1,4,31,33),
  (5,2,1,31,33),(6,2,1,32,34),(7,2,7,30,34),(8,3,8,30,34),
  (9,1,8,30,34),(10,5,5,40,44),(11,5,6,40,44)
) fixture(n,listing,pet,arrival,departure);
insert into public.bookings (listing_id,pet_id,requester_id,status,start_date,end_date)
select '61000000-0000-4000-8000-000000000004',
  ('62000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  '10000000-0000-4000-8000-000000000003','confirmed',current_date-60,current_date-58
from generate_series(1,2) n;
insert into public.bookings (listing_id,pet_id,requester_id,status,start_date,end_date)
select '61000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000007',
  '10000000-0000-4000-8000-000000000003',state::public.booking_status,current_date+30,current_date+34
from unnest(array['pending','declined','cancelled','completed']) state;
set local session_replication_role = origin;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
-- A [30,32), B [32,34), C [30,34): three overlapping stays, peak only two.
update public.bookings set status='confirmed'
where id in ('63000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000002','63000000-0000-4000-8000-000000000003');
select pg_temp.assert_true((select count(*)=3 from public.bookings where listing_id='61000000-0000-4000-8000-000000000001' and status='confirmed'),'Disjoint portions were summed as simultaneous');
select pg_temp.confirm_conflict('63000000-0000-4000-8000-000000000004','PBC01');
select pg_temp.confirm_conflict('63000000-0000-4000-8000-000000000005','PBP01');
update public.bookings set status='confirmed' where id='63000000-0000-4000-8000-000000000006';
select pg_temp.assert_true((select status='confirmed' from public.bookings where id='63000000-0000-4000-8000-000000000006'),'Back-to-back pet stay was blocked');

do $$
begin
  begin
    update public.listings set capacity=1 where id='61000000-0000-4000-8000-000000000001';
    raise exception 'Capacity reduction below peak was allowed';
  exception when sqlstate 'PBC01' then null;
  end;
  begin
    update public.bookings set status='confirmed' where listing_id='61000000-0000-4000-8000-000000000005';
    raise exception 'Multi-row confirmation exceeded capacity';
  exception when sqlstate 'PBC01' then null;
  end;
end;
$$;
select pg_temp.assert_true((select capacity=2 from public.listings where id='61000000-0000-4000-8000-000000000001'),'Rejected reduction changed capacity');
select pg_temp.assert_true((select count(*)=2 from public.bookings where listing_id='61000000-0000-4000-8000-000000000005' and status='pending'),'Multi-row confirmation was not atomic');
update public.listings set capacity=3 where id='61000000-0000-4000-8000-000000000001';
update public.listings set capacity=2 where id='61000000-0000-4000-8000-000000000001';
update public.listings set capacity=1 where id='61000000-0000-4000-8000-000000000004';
-- Alex cannot see or confirm the booking at Blair's listing.
update public.bookings set status='confirmed' where id='63000000-0000-4000-8000-000000000008';
select pg_temp.assert_true(not exists(select 1 from public.bookings where id='63000000-0000-4000-8000-000000000008'),'Unrelated booking was exposed');

reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$
begin
  begin
    update public.bookings set status='confirmed' where id='63000000-0000-4000-8000-000000000009';
  exception when insufficient_privilege or raise_exception then null;
  end;
end;
$$;
select pg_temp.assert_true((select status='pending' from public.bookings where id='63000000-0000-4000-8000-000000000009'),'Requester confirmed its own booking');
update public.bookings set status='cancelled'
where id in ('63000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000003','63000000-0000-4000-8000-000000000006');
do $$
begin
  begin
    perform public.confirmed_booking_peak('61000000-0000-4000-8000-000000000001',current_date,current_date+90);
    raise exception 'Private helper was exposed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update public.bookings set status='confirmed'
where id in ('63000000-0000-4000-8000-000000000004','63000000-0000-4000-8000-000000000005','63000000-0000-4000-8000-000000000007');
select pg_temp.assert_true((select count(*)=3 from public.bookings where id in ('63000000-0000-4000-8000-000000000004','63000000-0000-4000-8000-000000000005','63000000-0000-4000-8000-000000000007') and status='confirmed'),'Cancellation or non-confirmed states blocked confirmation');
rollback;
\echo '== capacity and pet availability: all checks passed =='
