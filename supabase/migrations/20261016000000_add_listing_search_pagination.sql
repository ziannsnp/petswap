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

  return query
  with filtered as not materialized (
    select listing.*
    from public.listings as listing
    where listing.status = 'published'
      and listing.deleted_at is null
      and (location_pattern is null or listing.location ilike location_pattern escape E'\\')
      and (
        keyword_pattern is null
        or listing.title ilike keyword_pattern escape E'\\'
        or listing.description ilike keyword_pattern escape E'\\'
      )
  ),
  result_count as (
    select count(*) as total_count from filtered
  ),
  page_state as (
    select
      result_count.total_count,
      case
        when result_count.total_count = 0 then 1
        else least(
          p_page,
          greatest(1, ceil(result_count.total_count::numeric / p_page_size)::integer)
        )
      end as page_number
    from result_count
  ),
  page_rows as (
    select filtered.*
    from filtered
    cross join page_state
    order by filtered.published_at desc nulls last, filtered.id desc
    limit p_page_size
    offset ((page_state.page_number - 1)::bigint * p_page_size)
  )
  select
    page_rows.id,
    page_rows.owner_id,
    page_rows.title,
    page_rows.location,
    page_rows.description,
    page_rows.capacity,
    page_rows.accepted_pet_types,
    page_rows.facilities,
    page_rows.status,
    page_rows.deleted_at,
    page_rows.published_at,
    page_rows.created_at,
    page_rows.updated_at,
    page_state.page_number,
    page_state.total_count
  from page_state
  join page_rows on true;
end;
$$;

revoke all on function public.search_published_listings(text, text, integer, integer) from public;
grant execute on function public.search_published_listings(text, text, integer, integer) to anon, authenticated, service_role;
