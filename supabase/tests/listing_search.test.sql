\set ON_ERROR_STOP on

begin;

insert into public.listings (
  id, owner_id, title, location, description, capacity, accepted_pet_types, status, deleted_at
)
values
  ('30000000-0000-4000-8000-000000000091', '10000000-0000-4000-8000-000000000001',
   '100% safe (quartz), "quoted"', 'Bangkok, 100% District',
   E'A quiet dog space with 50% shade, underscore_word and C:\\pets.',
   1, array['dog']::public.pet_species[], 'published', null),
  ('30000000-0000-4000-8000-000000000092', '10000000-0000-4000-8000-000000000001',
   'Quartz at home', 'Bangkok', 'A calm space.',
   1, array['cat']::public.pet_species[], 'published', null),
  ('30000000-0000-4000-8000-000000000093', '10000000-0000-4000-8000-000000000001',
   'Countryside', 'Phuket', 'A QUARTZ field.',
   1, array['dog']::public.pet_species[], 'published', null),
  ('30000000-0000-4000-8000-000000000094', '10000000-0000-4000-8000-000000000001',
   'Use underscore_mark', 'Chiang_Mai', E'A calm place near C:\\pets.',
   1, array['cat']::public.pet_species[], 'published', null),
  ('30000000-0000-4000-8000-000000000095', '10000000-0000-4000-8000-000000000001',
   'Quartz draft', 'Bangkok', 'Not public.',
   1, array['dog']::public.pet_species[], 'draft', null),
  ('30000000-0000-4000-8000-000000000096', '10000000-0000-4000-8000-000000000001',
   'Quartz deleted', 'Bangkok', 'Not public.',
   1, array['dog']::public.pet_species[], 'deleted', now());

do $$
declare
  matched_ids uuid[];
  match_count bigint;
  actual_page integer;
begin
  select array_agg(id order by published_at desc nulls last, id desc), min(total_count)
  into matched_ids, match_count
  from public.search_published_listings('', 'quartz', 1, 2);
  if matched_ids is distinct from array[
    '30000000-0000-4000-8000-000000000093'::uuid,
    '30000000-0000-4000-8000-000000000092'::uuid
  ] or match_count is distinct from 3 then
    raise exception 'keyword matching/order/page 1 failed: ids %, count %', matched_ids, match_count;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc), min(total_count)
  into matched_ids, match_count
  from public.search_published_listings('', 'QUARTZ', 2, 2);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid]
    or match_count is distinct from 3 then
    raise exception 'case-insensitive page 2 failed: ids %, count %', matched_ids, match_count;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc), min(page_number)
  into matched_ids, actual_page
  from public.search_published_listings('', 'quartz', 99, 2);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid]
    or actual_page is distinct from 2 then
    raise exception 'out-of-range page did not clamp to the last page: ids %, page %', matched_ids, actual_page;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc)
  into matched_ids
  from public.search_published_listings('100% district', '', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid] then
    raise exception 'case-insensitive location matching failed: ids %', matched_ids;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc)
  into matched_ids
  from public.search_published_listings('', '%', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid] then
    raise exception 'percent wildcard was not treated as literal text: ids %', matched_ids;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc)
  into matched_ids
  from public.search_published_listings('', '_', 1, 10);
  if matched_ids is distinct from array[
    '30000000-0000-4000-8000-000000000094'::uuid,
    '30000000-0000-4000-8000-000000000091'::uuid
  ] then
    raise exception 'underscore wildcard was not treated as literal text: ids %', matched_ids;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc)
  into matched_ids
  from public.search_published_listings('', E'\\', 1, 10);
  if matched_ids is distinct from array[
    '30000000-0000-4000-8000-000000000094'::uuid,
    '30000000-0000-4000-8000-000000000091'::uuid
  ] then
    raise exception 'backslash search did not match literally: ids %', matched_ids;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc)
  into matched_ids
  from public.search_published_listings('', '(', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid] then
    raise exception 'parenthesis search did not match literally: ids %', matched_ids;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc)
  into matched_ids
  from public.search_published_listings('', ', "quoted"', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid] then
    raise exception 'comma search did not match literally: ids %', matched_ids;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc)
  into matched_ids
  from public.search_published_listings('', '"', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid] then
    raise exception 'quote search did not match literally: ids %', matched_ids;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc)
  into matched_ids
  from public.search_published_listings('Chiang_Mai', '', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000094'::uuid] then
    raise exception 'location underscore search did not match literally: ids %', matched_ids;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc)
  into matched_ids
  from public.search_published_listings('Bangkok', 'quartz', 1, 10);
  if matched_ids is distinct from array[
    '30000000-0000-4000-8000-000000000092'::uuid,
    '30000000-0000-4000-8000-000000000091'::uuid
  ] then
    raise exception 'location and keyword filters were not combined: ids %', matched_ids;
  end if;

  select array_agg(id order by published_at desc nulls last, id desc)
  into matched_ids
  from public.search_published_listings('', 'no match', 1, 10);
  if matched_ids is not null then
    raise exception 'expected no rows for an unmatched search, got %', matched_ids;
  end if;

  begin
    perform * from public.search_published_listings('', '', 0, 10);
    raise exception 'expected page zero to be rejected';
  exception
    when raise_exception then
      if sqlerrm <> 'Page must be a positive integer.' then raise; end if;
  end;

  begin
    perform * from public.search_published_listings('', '', 1, 25);
    raise exception 'expected page size above the cap to be rejected';
  exception
    when raise_exception then
      if sqlerrm <> 'Page size must be between 1 and 24.' then raise; end if;
  end;
