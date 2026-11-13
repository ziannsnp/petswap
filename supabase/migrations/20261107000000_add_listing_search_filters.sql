-- Replace the old signature rather than adding a PostgREST overload. Defaulted
-- filters preserve existing four- and five-argument callers.
drop function public.search_published_listings(text, text, integer, integer, text);

create function public.search_published_listings(
  p_location text,
  p_keyword text,
  p_page integer,
  p_page_size integer,
  p_sort text default 'newest',
  p_pet_type public.pet_species default null,
  p_min_capacity integer default null,
  p_start_date date default null,
  p_end_date date default null
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
security definer
set search_path = ''
as $$
declare
  location_pattern text;
  keyword_pattern text;
  total_rows bigint;
  resolved_page integer;
  row_offset bigint;
  resolved_sort text := coalesce(p_sort, 'newest');
begin
  if p_page is null or p_page < 1 then
    raise exception 'Page must be a positive integer.';
  end if;
  if p_page_size is null or p_page_size < 1 or p_page_size > 24 then
    raise exception 'Page size must be between 1 and 24.';
  end if;
  if resolved_sort not in ('newest', 'oldest', 'title', 'capacity') then
    raise exception 'Sort must be newest, oldest, title, or capacity.';
  end if;
  if p_min_capacity is not null and p_min_capacity < 1 then
    raise exception 'Minimum capacity must be a positive integer.';
  end if;
  if (p_start_date is null) <> (p_end_date is null) then
    raise exception 'Choose both a start date and an end date.';
  end if;
  if not isfinite(p_start_date) or not isfinite(p_end_date) then
    raise exception 'Search dates must be finite calendar dates.';
  end if;
  if p_end_date <= p_start_date then
    raise exception 'End date must be later than the start date.';
  end if;

  if nullif(btrim(p_location), '') is not null then
    location_pattern := '%' || replace(
      replace(replace(btrim(p_location), E'\\', E'\\\\'), '%', E'\\%'),
      '_', E'\\_'
    ) || '%';
  end if;
  if nullif(btrim(p_keyword), '') is not null then
    keyword_pattern := '%' || replace(
      replace(replace(btrim(p_keyword), E'\\', E'\\\\'), '%', E'\\%'),
      '_', E'\\_'
    ) || '%';
  end if;

  -- Booking RLS intentionally hides other people's stays. This definer function
  -- checks all confirmed bookings but returns only published, undeleted listings,
  -- never booking dates, identities, or notes. Keep BOTH publication predicates.
  select count(*) into total_rows
  from public.listings as listing
  where listing.status = 'published'
    and listing.deleted_at is null
    and (location_pattern is null or listing.location ilike location_pattern escape E'\\')
    and (keyword_pattern is null
      or listing.title ilike keyword_pattern escape E'\\'
      or listing.description ilike keyword_pattern escape E'\\')
    and (p_pet_type is null or p_pet_type = any(listing.accepted_pet_types))
    and (p_min_capacity is null or listing.capacity >= p_min_capacity)
    and (p_start_date is null or not exists (
      select 1 from public.bookings as booking
      where booking.listing_id = listing.id
        and booking.status = 'confirmed'
        and daterange(booking.start_date, booking.end_date, '[)')
          && daterange(p_start_date, p_end_date, '[)')
    ));

  resolved_page := case
    when total_rows = 0 then 1
    else least(p_page, greatest(1, ceil(total_rows::numeric / p_page_size)::integer))
  end;
  row_offset := (resolved_page - 1)::bigint * p_page_size;

  return query
  select
    listing.id, listing.owner_id, listing.title, listing.location,
    listing.description, listing.capacity, listing.accepted_pet_types,
    listing.facilities, listing.status, listing.deleted_at, listing.published_at,
    listing.created_at, listing.updated_at, resolved_page, total_rows
  from public.listings as listing
  where listing.status = 'published'
    and listing.deleted_at is null
    and (location_pattern is null or listing.location ilike location_pattern escape E'\\')
    and (keyword_pattern is null
      or listing.title ilike keyword_pattern escape E'\\'
      or listing.description ilike keyword_pattern escape E'\\')
    and (p_pet_type is null or p_pet_type = any(listing.accepted_pet_types))
    and (p_min_capacity is null or listing.capacity >= p_min_capacity)
    and (p_start_date is null or not exists (
      select 1 from public.bookings as booking
      where booking.listing_id = listing.id
        and booking.status = 'confirmed'
        and daterange(booking.start_date, booking.end_date, '[)')
          && daterange(p_start_date, p_end_date, '[)')
    ))
  order by
    case when resolved_sort = 'oldest' then listing.published_at end asc nulls last,
    case when resolved_sort = 'title' then lower(listing.title) end asc,
    case when resolved_sort = 'capacity' then listing.capacity end desc,
    listing.published_at desc nulls last,
    listing.id desc
  limit p_page_size
  offset row_offset;
end;
$$;

revoke all on function public.search_published_listings(text, text, integer, integer, text, public.pet_species, integer, date, date) from public;
grant execute on function public.search_published_listings(text, text, integer, integer, text, public.pet_species, integer, date, date) to anon, authenticated, service_role;
