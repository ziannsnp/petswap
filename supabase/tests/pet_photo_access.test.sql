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
-- Alex also owns Miso (unbooked pet) -> Alex can upload and read Miso's photo
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

-- Alex CANNOT delete Rocket's photo (not the pet owner)
do $$
declare
  deleted_rows integer;
begin
  begin
    delete from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000004/rocket.jpg';

    get diagnostics deleted_rows = row_count;
    if deleted_rows <> 0 then
      raise exception 'pet photo access: booked listing host deleted pet photo';
    end if;
  exception
    when others then
      if SQLERRM not like 'Direct deletion from storage tables is not allowed%' then
        raise;
      end if;
  end;
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

-- Alex can upload and read their own pet Miso's photo
insert into storage.objects (id, bucket_id, name)
values (
  '50000000-0000-4000-8000-000000000023',
  'pet-photos',
  '20000000-0000-4000-8000-000000000001/miso.jpg'
);

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

-- ---------------------------------------------------------------------------
-- 3. Unrelated Authenticated User (Blair)
-- Blair has no booking for Rocket and does not own Rocket
-- Blair also has no booking for Miso and does not own Miso
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

-- Blair CANNOT read Miso's photo (Miso has no bookings)
do $$
begin
  if exists (
    select 1
    from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000001/miso.jpg'
  ) then
    raise exception 'pet photo access: unrelated authenticated user was able to read unbooked pet photo';
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

-- Blair CANNOT delete Rocket's photo
do $$
declare
  deleted_rows integer;
begin
  begin
    delete from storage.objects
    where bucket_id = 'pet-photos'
      and name = '20000000-0000-4000-8000-000000000004/rocket.jpg';

    get diagnostics deleted_rows = row_count;
    if deleted_rows <> 0 then
      raise exception 'pet photo access: unrelated user deleted pet photo';
    end if;
  exception
    when others then
      if SQLERRM not like 'Direct deletion from storage tables is not allowed%' then
        raise;
      end if;
  end;
end;
$$;

-- Blair CANNOT insert into Rocket's folder
do $$
begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (
      '50000000-0000-4000-8000-000000000024',
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
-- 4. Cross-check: Casey CANNOT read unbooked pet Miso
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
      '50000000-0000-4000-8000-000000000025',
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
      '50000000-0000-4000-8000-000000000026',
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
      '50000000-0000-4000-8000-000000000027',
      'pet-photos',
      '20000000-0000-4000-8000-000000000004'
    );
    raise exception 'pet photo access: root-level upload without folder succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- Verify Rocket's photo was never compromised or deleted by unauthorized operations
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
end;
$$;

reset role;
rollback;
