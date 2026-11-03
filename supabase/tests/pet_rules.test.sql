-- Pet RLS and integrity contract tests:
-- "the owner can update and delete a pet; a non-owner, including a listing owner who can read a booked pet, cannot;
--  a pet with an active (pending or confirmed) booking cannot be deleted; a pet whose bookings are all
--  declined, cancelled, or completed is soft-deleted and can no longer be changed or booked"
--
-- Seed data reference:
--   Users:
--     Alex ('10000000-0000-4000-8000-000000000001') - hosts listings 1, 2, 4; owns pet Miso (...001, no bookings in seed)
--     Blair ('10000000-0000-4000-8000-000000000002') - hosts listings 3, 5; owns pet Pixel (...003)
--     Casey ('10000000-0000-4000-8000-000000000003') - owns pet Rocket (...004, booked at Alex's listings 1 & 2, and Blair's listing 3)

\set ON_ERROR_STOP on

begin;

-- Fixtures for cases 10-13: one dog of Casey's per booking status, each holding exactly
-- that one booking at Alex's listing 1, so every status is judged on its own. Pending and
-- confirmed must block deletion; declined, cancelled, and completed must not. Triggers are
-- off for the load so each booking can be seeded directly in its final status.
set local session_replication_role = replica;

insert into public.pets (id, owner_id, name, species, photo_url)
values
  ('20000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000003', 'Pending case',   'dog', null),
  ('20000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000003', 'Confirmed case', 'dog', null),
  ('20000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000003', 'Declined case',  'dog', null),
  ('20000000-0000-4000-8000-000000000104', '10000000-0000-4000-8000-000000000003', 'Cancelled case', 'dog',
   '20000000-0000-4000-8000-000000000104/photo.jpg'),
  ('20000000-0000-4000-8000-000000000105', '10000000-0000-4000-8000-000000000003', 'Completed case', 'dog', null);

insert into public.bookings (
  id, listing_id, pet_id, requester_id, status, start_date, end_date,
  confirmed_at, declined_at, cancelled_at, completed_at
)
values
  ('40000000-0000-4000-8000-000000000201', '30000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000003',
   'pending', date '2027-01-01', date '2027-01-04', null, null, null, null),
  ('40000000-0000-4000-8000-000000000202', '30000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000003',
   'confirmed', date '2027-01-01', date '2027-01-04', now(), null, null, null),
  ('40000000-0000-4000-8000-000000000203', '30000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000003',
   'declined', date '2027-01-01', date '2027-01-04', null, now(), null, null),
  ('40000000-0000-4000-8000-000000000204', '30000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000104', '10000000-0000-4000-8000-000000000003',
   'cancelled', date '2027-01-01', date '2027-01-04', null, null, now(), null),
  ('40000000-0000-4000-8000-000000000205', '30000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000105', '10000000-0000-4000-8000-000000000003',
   'completed', date '2026-09-01', date '2026-09-05', now(), null, null, now());
set local session_replication_role = origin;

-- ---------------------------------------------------------------------------
-- 1. Owner can update their own pet
-- Alex updates Miso (...001)
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  changed_rows integer;
  updated_pet record;
begin
  update public.pets
  set
    name = 'Miso Supercat',
    species = 'cat'::public.pet_species,
    breed = 'Domestic Longhair',
    age_year = 4,
    description = 'Updated description for Miso.'
  where id = '20000000-0000-4000-8000-000000000001';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'pet update: owner update changed % rows instead of 1', changed_rows;
  end if;

  select name, breed, age_year, description into updated_pet
  from public.pets
  where id = '20000000-0000-4000-8000-000000000001';

  if updated_pet.name is distinct from 'Miso Supercat'
    or updated_pet.breed is distinct from 'Domestic Longhair'
    or updated_pet.age_year is distinct from 4
    or updated_pet.description is distinct from 'Updated description for Miso.' then
    raise exception 'pet update: fields did not update to expected values';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Owner can delete their own pet (when unbooked)
-- Alex inserts a dedicated unbooked pet and deletes it
-- ---------------------------------------------------------------------------
insert into public.pets (id, owner_id, name, species, breed, age_year, description)
values (
  '20000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000001',
  'Temporary Pet',
  'cat',
  'Siamese',
  1,
  'Unbooked pet to test owner deletion.'
);

do $$
declare
  changed_rows integer;
begin
  delete from public.pets
  where id = '20000000-0000-4000-8000-000000000099';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'pet deletion: owner delete changed % rows instead of 1', changed_rows;
  end if;

  if exists (
    select 1 from public.pets
    where id = '20000000-0000-4000-8000-000000000099'
  ) then
    raise exception 'pet deletion: pet still exists after owner deletion';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Non-owner cannot update another user's pet