end;
$$;

set local role anon;
do $$
declare
  visible_ids uuid[];
begin
  select array_agg(id order by published_at desc nulls last, id desc)
  into visible_ids
  from public.search_published_listings('', 'quartz', 1, 10);

  if visible_ids is distinct from array[
    '30000000-0000-4000-8000-000000000093'::uuid,
    '30000000-0000-4000-8000-000000000092'::uuid,
    '30000000-0000-4000-8000-000000000091'::uuid
  ] then
    raise exception 'anonymous search returned unexpected rows: %', visible_ids;
  end if;
end;
$$;
reset role;

alter table public.listings disable trigger set_listing_publication_timestamp;
update public.listings set published_at = '2026-01-03T00:00:00Z', capacity = 2
  where id = '30000000-0000-4000-8000-000000000091';
update public.listings set published_at = '2026-01-01T00:00:00Z', capacity = 5
  where id = '30000000-0000-4000-8000-000000000092';
update public.listings set published_at = '2026-01-02T00:00:00Z', capacity = 3
  where id = '30000000-0000-4000-8000-000000000093';
alter table public.listings enable trigger set_listing_publication_timestamp;

do $$
declare
  sorted_ids uuid[];
  actual_page integer;
  total bigint;
begin
  select array_agg(id), min(total_count)
  into sorted_ids, total
  from public.search_published_listings('', 'quartz', 1, 10, 'newest');
  if sorted_ids is distinct from array[
    '30000000-0000-4000-8000-000000000091'::uuid,
    '30000000-0000-4000-8000-000000000093'::uuid,
    '30000000-0000-4000-8000-000000000092'::uuid
  ] then
    raise exception 'newest sort failed: ids %', sorted_ids;
  end if;

  select array_agg(id) into sorted_ids
  from public.search_published_listings('', 'quartz', 1, 10, 'oldest');
  if sorted_ids is distinct from array[
    '30000000-0000-4000-8000-000000000092'::uuid,
    '30000000-0000-4000-8000-000000000093'::uuid,
    '30000000-0000-4000-8000-000000000091'::uuid
  ] then
    raise exception 'oldest sort failed: ids %', sorted_ids;
  end if;

  select array_agg(id) into sorted_ids
  from public.search_published_listings('', 'quartz', 1, 10, 'title');
  if sorted_ids is distinct from array[
    '30000000-0000-4000-8000-000000000091'::uuid,
    '30000000-0000-4000-8000-000000000093'::uuid,
    '30000000-0000-4000-8000-000000000092'::uuid
  ] then
    raise exception 'title sort failed: ids %', sorted_ids;
  end if;

  select array_agg(id) into sorted_ids
  from public.search_published_listings('', 'quartz', 1, 10, 'capacity');
  if sorted_ids is distinct from array[
    '30000000-0000-4000-8000-000000000092'::uuid,
    '30000000-0000-4000-8000-000000000093'::uuid,
    '30000000-0000-4000-8000-000000000091'::uuid
  ] then
    raise exception 'capacity sort failed: ids %', sorted_ids;
  end if;

  -- The sort applies across pages: page 2 continues the same ordering, with the search kept.
  select array_agg(id), min(page_number), min(total_count)
  into sorted_ids, actual_page, total
  from public.search_published_listings('', 'quartz', 2, 2, 'oldest');
  if sorted_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid]
    or actual_page is distinct from 2 or total is distinct from 3 then
    raise exception 'sorted page 2 failed: ids %, page %, total %', sorted_ids, actual_page, total;
  end if;

  select array_agg(id) into sorted_ids
  from public.search_published_listings('', 'quartz', 1, 10);
  if sorted_ids is distinct from array[
    '30000000-0000-4000-8000-000000000091'::uuid,
    '30000000-0000-4000-8000-000000000093'::uuid,
    '30000000-0000-4000-8000-000000000092'::uuid
  ] then
    raise exception 'omitted sort did not default to newest: ids %', sorted_ids;
  end if;

  begin
    perform * from public.search_published_listings('', '', 1, 10, 'price');
    raise exception 'expected an unknown sort to be rejected';
  exception
    when raise_exception then
      if sqlerrm <> 'Sort must be newest, oldest, title, or capacity.' then raise; end if;
  end;
