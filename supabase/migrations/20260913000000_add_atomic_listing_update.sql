create or replace function public.update_listing_with_images(
  target_listing_id uuid,
  new_title text,
  new_location text,
  new_description text,
  new_capacity integer,
  new_accepted_pet_types public.pet_species[],
  new_facilities text,
  new_status public.listing_status,
  new_published_at timestamptz,
  retained_image_ids uuid[],
  new_images jsonb,
  ordered_image_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  expected_image_count integer;
  current_image_count integer;
  new_image_count integer;
begin
  if auth.uid() is null or not public.current_user_owns_listing(target_listing_id) then
    raise insufficient_privilege using
      message = 'Only the listing owner can update a listing.';
  end if;

  if retained_image_ids is null or new_images is null or ordered_image_ids is null
    or jsonb_typeof(new_images) <> 'array' then
    raise invalid_parameter_value using
      message = 'A complete listing image set is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_listing_id::text, 0));

  select count(*) into current_image_count
  from public.listing_images
  where listing_id = target_listing_id;

  new_image_count := jsonb_array_length(new_images);
  expected_image_count := cardinality(retained_image_ids) + new_image_count;

  if expected_image_count > 10
    or cardinality(ordered_image_ids) <> expected_image_count then
    raise invalid_parameter_value using
      message = 'A listing can have at most 10 photos and the complete order is required.';
  end if;

  if exists (
    select 1
    from unnest(retained_image_ids) as requested(image_id)
    where requested.image_id is null
      or not exists (
        select 1
        from public.listing_images as stored
        where stored.listing_id = target_listing_id
          and stored.id = requested.image_id
      )
  ) or exists (
    select 1
    from unnest(retained_image_ids) as requested(image_id)
    group by requested.image_id
    having count(*) > 1
  ) then
    raise invalid_parameter_value using
      message = 'Retained photo ids must belong to the listing exactly once.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(new_images) as incoming(id uuid, storage_path text, alt_text text)
    where incoming.id is null
      or incoming.storage_path is null
      or public.storage_folder_listing_id(incoming.storage_path) is distinct from target_listing_id
  ) or exists (
    select 1
    from jsonb_to_recordset(new_images) as incoming(id uuid, storage_path text, alt_text text)
    group by incoming.id
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_to_recordset(new_images) as incoming(id uuid, storage_path text, alt_text text)
    where incoming.id = any(retained_image_ids)
  ) then
    raise invalid_parameter_value using
      message = 'New photo metadata is invalid for this listing.';
  end if;

  if current_image_count < cardinality(retained_image_ids)
    or exists (
      select 1
      from unnest(ordered_image_ids) as requested(image_id)
      where requested.image_id is null
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

  update public.listings
  set title = new_title,
      location = new_location,
      description = new_description,
      capacity = new_capacity,
      accepted_pet_types = new_accepted_pet_types,
      facilities = new_facilities,
      status = new_status,
      published_at = new_published_at
  where id = target_listing_id;

  delete from public.listing_images
  where listing_id = target_listing_id
    and not (id = any(retained_image_ids));

  insert into public.listing_images (id, listing_id, storage_path, alt_text, sort_order)
    select parsed.id,
         target_listing_id,
      parsed.storage_path,
      parsed.alt_text,
         coalesce((select max(sort_order) + 1 from public.listing_images where listing_id = target_listing_id), 0)
           + incoming.position - 1
  from jsonb_array_elements(new_images) with ordinality as incoming(payload, position)
  cross join lateral (
    select (incoming.payload ->> 'id')::uuid as id,
           incoming.payload ->> 'storage_path' as storage_path,
           incoming.payload ->> 'alt_text' as alt_text
  ) as parsed;

  if exists (
    select 1
    from unnest(ordered_image_ids) as requested(image_id)
    where not exists (
      select 1
      from public.listing_images as stored
      where stored.listing_id = target_listing_id
        and stored.id = requested.image_id
    )
  ) or exists (
    select 1
    from public.listing_images as stored
    where stored.listing_id = target_listing_id
      and not (stored.id = any(ordered_image_ids))
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

revoke all on function public.update_listing_with_images(
  uuid, text, text, text, integer, public.pet_species[], text,
  public.listing_status, timestamptz, uuid[], jsonb, uuid[]
) from public;
grant execute on function public.update_listing_with_images(
  uuid, text, text, text, integer, public.pet_species[], text,
  public.listing_status, timestamptz, uuid[], jsonb, uuid[]
) to authenticated;