-- Blair (...002) attempts to update Alex's pet Miso (...001)
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  changed_rows integer;
begin
  update public.pets
  set name = 'Blair Hijacked Miso'
  where id = '20000000-0000-4000-8000-000000000001';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'pet update: non-owner updated another user pet (changed % rows, expected 0)', changed_rows;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Non-owner cannot delete another user's pet
-- Blair (...002) attempts to delete Alex's pet Miso (...001)
-- ---------------------------------------------------------------------------
do $$
declare
  changed_rows integer;
begin
  delete from public.pets
  where id = '20000000-0000-4000-8000-000000000001';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'pet delete: non-owner deleted another user pet (changed % rows, expected 0)', changed_rows;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Listing host who can read a booked pet CANNOT update that pet
-- Alex hosts listings 1 & 2 where Casey's pet Rocket (...004) has bookings.
-- Alex can read Rocket under RLS policy, but cannot mutate Rocket.
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

-- Confirm Alex CAN read Rocket via the booking policy
do $$
begin
  if not exists (
    select 1 from public.pets
    where id = '20000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'pet access: listing host Alex was unable to read booked pet Rocket';
  end if;
end;
$$;

-- Host attempts to UPDATE Rocket
do $$
declare
  changed_rows integer;
begin
  update public.pets
  set name = 'Alex Hijacked Rocket'
  where id = '20000000-0000-4000-8000-000000000004';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'pet update: listing host updated a booked pet (changed % rows, expected 0)', changed_rows;
  end if;

  if (select name from public.pets where id = '20000000-0000-4000-8000-000000000004') is distinct from 'Rocket' then
    raise exception 'pet update: booked pet name changed by listing host';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Listing host who can read a booked pet CANNOT delete that pet
-- Alex attempts to DELETE Rocket (...004)
-- ---------------------------------------------------------------------------
do $$
declare
  changed_rows integer;
begin
  delete from public.pets
  where id = '20000000-0000-4000-8000-000000000004';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'pet delete: listing host deleted a booked pet (changed % rows, expected 0)', changed_rows;
  end if;

  if not exists (
    select 1 from public.pets
    where id = '20000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'pet delete: booked pet was deleted by listing host';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. A pet with a booking cannot be hard-deleted (even by its owner)
-- Casey (...003) owns Rocket (...004), which has bookings in public.bookings.
-- Foreign key constraint bookings_pet_id_fkey (ON DELETE RESTRICT) must reject deletion.
--
-- Note: any booking row, whatever its status, blocks a hard delete, so booking history
-- keeps its pet. Owners delete such a pet through delete_pet_with_active_booking_check(),
-- which soft-deletes it when no booking is active (cases 10-13).
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  violated_constraint text;
begin
  begin
    delete from public.pets
    where id = '20000000-0000-4000-8000-000000000004';
    raise exception 'pet deletion: booked pet delete succeeded, expected foreign key violation';
  exception
    when foreign_key_violation then
      get stacked diagnostics violated_constraint = constraint_name;
  end;

  if violated_constraint is distinct from 'bookings_pet_id_fkey' then
    raise exception 'pet deletion: booked pet delete failed unexpected constraint %', violated_constraint;
  end if;

  if not exists (
    select 1 from public.pets
    where id = '20000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'pet deletion: booked pet was removed despite constraint error';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Anonymous visitor cannot update or delete any pet
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
set local role anon;

do $$
declare
  changed_rows integer;
begin
  update public.pets
  set name = 'Anonymous Hijack'
  where id = '20000000-0000-4000-8000-000000000001';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'pet update: anonymous user updated a pet (changed % rows, expected 0)', changed_rows;
  end if;

  delete from public.pets
  where id = '20000000-0000-4000-8000-000000000001';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'pet delete: anonymous user deleted a pet (changed % rows, expected 0)', changed_rows;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Owner cannot reassign owner_id to another user
-- Alex (...001) tries to transfer Miso (...001) to Blair (...002).
-- RLS with check (owner_id = auth.uid()) must reject the update.
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  rejected boolean := false;
  changed_rows integer;
begin
  begin
    update public.pets
    set owner_id = '10000000-0000-4000-8000-000000000002'
    where id = '20000000-0000-4000-8000-000000000001';

    get diagnostics changed_rows = row_count;
    if changed_rows = 0 then
      rejected := true;
    end if;
  exception
    when insufficient_privilege then
      rejected := true;
  end;

  if not rejected then
    raise exception 'pet update: owner reassigned pet owner_id to another user';
  end if;

  if (
    select owner_id
    from public.pets
    where id = '20000000-0000-4000-8000-000000000001'
  ) is distinct from '10000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'pet update: pet owner_id changed unexpectedly';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Only active bookings block deletion through the RPC
-- Casey deletes each fixture pet. Pending and confirmed are refused and the pet is
-- untouched; declined, cancelled, and completed soft-delete it, clear photo_url, and
-- return the old photo path so the app can remove the file.
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  booking_case record;
  error_message text;
  returned_photo text;
  final_pet record;
begin
  for booking_case in
    select *
    from (values
      ('pending', '20000000-0000-4000-8000-000000000101'::uuid, true, null::text),
      ('confirmed', '20000000-0000-4000-8000-000000000102'::uuid, true, null),
      ('declined', '20000000-0000-4000-8000-000000000103'::uuid, false, null),
      ('cancelled', '20000000-0000-4000-8000-000000000104'::uuid, false,
       '20000000-0000-4000-8000-000000000104/photo.jpg'),
      ('completed', '20000000-0000-4000-8000-000000000105'::uuid, false, null)
    ) as cases(booking_status, pet_id, blocks_deletion, photo_url)
  loop
    error_message := null;
    returned_photo := null;
    begin
      returned_photo := public.delete_pet_with_active_booking_check(booking_case.pet_id);
    exception
      when raise_exception then
        get stacked diagnostics error_message = message_text;
    end;

    select deleted_at, photo_url into final_pet from public.pets where id = booking_case.pet_id;

    if booking_case.blocks_deletion and (
      error_message is distinct from 'Pet has active bookings and cannot be deleted.'
      or final_pet.deleted_at is not null
    ) then
      raise exception 'pet deletion: a % booking did not block deletion', booking_case.booking_status;
    end if;

    if not booking_case.blocks_deletion and (
      error_message is not null
      or final_pet.deleted_at is null
      or final_pet.photo_url is not null
      or returned_photo is distinct from booking_case.photo_url
    ) then
      raise exception 'pet deletion: a % booking blocked or broke deletion (%)',
        booking_case.booking_status, coalesce(error_message, 'no error');
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. The RPC refuses a deleted pet, someone else's pet, a missing pet, and anon
-- ---------------------------------------------------------------------------
do $$
declare
  error_message text;
begin
  begin
    perform public.delete_pet_with_active_booking_check('20000000-0000-4000-8000-000000000104');
  exception
    when raise_exception then
      get stacked diagnostics error_message = message_text;
  end;

  if error_message is distinct from 'Pet is already deleted.' then
    raise exception 'pet deletion: deleting an already-deleted pet was not refused';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  rejected boolean;
  target uuid;
begin
  -- Someone else's pet and a missing id get the same answer, so a refusal never
  -- confirms that a pet exists.
  foreach target in array array[
    '20000000-0000-4000-8000-000000000103'::uuid,
    '20000000-0000-4000-8000-000000000199'::uuid
  ]
  loop
    rejected := false;
    begin
      perform public.delete_pet_with_active_booking_check(target);
    exception
      when insufficient_privilege then rejected := true;
    end;

    if not rejected then
      raise exception 'pet deletion: a non-owner deleting pet % was not refused', target;
    end if;
  end loop;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.delete_pet_with_active_booking_check('20000000-0000-4000-8000-000000000001');
  exception
    when insufficient_privilege then rejected := true;
  end;

  if not rejected then
    raise exception 'pet deletion: an anonymous caller was not refused';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. A deleted pet stays readable for booking history but cannot be changed,
-- and direct updates cannot soft-delete or restore a pet
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  changed_rows integer;
  rejected boolean := false;
begin
  if not exists (select 1 from public.pets where id = '20000000-0000-4000-8000-000000000104') then
    raise exception 'pet deletion: the owner can no longer read a deleted pet';
  end if;

  update public.pets
  set name = 'Renamed after delete'
  where id = '20000000-0000-4000-8000-000000000104';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'pet deletion: the owner edited a deleted pet';
  end if;

  update public.pets
  set deleted_at = null
  where id = '20000000-0000-4000-8000-000000000104';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'pet deletion: the owner restored a deleted pet with a direct update';
  end if;

  -- Setting deleted_at directly would skip the active-booking check.
  begin
    update public.pets
    set deleted_at = now()
    where id = '20000000-0000-4000-8000-000000000101';
  exception
    when insufficient_privilege then rejected := true;
  end;

  if not rejected
    or (select deleted_at from public.pets where id = '20000000-0000-4000-8000-000000000101') is not null then
    raise exception 'pet deletion: a direct update soft-deleted a pet with an active booking';
  end if;
end;
$$;

-- Alex hosted the cancelled booking, so Alex can still read the deleted pet.
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  if not exists (select 1 from public.pets where id = '20000000-0000-4000-8000-000000000104') then
    raise exception 'pet deletion: the host of a past booking can no longer read the deleted pet';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. A deleted pet cannot be booked; an active pet still can
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  error_message text;
begin
  begin
    insert into public.bookings (listing_id, pet_id, requester_id, start_date, end_date)
    values (
      '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000104',
      '10000000-0000-4000-8000-000000000003', date '2027-02-01', date '2027-02-04'
    );
  exception
    when raise_exception then
      get stacked diagnostics error_message = message_text;
  end;

  if error_message is distinct from 'booking pet has been deleted' then
    raise exception 'pet deletion: a booking for a deleted pet was not refused (%)', coalesce(error_message, 'inserted');
  end if;

  insert into public.bookings (listing_id, pet_id, requester_id, start_date, end_date)
  values (
    '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000101',
    '10000000-0000-4000-8000-000000000003', date '2027-02-01', date '2027-02-04'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. The owner can still remove a deleted pet's photo file (the app does this
-- right after the RPC), and a pet cannot be created already deleted
-- ---------------------------------------------------------------------------
reset role;
-- Storage blocks SQL deletes unless this is set, as in pet_photo_access.test.sql; the
-- storage RLS policies still apply to the delete below.
set local storage.allow_delete_query = 'true';
insert into storage.objects (id, bucket_id, name)
values (
  '50000000-0000-4000-8000-000000000101',
  'pet-photos',
  '20000000-0000-4000-8000-000000000104/photo.jpg'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  deleted_rows integer;
  rejected boolean := false;
begin
  delete from storage.objects
  where bucket_id = 'pet-photos'
    and name = '20000000-0000-4000-8000-000000000104/photo.jpg';

  get diagnostics deleted_rows = row_count;
  if deleted_rows <> 1 then
    raise exception 'pet deletion: the owner could not remove a deleted pet photo (deleted % rows, expected 1)', deleted_rows;
  end if;

  begin
    insert into public.pets (owner_id, name, species, deleted_at)
    values ('10000000-0000-4000-8000-000000000003', 'Born deleted', 'dog', now());
  exception
    when insufficient_privilege then rejected := true;
  end;

  if not rejected then
    raise exception 'pet deletion: a pet was created already deleted';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. Booking someone else's deleted pet gets the ownership error, so the
-- response never says whether another user's pet was deleted
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  error_message text;
begin
  begin
    insert into public.bookings (listing_id, pet_id, requester_id, start_date, end_date)
    values (
      '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000104',
      '10000000-0000-4000-8000-000000000002', date '2027-03-01', date '2027-03-04'
    );
  exception
    when raise_exception then
      get stacked diagnostics error_message = message_text;
  end;

  if error_message is distinct from 'booking pet must belong to requester' then
    raise exception 'pet deletion: booking another user''s deleted pet said "%"', coalesce(error_message, 'inserted');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 16. A file left in a deleted pet's photo folder (a failed cleanup) stays
-- private: the past host cannot read it, and the owner cannot add or replace
-- files there. The owner can still read it, which Storage needs to remove it.
-- ---------------------------------------------------------------------------
reset role;
insert into storage.objects (id, bucket_id, name)
values (
  '50000000-0000-4000-8000-000000000102',
  'pet-photos',
  '20000000-0000-4000-8000-000000000104/leftover.jpg'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  if exists (
    select 1 from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000104/leftover.jpg'
  ) then
    raise exception 'pet deletion: the past host can still read a deleted pet photo';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  changed_rows integer;
  rejected boolean := false;
begin
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000104/leftover.jpg'
  ) then
    raise exception 'pet deletion: the owner can no longer read a deleted pet photo, so it cannot be removed';
  end if;

  update storage.objects
  set metadata = '{"replaced": true}'::jsonb
  where bucket_id = 'pet-photos'
    and name = '20000000-0000-4000-8000-000000000104/leftover.jpg';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'pet deletion: the owner replaced a deleted pet photo';
  end if;

  begin
    insert into storage.objects (bucket_id, name)
    values ('pet-photos', '20000000-0000-4000-8000-000000000104/new.jpg');
  exception
    when insufficient_privilege then rejected := true;
  end;

  if not rejected then
    raise exception 'pet deletion: the owner uploaded a photo for a deleted pet';
  end if;
end;
$$;

rollback;
