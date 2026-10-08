-- Pet photo Storage RLS behavioural checks.
--
-- Contract:
-- 1. Pet photos live in the private 'pet-photos' bucket under '<pet_id>/<filename>'.
-- 2. The pet owner has full CRUD access to their pet's photos.
-- 3. A listing host with a booking for that pet can read (SELECT) the photo for signing.
-- 4. Unrelated authenticated users and anonymous users have no read or write access.
-- 5. Photos for pets without bookings are strictly readable only by their owner.

\set ON_ERROR_STOP on

begin;

-- Enable direct storage delete queries in this test transaction so DELETE statements
-- reach Row Level Security (RLS) policies instead of being blocked by storage triggers.
set local storage.allow_delete_query = 'true';

-- Seed data reference:
--   Users:
--     Alex ('10000000-0000-4000-8000-000000000001') - hosts listings 1, 2, 4; owns pet Miso
--     Blair ('10000000-0000-4000-8000-000000000002') - hosts listings 3, 5; owns pet Pixel
--     Casey ('10000000-0000-4000-8000-000000000003') - owns pet Rocket; has no listings
--   Pets & Bookings:
--     Rocket ('20000000-0000-4000-8000-000000000004'): owned by Casey, booked at listing 1 (Alex) & listing 3 (Blair).
--     Pixel ('20000000-0000-4000-8000-000000000003'): owned by Blair, booked at listing 1 (Alex). Casey is unrelated.
--     Miso ('20000000-0000-4000-8000-000000000001'): owned by Alex, has no bookings. Blair and Casey are unrelated.

-- ---------------------------------------------------------------------------
-- 1. Owner CRUD (Casey with Rocket)
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

-- Owner can upload photo into their pet's folder
insert into storage.objects (id, bucket_id, name)
values (
  '50000000-0000-4000-8000-000000000020',
  'pet-photos',
  '20000000-0000-4000-8000-000000000004/rocket.jpg'
);

-- Owner can read their pet's photo
do $$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000004/rocket.jpg'
  ) then
    raise exception 'pet photo access: owner cannot read own pet photo';
  end if;
end;
$$;

-- Owner can update their pet's photo
update storage.objects
set metadata = '{"version":"updated"}'::jsonb
where bucket_id = 'pet-photos'
  and name = '20000000-0000-4000-8000-000000000004/rocket.jpg';

-- Owner can upload a photo to be deleted to verify owner DELETE permissions
insert into storage.objects (id, bucket_id, name)
values (
  '50000000-0000-4000-8000-000000000029',
  'pet-photos',
  '20000000-0000-4000-8000-000000000004/rocket-to-delete.jpg'
);

-- Owner CAN delete their own pet photo (deletes exactly 1 row)
do $$
declare
  deleted_rows integer;
begin
  delete from storage.objects
  where bucket_id = 'pet-photos'
    and name = '20000000-0000-4000-8000-000000000004/rocket-to-delete.jpg';

  get diagnostics deleted_rows = row_count;
  if deleted_rows <> 1 then
    raise exception 'pet photo access: owner Casey was unable to delete own pet photo (deleted % rows, expected 1)', deleted_rows;
  end if;
end;
$$;

-- Verify the deleted photo is truly gone
do $$
begin
  if exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000004/rocket-to-delete.jpg'
  ) then
    raise exception 'pet photo access: owner-deleted photo still exists';
  end if;
end;
$$;

-- Owner cannot upload into another user's pet folder
do $$
begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (
      '50000000-0000-4000-8000-000000000021',
      'pet-photos',
      '20000000-0000-4000-8000-000000000001/miso.jpg'
    );
    raise exception 'pet photo access: user uploaded into an unowned pet folder';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Booked Listing Hosts (Alex and Blair for Rocket)
-- Both Alex (listing 1) and Blair (listing 3) host bookings for Rocket
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

-- Alex can read Rocket's photo because Rocket is booked at Alex's listing 1
do $$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000004/rocket.jpg'
  ) then
    raise exception 'pet photo access: listing host Alex cannot read booked pet photo';
  end if;
end;
$$;

-- Alex CANNOT update Rocket's photo (not the pet owner)
do $$
declare
  updated_rows integer;
