-- US-2.2: keep listing-photo edits valid even when a client is buggy or
-- malicious. The first image by sort_order is the listing's main photo.

-- The original trim-based checks only reject ordinary spaces. Require at
-- least one non-whitespace character so tabs and line breaks cannot satisfy a
-- required listing field during an edit.
alter table public.listings
  add constraint listings_title_nonblank_check
  check (title ~ '[^[:space:]]'),
  add constraint listings_location_nonblank_check
  check (location ~ '[^[:space:]]'),
  add constraint listings_description_nonblank_check
  check (description ~ '[^[:space:]]');

-- Existing rows predate ordered editing. Give every image a stable, contiguous
-- position before the uniqueness constraint is installed.
with ranked_images as (
  select
    id,
    row_number() over (
      partition by listing_id
      order by sort_order, created_at, id
    ) - 1 as normalized_sort_order
  from public.listing_images
)
update public.listing_images as image
set sort_order = ranked.normalized_sort_order
from ranked_images as ranked
where image.id = ranked.id
  and image.sort_order is distinct from ranked.normalized_sort_order;

do $$
begin
  if exists (
    select 1
    from public.listing_images
    group by listing_id
    having count(*) > 10
  ) then
    raise check_violation using
      message = 'Existing listing image metadata exceeds the ten-photo limit.',
      constraint = 'listing_images_max_ten_per_listing';
  end if;
end;
$$;

alter table public.listing_images
  add constraint listing_images_sort_order_nonnegative_check
  check (sort_order >= 0),
  add constraint listing_images_storage_path_matches_listing_check
  check (public.storage_folder_listing_id(storage_path) is not distinct from listing_id),
  add constraint listing_images_listing_sort_order_key
  unique (listing_id, sort_order)
  deferrable initially immediate;

create or replace function public.guard_listing_image_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.listing_id is distinct from old.listing_id
    or new.storage_path is distinct from old.storage_path
  ) then
    raise check_violation using
      message = 'A listing image cannot be moved to another listing or storage object.',
      constraint = 'listing_images_identity_immutable';
  end if;

  -- Inserts, deletes, direct ordering updates, and reorder_listing_images all
  -- take the same lock. This keeps the image set stable while it is validated.
  perform pg_advisory_xact_lock(
    hashtextextended(
      case when tg_op = 'DELETE' then old.listing_id else new.listing_id end::text,
      0
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'INSERT' and (
    select count(*)
    from public.listing_images
    where listing_id = new.listing_id
  ) >= 10 then
    raise check_violation using
      message = 'A listing can have at most 10 photos.',
      constraint = 'listing_images_max_ten_per_listing';
  end if;

  return new;
end;
$$;

create trigger guard_listing_image_change
before insert or update or delete on public.listing_images
for each row execute function public.guard_listing_image_change();

create or replace function public.reorder_listing_images(
  target_listing_id uuid,
  ordered_image_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  stored_image_count integer;
begin
  if auth.uid() is null or not public.current_user_owns_listing(target_listing_id) then
    raise insufficient_privilege using
      message = 'Only the listing owner can reorder listing photos.';
  end if;

  if ordered_image_ids is null then
    raise invalid_parameter_value using
      message = 'The complete ordered image list is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_listing_id::text, 0));

  select count(*)
  into stored_image_count
  from public.listing_images
  where listing_id = target_listing_id;

  -- Requiring the complete set makes omission, duplication, and cross-listing
  -- ids fail without partially changing which image is the main photo.
  if cardinality(ordered_image_ids) <> stored_image_count
    or exists (
      select 1
      from unnest(ordered_image_ids) as requested(image_id)
      where requested.image_id is null
        or not exists (
          select 1
          from public.listing_images as stored
          where stored.listing_id = target_listing_id
            and stored.id = requested.image_id
        )
    )
    or exists (
      select 1
      from unnest(ordered_image_ids) as requested(image_id)
      group by requested.image_id
      having count(*) > 1
    ) then
    raise invalid_parameter_value using
      message = 'Photo order must contain every listing image exactly once.';
  end if;

  set constraints listing_images_listing_sort_order_key deferred;

  update public.listing_images as image
  set sort_order = requested.position - 1
  from unnest(ordered_image_ids) with ordinality as requested(image_id, position)
  where image.listing_id = target_listing_id
    and image.id = requested.image_id;

  set constraints listing_images_listing_sort_order_key immediate;
end;
$$;

revoke all on function public.reorder_listing_images(uuid, uuid[]) from public;
grant execute on function public.reorder_listing_images(uuid, uuid[]) to authenticated;
