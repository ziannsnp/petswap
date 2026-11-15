-- Behavioural test for public.get_booking_detail() (20261115010000_add_booking_detail.sql,
-- ADR 0011 decision 7):
--
--   - the requester and the listing owner each get one row; nobody else gets any
--   - an anonymous caller is refused, and an unknown id looks the same as someone else's booking
--   - the peer is the *other* participant: display name, photo and location only, never phone or email
--   - the requester always sees their own pet, soft-deleted or not
--   - the host sees the pet only while the booking is pending, confirmed or completed
--   - history survives a deleted or unpublished listing
--
-- Seed users: Alex (...001) owns the fixture listings, Casey (...003) requests with her own pets,
-- Blair (...002) is a signed-in stranger. Everything is rolled back.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/booking_detail.test.sql

\set ON_ERROR_STOP on
\echo '== PetSwap booking detail =='

begin;

set local session_replication_role = replica;

insert into public.pets (id, owner_id, name, species, medical_note, feeding_instruction, deleted_at)
values
  ('20000000-0000-4000-8000-000000000701', '10000000-0000-4000-8000-000000000003', 'Detail dog', 'dog',
   'private medical note', 'two meals a day', null),
  ('20000000-0000-4000-8000-000000000702', '10000000-0000-4000-8000-000000000003', 'Retired cat', 'cat',
   'old medical note', null, now());

insert into public.listings (
  id, owner_id, title, location, description, capacity, accepted_pet_types, status, published_at, deleted_at
)
values
  ('30000000-0000-4000-8000-000000000701', '10000000-0000-4000-8000-000000000001',
   'Detail garden', 'Detail City', 'Published.', 2, array['dog','cat']::public.pet_species[], 'published', now(), null),
  ('30000000-0000-4000-8000-000000000702', '10000000-0000-4000-8000-000000000001',
   'Detail deleted', 'Detail City', 'Deleted.', 2, array['dog']::public.pet_species[], 'deleted', now(), now()),
  ('30000000-0000-4000-8000-000000000703', '10000000-0000-4000-8000-000000000001',
   'Detail draft', 'Detail City', 'Unpublished.', 2, array['dog']::public.pet_species[], 'draft', null, null);

-- All requested by Casey. Confirmed and completed stays of the same pet use distinct nights.
insert into public.bookings (id, listing_id, pet_id, requester_id, status, start_date, end_date, requester_note, owner_note)
values
  ('40000000-0000-4000-8000-000000000701', '30000000-0000-4000-8000-000000000701', '20000000-0000-4000-8000-000000000701',
   '10000000-0000-4000-8000-000000000003', 'pending',   '2027-03-01', '2027-03-04', 'Please keep him off the sofa.', null),
  ('40000000-0000-4000-8000-000000000702', '30000000-0000-4000-8000-000000000701', '20000000-0000-4000-8000-000000000701',
   '10000000-0000-4000-8000-000000000003', 'declined',  '2027-03-11', '2027-03-14', null, 'Sorry, fully booked.'),
  ('40000000-0000-4000-8000-000000000703', '30000000-0000-4000-8000-000000000701', '20000000-0000-4000-8000-000000000701',
   '10000000-0000-4000-8000-000000000003', 'cancelled', '2027-03-21', '2027-03-24', null, null),
  ('40000000-0000-4000-8000-000000000704', '30000000-0000-4000-8000-000000000701', '20000000-0000-4000-8000-000000000701',
   '10000000-0000-4000-8000-000000000003', 'confirmed', '2027-04-01', '2027-04-04', null, null),
  ('40000000-0000-4000-8000-000000000705', '30000000-0000-4000-8000-000000000702', '20000000-0000-4000-8000-000000000701',
   '10000000-0000-4000-8000-000000000003', 'completed', '2027-04-11', '2027-04-14', null, null),
  ('40000000-0000-4000-8000-000000000706', '30000000-0000-4000-8000-000000000703', '20000000-0000-4000-8000-000000000701',
   '10000000-0000-4000-8000-000000000003', 'completed', '2027-04-21', '2027-04-24', null, null),
  ('40000000-0000-4000-8000-000000000707', '30000000-0000-4000-8000-000000000701', '20000000-0000-4000-8000-000000000702',
   '10000000-0000-4000-8000-000000000003', 'completed', '2027-05-01', '2027-05-04', null, null);

set local session_replication_role = origin;

-- The function must not be able to return contact details at all.
do $$
declare
  shape text := pg_get_function_result('public.get_booking_detail(uuid)'::regprocedure);
begin
  if shape ~* '(phone|email)' then
    raise exception 'booking detail: the result shape mentions contact details: %', shape;
  end if;
end;
$$;
\echo 'ok: the result shape has no phone or email column'

-- Casey requested every booking.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  d record;
  n int;
