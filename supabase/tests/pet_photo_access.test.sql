-- Pet photo Storage RLS behavioural checks.
--
-- Contract:
-- 1. Pet photos live in the private 'pet-photos' bucket under '<pet_id>/<filename>'.
-- 2. The pet owner has full CRUD access to their pet's photos.
-- 3. A listing host with a booking for that pet can read (SELECT) the photo for signing.
-- 4. Unrelated authenticated users and anonymous users have no read or write access.

\set ON_ERROR_STOP on

begin;

-- Seed photos directly into storage.objects for testing access rules.
-- Pet Rocket ('20000000-0000-4000-8000-000000000004') is owned by Casey ('10000000-0000-4000-8000-000000000003').
-- Rocket is booked at listing 1 ('30000000-0000-4000-8000-000000000001'), owned by Alex ('10000000-0000-4000-8000-000000000001').
-- Pet Miso ('20000000-0000-4000-8000-000000000001') is owned by Alex and has no bookings.

-- ---------------------------------------------------------------------------
-- 1. Owner CRUD (Casey)
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
-- 2. Booked Listing Owner (Alex)
-- Alex owns listing 1 where Rocket has a booking -> Alex can read Rocket's photo
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

-- Alex can read Rocket's photo because Rocket is booked at Alex's listing
do $$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000004/rocket.jpg'
  ) then
    raise exception 'pet photo access: listing owner with booking cannot read booked pet photo';
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
    raise exception 'pet photo access: booked listing host was able to update pet photo';
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
    raise exception 'pet photo access: non-owner host uploaded photo into booked pet folder';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Unrelated Authenticated User (Blair)
-- Blair has no booking for Rocket and does not own Rocket
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

-- Blair CANNOT read Rocket's photo
do $$
begin
  if exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000004/rocket.jpg'
  ) then
    raise exception 'pet photo access: unrelated authenticated user was able to read pet photo';
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
    raise exception 'pet photo access: unrelated user was able to update pet photo';
  end if;
end;
$$;

-- Blair CANNOT insert into Rocket's folder
do $$
begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (
      '50000000-0000-4000-8000-000000000023',
      'pet-photos',
      '20000000-0000-4000-8000-000000000004/blair-injected.jpg'
    );
    raise exception 'pet photo access: unrelated user uploaded into pet folder';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Anonymous User
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
      and name = '20000000-0000-4000-8000-000000000004/rocket.jpg'
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
      '50000000-0000-4000-8000-000000000024',
      'pet-photos',
      '20000000-0000-4000-8000-000000000004/anon.jpg'
    );
    raise exception 'pet photo access: anonymous user uploaded a pet photo';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Malformed Path / Non-UUID Folder
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (
      '50000000-0000-4000-8000-000000000025',
      'pet-photos',
      'not-a-uuid-folder/malicious.jpg'
    );
    raise exception 'pet photo access: upload into non-UUID folder succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
