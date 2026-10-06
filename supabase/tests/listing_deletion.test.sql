\set ON_ERROR_STOP on

begin;

set local session_replication_role = replica;
insert into public.listings (
  id, owner_id, title, location, description, capacity, accepted_pet_types, status, published_at
)
values (
  '30000000-0000-4000-8000-000000000009',
  '10000000-0000-4000-8000-000000000001',
  'Confirmed-only fixture',
  'Test City',
  'A listing with only a confirmed booking.',
  1,
  array['dog']::public.pet_species[],
  'published',
  now()
);
insert into public.bookings (
  id, listing_id, pet_id, requester_id, status, start_date, end_date
)
values (
  '40000000-0000-4000-8000-000000000009',
  '30000000-0000-4000-8000-000000000009',
  '20000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000002',
  'confirmed',
  date '2026-11-01',
  date '2026-11-04'
);
set local session_replication_role = origin;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  previous_updated_at timestamptz;
  deleted_status public.listing_status;
  deleted_at timestamptz;
  updated_at timestamptz;
begin
  select listing.updated_at into previous_updated_at
  from public.listings as listing
  where listing.id = '30000000-0000-4000-8000-000000000004';

  perform public.delete_listing_with_active_booking_check(
    '30000000-0000-4000-8000-000000000004'
  );

  select listing.status, listing.deleted_at, listing.updated_at
  into deleted_status, deleted_at, updated_at
  from public.listings as listing
  where listing.id = '30000000-0000-4000-8000-000000000004';

  if deleted_status is distinct from 'deleted'
    or deleted_at is null
    or updated_at is null
    or updated_at < deleted_at
    or updated_at < previous_updated_at then
    raise exception 'listing deletion: status and audit timestamps were not persisted';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
  error_message text;
begin
  begin
    perform public.delete_listing_with_active_booking_check(
      '30000000-0000-4000-8000-000000000009'
    );
  exception
    when raise_exception then
      get stacked diagnostics error_message = message_text;
      rejected := error_message = 'Listing has active bookings and cannot be deleted.';
  end;

  if not rejected then
    raise exception 'listing deletion: a confirmed-only booking did not block deletion';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
  error_message text;
begin
  begin
    perform public.delete_listing_with_active_booking_check(
      '30000000-0000-4000-8000-000000000001'
    );
  exception
    when raise_exception then
      get stacked diagnostics error_message = message_text;
      rejected := error_message = 'Listing has active bookings and cannot be deleted.';
  end;

  if not rejected then
    raise exception 'listing deletion: pending or confirmed bookings did not block deletion';
  end if;

  if not exists (
    select 1 from public.listings
    where id = '30000000-0000-4000-8000-000000000001'
      and status = 'published'
      and deleted_at is null
  ) then
    raise exception 'listing deletion: blocked deletion changed the listing';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
  changed_rows integer := 0;
begin
  begin
    update public.listings
    set status = 'deleted', deleted_at = now()
    where id = '30000000-0000-4000-8000-000000000001';
  exception
    when insufficient_privilege then rejected := true;
  end;

  get diagnostics changed_rows = row_count;
  if not rejected and changed_rows <> 0 then
    raise exception 'listing deletion: direct owner update bypassed the active-booking check';
  end if;
end;
$$;

do $$
declare
  changed_rows integer;
begin
  update public.listings
  set status = 'draft', deleted_at = null
  where id = '30000000-0000-4000-8000-000000000004';
  get diagnostics changed_rows = row_count;

  if changed_rows <> 0 then
    raise exception 'listing deletion: a soft-deleted listing was restored through direct update';
  end if;

  delete from public.listings
  where id = '30000000-0000-4000-8000-000000000001';
  get diagnostics changed_rows = row_count;

  if changed_rows <> 0 then
    raise exception 'listing deletion: an owner hard-deleted a listing';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

do $$
declare
  rejected boolean := false;
  error_message text;
begin
  begin
    perform public.delete_listing_with_active_booking_check(
      '30000000-0000-4000-8000-000000000004'
    );
  exception
    when insufficient_privilege then rejected := true;
  end;

  if not rejected then
    raise exception 'listing deletion: a non-owner deleted another user listing';
  end if;

  rejected := false;
  begin
    perform public.delete_listing_with_active_booking_check(
      '30000000-0000-4000-8000-000000000003'
    );
  exception
    when raise_exception then
      get stacked diagnostics error_message = message_text;
      rejected := error_message = 'Listing has active bookings and cannot be deleted.';
  end;

  if not rejected then
    raise exception 'listing deletion: a pending-only booking did not block deletion';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  deleted_status public.listing_status;
begin
  perform public.delete_listing_with_active_booking_check(
    '30000000-0000-4000-8000-000000000002'
  );

  select status into deleted_status
  from public.listings
  where id = '30000000-0000-4000-8000-000000000002';

  if deleted_status is distinct from 'deleted' then
    raise exception 'listing deletion: a declined booking incorrectly blocked deletion';
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
  rejected boolean := false;
  error_message text;
begin
  begin
    insert into public.bookings (
      listing_id, pet_id, requester_id, status, start_date, end_date
    ) values (
      '30000000-0000-4000-8000-000000000004',
      '20000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000002',
      'pending',
      date '2026-11-01',
      date '2026-11-04'
    );
  exception
    when raise_exception then
      get stacked diagnostics error_message = message_text;
      rejected := error_message = 'booking listing must be published';
  end;

  if not rejected then
    raise exception 'listing deletion: a new booking was accepted after soft deletion';
  end if;
end;
$$;

reset role;
rollback;