begin
  select count(*) into n from public.get_booking_detail('40000000-0000-4000-8000-000000000701');
  if n <> 1 then raise exception 'booking detail: the requester got % rows for a pending booking', n; end if;

  -- A pet the requester owns stays visible in every status, care notes included.
  for d in
    select * from public.get_booking_detail('40000000-0000-4000-8000-000000000701')
    union all select * from public.get_booking_detail('40000000-0000-4000-8000-000000000702')
    union all select * from public.get_booking_detail('40000000-0000-4000-8000-000000000703')
  loop
    if d.viewer_role <> 'requester' or d.pet_name <> 'Detail dog' or d.pet_medical_note <> 'private medical note' then
      raise exception 'booking detail: the requester lost their own pet on a % booking', d.status;
    end if;
    if d.peer_id <> '10000000-0000-4000-8000-000000000001' or d.peer_display_name <> 'Alex Rivera'
       or d.peer_location <> 'Chiang Mai' then
      raise exception 'booking detail: the requester did not get the host as peer on a % booking', d.status;
    end if;
  end loop;

  select * into d from public.get_booking_detail('40000000-0000-4000-8000-000000000701');
  if d.requester_note <> 'Please keep him off the sofa.' or d.listing_title <> 'Detail garden'
     or d.start_date <> '2027-03-01' or d.end_date <> '2027-03-04' then
    raise exception 'booking detail: the pending booking lost its notes, listing or dates';
  end if;

  select * into d from public.get_booking_detail('40000000-0000-4000-8000-000000000702');
  if d.owner_note <> 'Sorry, fully booked.' then
    raise exception 'booking detail: the requester cannot read the host''s note';
  end if;

  -- History: deleted and unpublished listings, and a soft-deleted pet.
  select * into d from public.get_booking_detail('40000000-0000-4000-8000-000000000705');
  if d.listing_status <> 'deleted' or d.listing_title <> 'Detail deleted' then
    raise exception 'booking detail: a booking at a deleted listing lost its history';
  end if;

  select * into d from public.get_booking_detail('40000000-0000-4000-8000-000000000706');
  if d.listing_status <> 'draft' or d.listing_title <> 'Detail draft' then
    raise exception 'booking detail: a booking at an unpublished listing lost its history';
  end if;

  select * into d from public.get_booking_detail('40000000-0000-4000-8000-000000000707');
  if d.pet_name <> 'Retired cat' or d.pet_deleted is not true then
    raise exception 'booking detail: the requester lost a soft-deleted pet from their history';
  end if;

  -- No contact detail leaks through any column value.
  if exists (
    select 1 from public.get_booking_detail('40000000-0000-4000-8000-000000000701') as x
    where to_jsonb(x)::text ~ '(0800000001|0800000003|@petswap\.test)'
  ) then
    raise exception 'booking detail: a phone number or email appeared in the result';
  end if;
end;
$$;
\echo 'ok: the requester sees the booking, their pet, the host, and history'

reset role;

-- Alex owns the listings.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  d record;
begin
  -- Pending, confirmed and completed: the host reads the pet and its care notes.
  for d in
    select * from public.get_booking_detail('40000000-0000-4000-8000-000000000701')
    union all select * from public.get_booking_detail('40000000-0000-4000-8000-000000000704')
    union all select * from public.get_booking_detail('40000000-0000-4000-8000-000000000705')
  loop
    if d.viewer_role <> 'owner' or d.pet_name <> 'Detail dog' or d.pet_medical_note <> 'private medical note'
       or d.pet_feeding_instruction <> 'two meals a day' then
      raise exception 'booking detail: the host cannot read the pet on a % booking', d.status;
    end if;
    if d.peer_id <> '10000000-0000-4000-8000-000000000003' or d.peer_display_name <> 'Casey Ito'
       or d.peer_location <> 'Nonthaburi' then
      raise exception 'booking detail: the host did not get the requester as peer on a % booking', d.status;
    end if;
  end loop;

  -- Declined and cancelled: the host keeps the booking but loses the pet.
  for d in
    select * from public.get_booking_detail('40000000-0000-4000-8000-000000000702')
    union all select * from public.get_booking_detail('40000000-0000-4000-8000-000000000703')
  loop
    if d.id is null then raise exception 'booking detail: the host lost a % booking', d.status; end if;
    if d.pet_id is not null or d.pet_name is not null or d.pet_medical_note is not null
       or d.pet_feeding_instruction is not null then
      raise exception 'booking detail: the host still sees the pet on a % booking', d.status;
    end if;
    if d.peer_display_name <> 'Casey Ito' then
      raise exception 'booking detail: the host lost the requester on a % booking', d.status;
    end if;
  end loop;

  -- Deleted and unpublished listings stay readable to their owner.
  if (select count(*) from public.get_booking_detail('40000000-0000-4000-8000-000000000705')) <> 1
     or (select count(*) from public.get_booking_detail('40000000-0000-4000-8000-000000000706')) <> 1 then
    raise exception 'booking detail: the host lost a booking at a deleted or unpublished listing';
  end if;

  if exists (
    select 1 from public.get_booking_detail('40000000-0000-4000-8000-000000000701') as x
    where to_jsonb(x)::text ~ '(0800000001|0800000003|@petswap\.test)'
  ) then
    raise exception 'booking detail: a phone number or email appeared in the host''s result';
  end if;
end;
$$;
\echo 'ok: the host sees the booking, the pet only while it is shared, the requester, and history'

reset role;

-- Blair is signed in but is neither the requester nor the owner.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  n int;
begin
  -- The last id matches no booking at all: it must look the same as someone else's booking.
  select count(*) into n
  from unnest(array[
    '40000000-0000-4000-8000-000000000701', '40000000-0000-4000-8000-000000000702',
    '40000000-0000-4000-8000-000000000703', '40000000-0000-4000-8000-000000000704',
    '40000000-0000-4000-8000-000000000705', '40000000-0000-4000-8000-000000000706',
    '40000000-0000-4000-8000-000000000707', '40000000-0000-4000-8000-0000000007ff'
  ]::uuid[]) as probe(id), lateral public.get_booking_detail(probe.id);
  if n <> 0 then
    raise exception 'booking detail: an unrelated signed-in user read % bookings', n;
  end if;
end;
$$;
\echo 'ok: an unrelated signed-in user, and an unknown id, get nothing'

reset role;

-- A signed-out caller has no execute right at all.
set local role anon;

do $$
begin
  perform * from public.get_booking_detail('40000000-0000-4000-8000-000000000701');
  raise exception 'booking detail: an anonymous caller could call get_booking_detail()';
exception
  when insufficient_privilege then null;
end;
$$;
\echo 'ok: an anonymous caller is refused'

reset role;

rollback;
