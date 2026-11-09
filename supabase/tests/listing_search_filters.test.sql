\set ON_ERROR_STOP on
begin;

insert into public.listings (
  id, owner_id, title, location, description, capacity, accepted_pet_types, status, deleted_at
) values
  ('3f000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'Filter fixture alpha', 'Filter City', 'Filter fixture', 2, array['dog','cat']::public.pet_species[], 'published', null),
  ('3f000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'Filter fixture beta', 'Filter City', 'Filter fixture', 3, array['cat']::public.pet_species[], 'published', null),
  ('3f000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
   'Filter fixture gamma', 'Filter City', 'Filter fixture', 5, array['dog']::public.pet_species[], 'published', null),
  ('3f000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
   'Filter fixture delta', 'Filter City', 'Filter fixture', 3, array['dog','cat']::public.pet_species[], 'published', null),
  ('3f000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001',
   'Filter fixture private', 'Filter City', 'Filter fixture', 50, array['cat']::public.pet_species[], 'draft', null),
  ('3f000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001',
   'Filter fixture deleted', 'Filter City', 'Filter fixture', 50, array['cat']::public.pet_species[], 'deleted', now());

-- Construct every status directly; request/status-transition behaviour is covered
-- separately. CHECK and exclusion constraints remain enabled under replica.
set local session_replication_role = replica;
insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
values
  ('3f000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000002', 'confirmed', '2026-12-10', '2026-12-15'),
  ('3f000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000002', 'confirmed', '2026-12-20', '2026-12-25');
insert into public.bookings (listing_id, pet_id, requester_id, status, start_date, end_date)
select '3f000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000002', booking_status::public.booking_status, '2026-12-10', '2026-12-15'
from unnest(array['pending', 'declined', 'cancelled', 'completed']) as booking_status;
set local session_replication_role = origin;

do $$
declare
  ids uuid[];
  row_page integer;
  row_total bigint;
  window_start date;
  window_end date;
  invalid_query text;
  sort_order text;
  expected_first uuid;
  expected_last uuid;
begin
  select array_agg(id order by id), min(total_count) into ids, row_total
  from public.search_published_listings('Filter City', '', 1, 24, 'newest', 'cat');
  if ids is distinct from array[
    '3f000000-0000-4000-8000-000000000001'::uuid,
    '3f000000-0000-4000-8000-000000000002'::uuid,
    '3f000000-0000-4000-8000-000000000004'::uuid
  ] or row_total <> 3 then
    raise exception 'pet matching or public visibility failed: %, %', ids, row_total;
  end if;

  select array_agg(id order by id), min(total_count) into ids, row_total
  from public.search_published_listings('Filter City', '', 1, 24, 'newest', null, 3);
  if ids is distinct from array[
    '3f000000-0000-4000-8000-000000000002'::uuid,
    '3f000000-0000-4000-8000-000000000003'::uuid,
    '3f000000-0000-4000-8000-000000000004'::uuid
  ] or row_total <> 3 then
    raise exception 'inclusive minimum capacity failed: %, %', ids, row_total;
  end if;

  -- No date filter must leave booked listings in the results; legacy callers work.
  select count(*) into row_total
  from public.search_published_listings('Filter City', '', 1, 24);
  if row_total <> 4 then raise exception 'legacy unfiltered search changed: %', row_total; end if;
  select count(*) into row_total
  from public.search_published_listings('Filter City', '', 1, 24, 'oldest', null, 1);
  if row_total <> 4 then raise exception 'minimum capacity one changed results'; end if;

  -- Partial overlap, containment in either direction, and identical dates all block.
  for window_start, window_end in
    select * from (values
      (date '2026-12-09', date '2026-12-11'),
      (date '2026-12-14', date '2026-12-16'),
      (date '2026-12-11', date '2026-12-12'),
      (date '2026-12-09', date '2026-12-16'),
      (date '2026-12-10', date '2026-12-15')
    ) as windows(start_date, end_date)
  loop
    select array_agg(id order by id), min(total_count) into ids, row_total
    from public.search_published_listings('Filter City', '', 1, 24, 'newest', null, null, window_start, window_end);
    if ids is distinct from array[
      '3f000000-0000-4000-8000-000000000002'::uuid,
      '3f000000-0000-4000-8000-000000000003'::uuid,
      '3f000000-0000-4000-8000-000000000004'::uuid
    ] or row_total <> 3 then
      raise exception 'confirmed-only overlap failed for % to %: %', window_start, window_end, ids;
    end if;
  end loop;

  -- Touching either end is allowed (end-exclusive ranges).
  for window_start, window_end in
    select * from (values
      (date '2026-12-08', date '2026-12-10'),
      (date '2026-12-15', date '2026-12-16')
    ) as windows(start_date, end_date)
  loop
    select count(*) into row_total
    from public.search_published_listings('Filter City', '', 1, 24, 'newest', null, null, window_start, window_end);
    if row_total <> 4 then raise exception 'back-to-back stay blocked: %, %', window_start, window_end; end if;
  end loop;

  select array_agg(id order by id) into ids
  from public.search_published_listings('Filter City', '', 1, 24, 'newest', null, null, '2026-12-20', '2026-12-25');
  if ids is distinct from array[
    '3f000000-0000-4000-8000-000000000001'::uuid,
    '3f000000-0000-4000-8000-000000000002'::uuid,
    '3f000000-0000-4000-8000-000000000004'::uuid
  ] then raise exception 'conflict must be scoped to the same listing: %', ids; end if;

  -- Combined filters and ordering are applied before count, page clamp, and slice.
  select array_agg(id), min(total_count), min(page_number) into ids, row_total, row_page
  from public.search_published_listings('filter city', 'FIXTURE', 1, 1, 'title', 'cat', 2, '2026-12-10', '2026-12-15');
  if ids is distinct from array['3f000000-0000-4000-8000-000000000002'::uuid]
    or row_total <> 2 or row_page <> 1 then
    raise exception 'combined filters page one failed: %, %, %', ids, row_total, row_page;
  end if;
  select array_agg(id), min(total_count), min(page_number) into ids, row_total, row_page
  from public.search_published_listings('filter city', 'FIXTURE', 99, 1, 'title', 'cat', 2, '2026-12-10', '2026-12-15');
  if ids is distinct from array['3f000000-0000-4000-8000-000000000004'::uuid]
    or row_total <> 2 or row_page <> 2 then
    raise exception 'combined filters last page failed: %, %, %', ids, row_total, row_page;
  end if;

  foreach sort_order in array array['newest', 'oldest', 'title', 'capacity'] loop
    expected_first := case when sort_order = 'title'
      then '3f000000-0000-4000-8000-000000000002'::uuid
      else '3f000000-0000-4000-8000-000000000004'::uuid end;
    expected_last := case when sort_order = 'title'
      then '3f000000-0000-4000-8000-000000000004'::uuid
      else '3f000000-0000-4000-8000-000000000002'::uuid end;
    select array_agg(id), min(total_count) into ids, row_total
    from public.search_published_listings('Filter City', '', 1, 1, sort_order, 'cat', 3, '2026-12-10', '2026-12-15');
    if ids is distinct from array[expected_first] or row_total <> 2 then
      raise exception 'filtered % first page failed: %', sort_order, ids;
    end if;
    select array_agg(id), min(total_count) into ids, row_total
    from public.search_published_listings('Filter City', '', 2, 1, sort_order, 'cat', 3, '2026-12-10', '2026-12-15');
    if ids is distinct from array[expected_last] or row_total <> 2 then
      raise exception 'filtered % last page failed: %', sort_order, ids;
    end if;
  end loop;
  if exists (select 1 from public.search_published_listings('Filter City', '', 99, 24, 'newest', 'bird', 2))
    or exists (select 1 from public.search_published_listings('Filter City', '', 1, 24, 'newest', 'cat', 11)) then
    raise exception 'unmatched pet or capacity must return no rows';
  end if;

  foreach invalid_query in array array[
    $q$select * from public.search_published_listings('', '', 1, 9, 'newest', null, 0)$q$,
    $q$select * from public.search_published_listings('', '', 1, 9, 'newest', null, -1)$q$,
    $q$select * from public.search_published_listings('', '', 1, 9, 'newest', 'dragon')$q$,
    $q$select * from public.search_published_listings('', '', 1, 9, 'newest', null, null, '2026-12-10', null)$q$,
    $q$select * from public.search_published_listings('', '', 1, 9, 'newest', null, null, null, '2026-12-15')$q$,
    $q$select * from public.search_published_listings('', '', 1, 9, 'newest', null, null, '2026-12-10', '2026-12-10')$q$,
    $q$select * from public.search_published_listings('', '', 1, 9, 'newest', null, null, '2026-12-15', '2026-12-10')$q$,
    $q$select * from public.search_published_listings('', '', 1, 9, 'newest', null, null, '2026-02-31', '2026-03-05')$q$,
    $q$select * from public.search_published_listings('', '', 1, 9, 'newest', null, null, '-infinity', 'infinity')$q$
  ] loop
    begin
      execute invalid_query;
      raise exception using message = 'invalid filter accepted', errcode = 'XX000';
    exception when raise_exception or invalid_text_representation or datetime_field_overflow then null;
    end;
  end loop;
end;
$$;

-- These actors cannot read Blair's fixture bookings. Availability must still
-- exclude them without broadening SELECT on bookings or returning private listings.
set local role anon;
do $$
begin
  if exists (select 1 from public.bookings where listing_id = '3f000000-0000-4000-8000-000000000001') then
    raise exception 'anonymous caller can read private bookings';
  end if;
  if exists (select 1 from public.search_published_listings('Filter City', '', 1, 24, 'newest', null, null, '2026-12-10', '2026-12-15')
    where id in ('3f000000-0000-4000-8000-000000000001', '3f000000-0000-4000-8000-000000000005', '3f000000-0000-4000-8000-000000000006')) then
    raise exception 'anonymous search leaked a booked or private listing';
  end if;
  if (select count(*) from public.search_published_listings('Filter City', '', 1, 24, 'newest', 'cat', 3, '2026-12-10', '2026-12-15')) <> 2 then
    raise exception 'anonymous combined search returned the wrong matches';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.bookings where listing_id = '3f000000-0000-4000-8000-000000000001') then
    raise exception 'unrelated caller can read private bookings';
  end if;
  if (select count(*) from public.search_published_listings('Filter City', '', 1, 24, 'newest', 'cat', 2, '2026-12-10', '2026-12-15')) <> 2 then
    raise exception 'unrelated caller missed a private confirmed conflict';
  end if;
end;
$$;
reset role;

-- Even an owner must not see their drafts/deleted listings in public search.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.search_published_listings('Filter City', '', 1, 24, 'newest', 'cat')) <> 3 then
    raise exception 'owner search leaked a private listing';
  end if;
end;
$$;
reset role;
rollback;