begin
  update storage.objects
  set metadata = '{"malicious":"update"}'::jsonb
  where bucket_id = 'pet-photos'
    and name = '20000000-0000-4000-8000-000000000004/rocket.jpg';

  get diagnostics updated_rows = row_count;
  if updated_rows <> 0 then
    raise exception 'pet photo access: booked listing host Alex was able to update pet photo';
  end if;
end;
$$;

-- Alex CANNOT delete Rocket's photo (deletes 0 rows under RLS)
do $$
declare
  deleted_rows integer;
begin
  delete from storage.objects
  where bucket_id = 'pet-photos'
    and name = '20000000-0000-4000-8000-000000000004/rocket.jpg';

  get diagnostics deleted_rows = row_count;
  if deleted_rows <> 0 then
    raise exception 'pet photo access: booked listing host Alex deleted pet photo (deleted % rows, expected 0)', deleted_rows;
  end if;
end;
$$;

-- Alex CANNOT insert into Rocket's folder
do $$
begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (
      '50000000-0000-4000-8000-000000000022',
      'pet-photos',
      '20000000-0000-4000-8000-000000000004/alex-injected.jpg'
    );
    raise exception 'pet photo access: non-owner host Alex uploaded photo into booked pet folder';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- Now test Blair (who also hosts Rocket at listing 3)
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

-- Blair can read Rocket's photo because Rocket is booked at Blair's listing 3
do $$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000004/rocket.jpg'
  ) then
    raise exception 'pet photo access: listing host Blair cannot read booked pet photo';
  end if;
end;
$$;

-- Blair CANNOT update Rocket's photo
do $$
declare
  updated_rows integer;
begin
  update storage.objects
  set metadata = '{"malicious":"update"}'::jsonb
  where bucket_id = 'pet-photos'
    and name = '20000000-0000-4000-8000-000000000004/rocket.jpg';

  get diagnostics updated_rows = row_count;
  if updated_rows <> 0 then
    raise exception 'pet photo access: booked listing host Blair was able to update pet photo';
  end if;
end;
$$;

-- Blair CANNOT delete Rocket's photo (deletes 0 rows under RLS)
do $$
declare
  deleted_rows integer;
begin
  delete from storage.objects
  where bucket_id = 'pet-photos'
    and name = '20000000-0000-4000-8000-000000000004/rocket.jpg';

  get diagnostics deleted_rows = row_count;
  if deleted_rows <> 0 then
    raise exception 'pet photo access: booked listing host Blair deleted pet photo (deleted % rows, expected 0)', deleted_rows;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Owner CRUD & Unrelated User Test (Blair with Pixel vs Casey)
-- Blair owns Pixel. Casey has no booking and no listing -> Casey is unrelated to Pixel.
-- ---------------------------------------------------------------------------
-- Blair uploads photo for their pet Pixel
insert into storage.objects (id, bucket_id, name)
values (
  '50000000-0000-4000-8000-000000000023',
  'pet-photos',
  '20000000-0000-4000-8000-000000000003/pixel.jpg'
);

-- Blair can read Pixel's photo
do $$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000003/pixel.jpg'
  ) then
    raise exception 'pet photo access: owner Blair cannot read own pet Pixel photo';
  end if;
end;
$$;

-- Alex (who hosts Pixel at listing 1) can read Pixel's photo
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000003/pixel.jpg'
  ) then
    raise exception 'pet photo access: booked host Alex cannot read Pixel photo';
  end if;
end;
$$;

-- Switch to Casey: Casey does NOT own Pixel and has NO bookings for Pixel
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

-- Casey CANNOT read Pixel's photo
do $$
begin
  if exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000003/pixel.jpg'
  ) then
    raise exception 'pet photo access: unrelated authenticated user Casey was able to read Pixel photo';
  end if;
end;
$$;

-- Casey CANNOT update Pixel's photo
do $$
declare
  updated_rows integer;
begin
  update storage.objects
  set metadata = '{"malicious":"update"}'::jsonb
  where bucket_id = 'pet-photos'
    and name = '20000000-0000-4000-8000-000000000003/pixel.jpg';

  get diagnostics updated_rows = row_count;
  if updated_rows <> 0 then
    raise exception 'pet photo access: unrelated user Casey was able to update Pixel photo';
  end if;
end;
$$;