end;
$$;

insert into public.listings (
  owner_id, title, location, description, capacity, accepted_pet_types, status
)
select
  '10000000-0000-4000-8000-000000000001',
  case when sequence_number = 2500 then 'Plan target sitter' else format('Listing search plan fixture %s', sequence_number) end,
  case when sequence_number = 2500 then 'Plan target district' else format('District %s', sequence_number) end,
  format('Description %s', sequence_number),
  1,
  array['dog']::public.pet_species[],
  'published'
from generate_series(1, 50000) as generated(sequence_number);

analyze public.listings;

do $$
declare
  title_plan jsonb;
  description_plan jsonb;
  location_plan jsonb;
  browse_plan jsonb;
begin
  execute $query$
    explain (analyze, buffers, format json)
    select id
    from public.listings
    where status = 'published'
      and deleted_at is null
      and title ilike '%plan target sitter%'
    order by published_at desc nulls last, id desc
    limit 9
  $query$ into title_plan;

  if position('listings_published_title_trgm_idx' in title_plan::text) = 0 then
    raise exception 'title plan did not use the title trigram index: %', title_plan;
  end if;
  raise notice 'title query plan used title trigram index';

  execute $query$
    explain (analyze, buffers, format json)
    select id
    from public.listings
    where status = 'published'
      and deleted_at is null
      and description ilike '%description 2500%'
    order by published_at desc nulls last, id desc
    limit 9
  $query$ into description_plan;

  if position('listings_published_description_trgm_idx' in description_plan::text) = 0 then
    raise exception 'description plan did not use the description trigram index: %', description_plan;
  end if;
  raise notice 'description query plan used description trigram index';

  execute $query$
    explain (analyze, buffers, format json)
    select id
    from public.listings
    where status = 'published'
      and deleted_at is null
      and location ilike '%plan target district%'
    order by published_at desc nulls last, id desc
    limit 9
  $query$ into location_plan;

  if position('listings_published_location_trgm_idx' in location_plan::text) = 0 then
    raise exception 'location plan did not use the location trigram index: %', location_plan;
  end if;
  raise notice 'location query plan used location trigram index';

  execute $query$
    explain (analyze, buffers, format json)
    select id
    from public.listings
    where status = 'published'
      and deleted_at is null
    order by published_at desc nulls last, id desc
    limit 9
  $query$ into browse_plan;

  if position('listings_published_order_idx' in browse_plan::text) = 0 then
    raise exception 'browse-all plan did not use the published ordering index: %', browse_plan;
  end if;
  raise notice 'browse-all query plan used published ordering index';
end;
$$;

rollback;
