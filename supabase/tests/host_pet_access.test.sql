-- Behavioural test for which hosts may read a requester's pet and its photo
-- (20261114010000_limit_host_pet_access_to_active_bookings.sql):
--
--   - pending, confirmed, completed booking at the host's listing -> pet row and photo readable
--   - declined or cancelled booking only                           -> neither is readable
--
-- Seed users: Alex (...001) hosts listing ...001, Casey (...003) owns the fixture pets.
-- Everything happens inside one transaction that is rolled back.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/host_pet_access.test.sql

\set ON_ERROR_STOP on
\echo '== PetSwap host access to booked pets =='

begin;

set local session_replication_role = replica;

insert into public.pets (id, owner_id, name, species, medical_note, photo_url)
select
  ('20000000-0000-4000-8000-00000000060' || n)::uuid,
  '10000000-0000-4000-8000-000000000003',
  status || ' case', 'dog', 'private medical note',
  '20000000-0000-4000-8000-00000000060' || n || '/photo.jpg'
from (values (1, 'pending'), (2, 'confirmed'), (3, 'completed'), (4, 'declined'), (5, 'cancelled')) as c(n, status);

insert into public.bookings (id, listing_id, pet_id, requester_id, status, start_date, end_date)
select
  ('40000000-0000-4000-8000-00000000060' || n)::uuid,
  '30000000-0000-4000-8000-000000000001',
  ('20000000-0000-4000-8000-00000000060' || n)::uuid,
  '10000000-0000-4000-8000-000000000003',
  status::public.booking_status,
  date '2027-03-01' + n * 10, date '2027-03-04' + n * 10
from (values (1, 'pending'), (2, 'confirmed'), (3, 'completed'), (4, 'declined'), (5, 'cancelled')) as c(n, status);

insert into storage.objects (bucket_id, name, owner)
select 'pet-photos', '20000000-0000-4000-8000-00000000060' || n || '/photo.jpg',
       '10000000-0000-4000-8000-000000000003'
from generate_series(1, 5) as n;

set local session_replication_role = origin;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  c record;
  pet_visible boolean;
  photo_visible boolean;
begin
  for c in
    select * from (values
      (1, 'pending', true), (2, 'confirmed', true), (3, 'completed', true),
      (4, 'declined', false), (5, 'cancelled', false)
    ) as v(n, status, expected)
  loop
    select exists (
      select 1 from public.pets where id = ('20000000-0000-4000-8000-00000000060' || c.n)::uuid
    ) into pet_visible;

    select exists (
      select 1 from storage.objects
      where bucket_id = 'pet-photos' and name = '20000000-0000-4000-8000-00000000060' || c.n || '/photo.jpg'
    ) into photo_visible;

    if pet_visible <> c.expected then
      raise exception 'host pet access: % booking -> pet row visible = %, expected %', c.status, pet_visible, c.expected;
    end if;

    if photo_visible <> c.expected then
      raise exception 'host pet access: % booking -> pet photo visible = %, expected %', c.status, photo_visible, c.expected;
    end if;
  end loop;
end;
$$;
\echo 'ok: hosts read pets and photos only for pending, confirmed, or completed bookings'

rollback;