-- Casey CANNOT delete Pixel's photo (deletes 0 rows under RLS)
do $$
declare
  deleted_rows integer;
begin
  delete from storage.objects
  where bucket_id = 'pet-photos'
    and name = '20000000-0000-4000-8000-000000000003/pixel.jpg';

  get diagnostics deleted_rows = row_count;
  if deleted_rows <> 0 then
    raise exception 'pet photo access: unrelated user Casey deleted Pixel photo (deleted % rows, expected 0)', deleted_rows;
  end if;
end;
$$;

-- Casey CANNOT insert into Pixel's folder
do $$
begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (
      '50000000-0000-4000-8000-000000000024',
      'pet-photos',
      '20000000-0000-4000-8000-000000000003/casey-injected.jpg'
    );
    raise exception 'pet photo access: unrelated user Casey uploaded into Pixel folder';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Unbooked Pet Isolation (Alex with Miso)
-- Alex owns Miso. Miso has NO bookings -> only Alex can read Miso's photo.
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

insert into storage.objects (id, bucket_id, name)
values (
  '50000000-0000-4000-8000-000000000025',
  'pet-photos',
  '20000000-0000-4000-8000-000000000001/miso.jpg'
);

-- Alex can read own pet Miso's photo
do $$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000001/miso.jpg'
  ) then
    raise exception 'pet photo access: owner Alex cannot read own pet Miso photo';
  end if;
end;
$$;

-- Blair CANNOT read Miso's photo (no booking)
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  if exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000001/miso.jpg'
  ) then
    raise exception 'pet photo access: Blair was able to read unbooked pet Miso photo';
  end if;
end;
$$;

-- Casey CANNOT read Miso's photo (no booking)
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  if exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000001/miso.jpg'
  ) then
    raise exception 'pet photo access: Casey was able to read unbooked pet Miso photo';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Anonymous User
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

-- Anonymous user CANNOT read private pet photos
do $$
begin
  if exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name in (
        '20000000-0000-4000-8000-000000000004/rocket.jpg',
        '20000000-0000-4000-8000-000000000003/pixel.jpg',
        '20000000-0000-4000-8000-000000000001/miso.jpg'
      )
  ) then
    raise exception 'pet photo access: anonymous user was able to read pet photo';
  end if;
end;
$$;

-- Anonymous user CANNOT upload pet photos
do $$
begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (
      '50000000-0000-4000-8000-000000000026',
      'pet-photos',
      '20000000-0000-4000-8000-000000000004/anon.jpg'
    );
    raise exception 'pet photo access: anonymous user uploaded a pet photo';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- Anonymous user CANNOT delete pet photos (deletes 0 rows under RLS)
do $$
declare
  deleted_rows integer;
begin
  delete from storage.objects
  where bucket_id = 'pet-photos'
    and name = '20000000-0000-4000-8000-000000000004/rocket.jpg';

  get diagnostics deleted_rows = row_count;
  if deleted_rows <> 0 then
    raise exception 'pet photo access: anonymous user deleted pet photo (deleted % rows, expected 0)', deleted_rows;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Malformed Path / Non-UUID Folder / Root Upload Rejection
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

-- Upload into non-UUID folder must fail
do $$
begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (
      '50000000-0000-4000-8000-000000000027',
      'pet-photos',
      'not-a-uuid-folder/malicious.jpg'
    );
    raise exception 'pet photo access: upload into non-UUID folder succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- Upload at root level without folder (e.g. named as UUID directly) must fail
do $$
begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (
      '50000000-0000-4000-8000-000000000028',
      'pet-photos',
      '20000000-0000-4000-8000-000000000004'
    );
    raise exception 'pet photo access: root-level upload without folder succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- Reset role to superuser to verify all photos persisted despite unauthorized attempts
reset role;

-- Verify photos remain intact and were not modified or deleted by unauthorized attempts
do $$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000004/rocket.jpg'
  ) then
    raise exception 'pet photo access: Rocket photo missing at end of test suite';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000003/pixel.jpg'
  ) then
    raise exception 'pet photo access: Pixel photo missing at end of test suite';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000001/miso.jpg'
  ) then
    raise exception 'pet photo access: Miso photo missing at end of test suite';
  end if;
end;
$$;

rollback;
