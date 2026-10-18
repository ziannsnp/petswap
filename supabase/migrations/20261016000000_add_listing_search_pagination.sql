create extension if not exists pg_trgm with schema extensions;

drop index if exists public.listings_public_search_idx;

create index listings_published_order_idx
  on public.listings (published_at desc nulls last, id desc)
  where status = 'published' and deleted_at is null;

create index listings_published_location_trgm_idx
  on public.listings using gin (location extensions.gin_trgm_ops)
  where status = 'published' and deleted_at is null;

create index listings_published_title_trgm_idx
  on public.listings using gin (title extensions.gin_trgm_ops)
  where status = 'published' and deleted_at is null;

create index listings_published_description_trgm_idx
  on public.listings using gin (description extensions.gin_trgm_ops)
  where status = 'published' and deleted_at is null;

create or replace function public.search_published_listings(
  p_location text,
  p_keyword text,
  p_page integer,
  p_page_size integer
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  location text,
  description text,
  capacity integer,
  accepted_pet_types public.pet_species[],
  facilities text,
  status public.listing_status,
  deleted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  page_number integer,
  total_count bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  location_pattern text;
  keyword_pattern text;
  total_rows bigint;
  resolved_page integer;
  row_offset bigint;
begin
  if p_page is null or p_page < 1 then
    raise exception 'Page must be a positive integer.';
  end if;

  if p_page_size is null or p_page_size < 1 or p_page_size > 24 then
    raise exception 'Page size must be between 1 and 24.';
  end if;

  if nullif(btrim(p_location), '') is not null then
    location_pattern := '%' || replace(
      replace(replace(btrim(p_location), E'\\', E'\\\\'), '%', E'\\%'),
      '_',
      E'\\_'
    ) || '%';
  end if;

  if nullif(btrim(p_keyword), '') is not null then
    keyword_pattern := '%' || replace(
      replace(replace(btrim(p_keyword), E'\\', E'\\\\'), '%', E'\\%'),
      '_',
      E'\\_'
    ) || '%';
  end if;

  select count(*)
  into total_rows
  from public.listings as listing
  where listing.status = 'published'
    and listing.deleted_at is null
    and (location_pattern is null or listing.location ilike location_pattern escape E'\\')
    and (
      keyword_pattern is null
      or listing.title ilike keyword_pattern escape E'\\'
      or listing.description ilike keyword_pattern escape E'\\'
    );

  resolved_page := case
    when total_rows = 0 then 1
    else least(
      p_page,
      greatest(1, ceil(total_rows::numeric / p_page_size)::integer)
    )
  end;
  row_offset := (resolved_page - 1)::bigint * p_page_size;

  return query
  select
    listing.id,
    listing.owner_id,
    listing.title,
    listing.location,
    listing.description,
    listing.capacity,
    listing.accepted_pet_types,
    listing.facilities,
    listing.status,
    listing.deleted_at,
    listing.published_at,
    listing.created_at,
    listing.updated_at,
    resolved_page,
    total_rows
  from public.listings as listing
  where listing.status = 'published'
    and listing.deleted_at is null
    and (location_pattern is null or listing.location ilike location_pattern escape E'\\')
    and (
      keyword_pattern is null
      or listing.title ilike keyword_pattern escape E'\\'
      or listing.description ilike keyword_pattern escape E'\\'
    )
  order by listing.published_at desc nulls last, listing.id desc
  limit p_page_size
  offset row_offset;
end;
$$;

revoke all on function public.search_published_listings(text, text, integer, integer) from public;
grant execute on function public.search_published_listings(text, text, integer, integer) to anon, authenticated, service_role;
