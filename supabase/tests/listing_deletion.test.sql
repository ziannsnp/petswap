\set ON_ERROR_STOP on

begin;

-- Fixtures. Seed users: Alex (...001) owns every fixture listing, Blair (...002) is the
-- non-owner, and Casey (...003) makes the bookings with Rocket (...004). Triggers are off
-- for the load so each booking can be seeded directly in its final status.
--
-- Booking cases: one listing per booking status, each holding exactly that one booking, so
-- every status is judged on its own. Pending and confirmed must block deletion; declined,
-- cancelled, and completed must not.
--
-- Ownership cases: a listing of Alex's with no bookings (Blair is the non-owner), a listing
-- Alex has already deleted, and ...299, an id no listing uses (missing).
set local session_replication_role = replica;

insert into public.listings (
  id, owner_id, title, location, description, capacity, accepted_pet_types,
  status, published_at, deleted_at
)
values
  ('30000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001',
   'Pending booking case', 'Test City', 'Holds exactly one pending booking.',
   1, array['dog']::public.pet_species[], 'published', now(), null),
  ('30000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001',
   'Confirmed booking case', 'Test City', 'Holds exactly one confirmed booking.',
   1, array['dog']::public.pet_species[], 'published', now(), null),
  ('30000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000001',
   'Declined booking case', 'Test City', 'Holds exactly one declined booking.',
   1, array['dog']::public.pet_species[], 'published', now(), null),
  ('30000000-0000-4000-8000-000000000104', '10000000-0000-4000-8000-000000000001',
   'Cancelled booking case', 'Test City', 'Holds exactly one cancelled booking.',
   1, array['dog']::public.pet_species[], 'published', now(), null),
  ('30000000-0000-4000-8000-000000000105', '10000000-0000-4000-8000-000000000001',
   'Completed booking case', 'Test City', 'Holds exactly one completed booking.',
   1, array['dog']::public.pet_species[], 'published', now(), null),
  ('30000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000001',
   'Ownership case without bookings', 'Test City', 'Published by Alex, no bookings.',
   1, array['dog']::public.pet_species[], 'published', now(), null),
  ('30000000-0000-4000-8000-000000000202', '10000000-0000-4000-8000-000000000001',
   'Already deleted case', 'Test City', 'Soft-deleted by Alex earlier.',
   1, array['dog']::public.pet_species[], 'deleted', null, now());

insert into public.bookings (
  id, listing_id, pet_id, requester_id, status, start_date, end_date,
  confirmed_at, declined_at, cancelled_at, completed_at
)
values
  ('40000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000101',
   '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'pending', date '2026-12-01', date '2026-12-04', null, null, null, null),
  ('40000000-0000-4000-8000-000000000102', '30000000-0000-4000-8000-000000000102',
   '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'confirmed', date '2026-12-01', date '2026-12-04', now(), null, null, null),
  ('40000000-0000-4000-8000-000000000103', '30000000-0000-4000-8000-000000000103',
   '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'declined', date '2026-12-01', date '2026-12-04', null, now(), null, null),
  ('40000000-0000-4000-8000-000000000104', '30000000-0000-4000-8000-000000000104',
   '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'cancelled', date '2026-12-01', date '2026-12-04', null, null, now(), null),
  ('40000000-0000-4000-8000-000000000105', '30000000-0000-4000-8000-000000000105',
   '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'completed', date '2026-09-01', date '2026-09-05', now(), null, null, now());
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
    or updated_at <= previous_updated_at then
    raise exception 'listing deletion: status and audit timestamps were not persisted';
  end if;
end;
$$;

do $$
declare
  booking_case record;
  error_message text;
  final_status public.listing_status;
begin
  for booking_case in
    select *
    from (values
      ('pending', '30000000-0000-4000-8000-000000000101'::uuid, true),
      ('confirmed', '30000000-0000-4000-8000-000000000102'::uuid, true),
      ('declined', '30000000-0000-4000-8000-000000000103'::uuid, false),
      ('cancelled', '30000000-0000-4000-8000-000000000104'::uuid, false),
      ('completed', '30000000-0000-4000-8000-000000000105'::uuid, false)
    ) as cases(booking_status, listing_id, blocks_deletion)
  loop
    error_message := null;
    begin
      perform public.delete_listing_with_active_booking_check(booking_case.listing_id);
    exception
      when raise_exception then
        get stacked diagnostics error_message = message_text;
    end;

    select status into final_status from public.listings where id = booking_case.listing_id;

    if booking_case.blocks_deletion and (
      error_message is distinct from 'Listing has active bookings and cannot be deleted.'
      or final_status is distinct from 'published'
    ) then
      raise exception 'listing deletion: a % booking did not block deletion', booking_case.booking_status;
    end if;

    if not booking_case.blocks_deletion
      and (error_message is not null or final_status is distinct from 'deleted') then
      raise exception 'listing deletion: a % booking blocked deletion (%)',
        booking_case.booking_status, coalesce(error_message, final_status::text);
    end if;
  end loop;
end;
$$;

do $$
declare
  rejected boolean := false;
  error_message text;
begin
  begin
    perform public.delete_listing_with_active_booking_check(
      '30000000-0000-4000-8000-000000000202'
    );
  exception
    when raise_exception then
      get stacked diagnostics error_message = message_text;
      rejected := error_message = 'Listing is already deleted.';
  end;

  if not rejected then
    raise exception 'listing deletion: deleting an already-deleted listing was not refused';
  end if;

  -- A missing id is refused exactly like someone else's listing, so the response never
  -- confirms whether a listing exists.
  rejected := false;
  begin
    perform public.delete_listing_with_active_booking_check(
      '30000000-0000-4000-8000-000000000299'
    );
  exception
    when insufficient_privilege then rejected := true;
  end;

  if not rejected then
    raise exception 'listing deletion: deleting a missing listing was not refused';
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
      '30000000-0000-4000-8000-000000000201'
    );
  exception
    when insufficient_privilege then rejected := true;
  end;

  if not rejected or not exists (
    select 1 from public.listings
    where id = '30000000-0000-4000-8000-000000000201'
      and status = 'published'
      and deleted_at is null
  ) then
    raise exception 'listing deletion: a non-owner deleted a published listing without bookings';
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