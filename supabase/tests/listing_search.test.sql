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
  select array_agg(id), min(total_count)
  into matched_ids, match_count
  from public.search_published_listings('', 'quartz', 1, 2);
  if matched_ids is distinct from array[
    '30000000-0000-4000-8000-000000000093'::uuid,
    '30000000-0000-4000-8000-000000000092'::uuid
  ] or match_count is distinct from 3 then
    raise exception 'keyword matching/order/page 1 failed: ids %, count %', matched_ids, match_count;
  end if;

  select array_agg(id), min(total_count)
  into matched_ids, match_count
  from public.search_published_listings('', 'QUARTZ', 2, 2);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid]
    or match_count is distinct from 3 then
    raise exception 'case-insensitive page 2 failed: ids %, count %', matched_ids, match_count;
  end if;

  select array_agg(id), min(page_number)
  into matched_ids, actual_page
  from public.search_published_listings('', 'quartz', 99, 2);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid]
    or actual_page is distinct from 2 then
    raise exception 'out-of-range page did not clamp to the last page: ids %, page %', matched_ids, actual_page;
  end if;

  select array_agg(id)
  into matched_ids
  from public.search_published_listings('100% district', '', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid] then
    raise exception 'case-insensitive location matching failed: ids %', matched_ids;
  end if;

  select array_agg(id)
  into matched_ids
  from public.search_published_listings('', '%', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid] then
    raise exception 'percent wildcard was not treated as literal text: ids %', matched_ids;
  end if;

  select array_agg(id)
  into matched_ids
  from public.search_published_listings('', '_', 1, 10);
  if matched_ids is distinct from array[
    '30000000-0000-4000-8000-000000000094'::uuid,
    '30000000-0000-4000-8000-000000000091'::uuid
  ] then
    raise exception 'underscore wildcard was not treated as literal text: ids %', matched_ids;
  end if;

  select array_agg(id)
  into matched_ids
  from public.search_published_listings('', E'\\', 1, 10);
  if matched_ids is distinct from array[
    '30000000-0000-4000-8000-000000000094'::uuid,
    '30000000-0000-4000-8000-000000000091'::uuid
  ] then
    raise exception 'backslash search did not match literally: ids %', matched_ids;
  end if;

  select array_agg(id)
  into matched_ids
  from public.search_published_listings('', '(', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid] then
    raise exception 'parenthesis search did not match literally: ids %', matched_ids;
  end if;

  select array_agg(id)
  into matched_ids
  from public.search_published_listings('', ', "quoted"', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid] then
    raise exception 'comma search did not match literally: ids %', matched_ids;
  end if;

  select array_agg(id)
  into matched_ids
  from public.search_published_listings('', '"', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000091'::uuid] then
    raise exception 'quote search did not match literally: ids %', matched_ids;
  end if;

  select array_agg(id)
  into matched_ids
  from public.search_published_listings('Chiang_Mai', '', 1, 10);
  if matched_ids is distinct from array['30000000-0000-4000-8000-000000000094'::uuid] then
    raise exception 'location underscore search did not match literally: ids %', matched_ids;
  end if;

  select array_agg(id)
  into matched_ids
  from public.search_published_listings('Bangkok', 'quartz', 1, 10);
  if matched_ids is distinct from array[
    '30000000-0000-4000-8000-000000000092'::uuid,
    '30000000-0000-4000-8000-000000000091'::uuid
  ] then
    raise exception 'location and keyword filters were not combined: ids %', matched_ids;
  end if;

  select array_agg(id)
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

explain (analyze, buffers, verbose)
select id
from public.listings
where status = 'published'
  and deleted_at is null
  and location ilike '%plan target district%'
  and (title ilike '%plan target%' or description ilike '%plan target%')
order by published_at desc nulls last, id desc
limit 9;

explain (analyze, buffers, verbose)
select id
from public.listings
where status = 'published'
  and deleted_at is null
  and location ilike '%plan target district%'
order by published_at desc nulls last, id desc
limit 9;

rollback;
