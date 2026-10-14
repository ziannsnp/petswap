-- Pet RLS and integrity contract tests:
-- "the owner can update and delete a pet; a non-owner, including a listing owner who can read a booked pet, cannot; a pet with a booking cannot be deleted"
--
-- Seed data reference:
--   Users:
--     Alex ('10000000-0000-4000-8000-000000000001') - hosts listings 1, 2, 4; owns pet Miso (...001, no bookings in seed)
--     Blair ('10000000-0000-4000-8000-000000000002') - hosts listings 3, 5; owns pet Pixel (...003)
--     Casey ('10000000-0000-4000-8000-000000000003') - owns pet Rocket (...004, booked at Alex's listings 1 & 2, and Blair's listing 3)

\set ON_ERROR_STOP on

begin;

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
-- 7. A pet with a booking cannot be deleted (even by its owner)
-- Casey (...003) owns Rocket (...004), which has bookings in public.bookings.
-- Foreign key constraint bookings_pet_id_fkey (ON DELETE RESTRICT) must reject deletion.
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

rollback;
