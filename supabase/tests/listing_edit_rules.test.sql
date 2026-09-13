\set ON_ERROR_STOP on

begin;

-- Alex owns listing ...002. A valid update proves the normal owner path before
-- the invalid and adversarial cases below.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  changed_rows integer;
begin
  update public.listings
  set
    title = 'Updated quiet studio',
    location = 'Chiang Mai',
    description = 'Updated details for cats.',
    capacity = 2,
    accepted_pet_types = array['cat']::public.pet_species[],
    facilities = E'Air-conditioned room\nSecurity cameras'
  where id = '30000000-0000-4000-8000-000000000002';

  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'listing edit: owner update changed % rows instead of 1', changed_rows;
  end if;
end;
$$;

do $$
declare
  violated_constraint text;
begin
  begin
    update public.listings
    set title = E'\t\n'
    where id = '30000000-0000-4000-8000-000000000002';
  exception
    when check_violation then
      get stacked diagnostics violated_constraint = constraint_name;
  end;

  if violated_constraint is distinct from 'listings_title_nonblank_check' then
    raise exception 'listing edit: whitespace-only title failed unexpected constraint %', violated_constraint;
  end if;
end;
$$;

do $$
declare
  violated_constraint text;
begin
  begin
    update public.listings
    set location = E'\n\t'
    where id = '30000000-0000-4000-8000-000000000002';
  exception
    when check_violation then
      get stacked diagnostics violated_constraint = constraint_name;
  end;

  if violated_constraint is distinct from 'listings_location_nonblank_check' then
    raise exception 'listing edit: whitespace-only location failed unexpected constraint %', violated_constraint;
  end if;
end;
$$;

do $$
declare
  violated_constraint text;
begin
  begin
    update public.listings
    set description = E'\r\n\t'
    where id = '30000000-0000-4000-8000-000000000002';
  exception
    when check_violation then
      get stacked diagnostics violated_constraint = constraint_name;
  end;

  if violated_constraint is distinct from 'listings_description_nonblank_check' then
    raise exception 'listing edit: whitespace-only description failed unexpected constraint %', violated_constraint;
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    update public.listings
    set capacity = 0
    where id = '30000000-0000-4000-8000-000000000002';
  exception
    when check_violation then rejected := true;
  end;

  if not rejected then
    raise exception 'listing edit: zero capacity was accepted';
  end if;
end;
$$;

do $$
declare
  violated_constraint text;
begin
  begin
    update public.listings
    set accepted_pet_types = '{}'::public.pet_species[]
    where id = '30000000-0000-4000-8000-000000000002';
  exception
    when check_violation then
      get stacked diagnostics violated_constraint = constraint_name;
  end;

  if violated_constraint is distinct from 'listings_accepted_pet_types_not_empty_check' then
    raise exception 'listing edit: empty pet types failed unexpected constraint %', violated_constraint;
  end if;
end;
$$;

do $$
declare
  violated_constraint text;
begin
  begin
    insert into public.listing_images (listing_id, storage_path, sort_order)
    values (
      '30000000-0000-4000-8000-000000000002',
      'not-a-listing-folder/invalid.jpg',
      3
    );
  exception
    when check_violation then
      get stacked diagnostics violated_constraint = constraint_name;
  end;

  if violated_constraint is distinct from 'listing_images_storage_path_matches_listing_check' then
    raise exception 'listing edit: malformed photo path failed unexpected constraint %', violated_constraint;
  end if;
end;
$$;

do $$
declare
  violated_constraint text;
begin
  begin
    insert into public.listing_images (listing_id, storage_path, sort_order)
    values (
      '30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000002/negative-position.jpg',
      -1
    );
  exception
    when check_violation then
      get stacked diagnostics violated_constraint = constraint_name;
  end;

  if violated_constraint is distinct from 'listing_images_sort_order_nonnegative_check' then
    raise exception 'listing edit: negative photo position failed unexpected constraint %', violated_constraint;
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    update public.listings
    set owner_id = '10000000-0000-4000-8000-000000000002'
    where id = '30000000-0000-4000-8000-000000000002';
  exception
    when insufficient_privilege then rejected := true;
  end;

  if not rejected then
    raise exception 'listing edit: owner transfer was accepted';
  end if;
end;
$$;

insert into public.listing_images (id, listing_id, storage_path, sort_order)
values
  ('50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002/one.jpg', 0),
  ('50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002/two.jpg', 1),
  ('50000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002/three.jpg', 2);

select public.update_listing_with_images(
  '30000000-0000-4000-8000-000000000002',
  'Atomic update title',
  'Chiang Mai',
  'Atomic update description.',
  3,
  array['dog']::public.pet_species[],
  E'Lawn\nSecurity cameras',
  'published',
  '2026-09-13T00:00:00Z'::timestamptz,
  array[
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000003'
  ]::uuid[],
  '[]'::jsonb,
  array[
    '50000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002'
  ]::uuid[]
);

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.update_listing_with_images(
      '30000000-0000-4000-8000-000000000002',
      'Should roll back',
      'Chiang Mai',
      'This update must not persist.',
      3,
      array['dog']::public.pet_species[],
      null,
      'published',
      null,
      array[
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000002',
        '50000000-0000-4000-8000-000000000003'
      ]::uuid[],
      '[]'::jsonb,
      array[
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000002'
      ]::uuid[]
    );
  exception
    when invalid_parameter_value then rejected := true;
  end;

  if not rejected then
    raise exception 'listing edit: invalid atomic update was accepted';
  end if;

  if (select title from public.listings where id = '30000000-0000-4000-8000-000000000002')
    is distinct from 'Atomic update title' then
    raise exception 'listing edit: failed atomic update changed listing fields';
  end if;
end;
$$;

do $$
declare
  violated_constraint text;
begin
  begin
    insert into public.listing_images (listing_id, storage_path, sort_order)
    values (
      '30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000002/duplicate-position.jpg',
      0
    );
  exception
    when unique_violation then
      get stacked diagnostics violated_constraint = constraint_name;
  end;

  if violated_constraint is distinct from 'listing_images_listing_sort_order_key' then
    raise exception 'listing edit: duplicate photo position failed unexpected constraint %', violated_constraint;
  end if;
end;
$$;

select public.reorder_listing_images(
  '30000000-0000-4000-8000-000000000002',
  array[
    '50000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002'
  ]::uuid[]
);

do $$
begin
  if (
    select id
    from public.listing_images
    where listing_id = '30000000-0000-4000-8000-000000000002'
    order by sort_order
    limit 1
  ) is distinct from '50000000-0000-4000-8000-000000000003'::uuid then
    raise exception 'listing edit: main photo did not change atomically';
  end if;
end;
$$;

-- Test new-photo path: add a new image, retain two existing images, and drop one
-- Verify: new image gets sort_order=0, dropped image is removed, and listing has exactly 3 images
do $$
declare
  new_image_id uuid := gen_random_uuid();
  image_count integer;
  new_image_sort_order integer;
  dropped_image_exists boolean;
begin
  select public.update_listing_with_images(
    '30000000-0000-4000-8000-000000000002',
    'New photo test',
    'Chiang Mai',
    'Testing new photo insertion.',
    3,
    array['dog']::public.pet_species[],
    'Lawn',
    'published',
    '2026-09-13T00:00:00Z'::timestamptz,
    array[
      '50000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000002'
    ]::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'id', new_image_id,
        'storage_path', '30000000-0000-4000-8000-000000000002/four.jpg',
        'alt_text', null
      )
    ),
    array[
      new_image_id,
      '50000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000002'
    ]::uuid[]
  );

  -- Assert new image has sort_order = 0
  select sort_order into new_image_sort_order
  from public.listing_images
  where id = new_image_id;

  if new_image_sort_order is distinct from 0 then
    raise exception 'listing edit: new image has sort_order % instead of 0', new_image_sort_order;
  end if;

  -- Assert image ...003 no longer exists
  select exists(
    select 1
    from public.listing_images
    where id = '50000000-0000-4000-8000-000000000003'
  ) into dropped_image_exists;

  if dropped_image_exists then
    raise exception 'listing edit: dropped image ...003 still exists';
  end if;

  -- Assert listing has exactly 3 images
  select count(*) into image_count
  from public.listing_images
  where listing_id = '30000000-0000-4000-8000-000000000002';

  if image_count is distinct from 3 then
    raise exception 'listing edit: listing has % images instead of 3', image_count;
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.reorder_listing_images(
      '30000000-0000-4000-8000-000000000002',
      array[
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000003'
      ]::uuid[]
    );
  exception
    when invalid_parameter_value then rejected := true;
  end;

  if not rejected then
    raise exception 'listing edit: duplicate photo order was accepted';
  end if;
end;
$$;

do $$
declare
  violated_constraint text;
begin
  begin
    insert into public.listing_images (listing_id, storage_path, sort_order)
    values (
      '30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000003/wrong-owner-path.jpg',
      3
    );
  exception
    when check_violation then
      get stacked diagnostics violated_constraint = constraint_name;
  end;

  if violated_constraint is distinct from 'listing_images_storage_path_matches_listing_check' then
    raise exception 'listing edit: mismatched photo path failed unexpected constraint %', violated_constraint;
  end if;
end;
$$;

do $$
declare
  violated_constraint text;
begin
  begin
    update public.listing_images
    set storage_path = '30000000-0000-4000-8000-000000000002/replacement.jpg'
    where id = '50000000-0000-4000-8000-000000000001';
  exception
    when check_violation then
      get stacked diagnostics violated_constraint = constraint_name;
  end;

  if violated_constraint is distinct from 'listing_images_identity_immutable' then
    raise exception 'listing edit: in-place photo replacement failed unexpected constraint %', violated_constraint;
  end if;
end;
$$;

-- Use Alex's draft listing to prove the database rejects an eleventh image even
-- if a client bypasses browser validation.
insert into public.listing_images (listing_id, storage_path, sort_order)
select
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000004/photo-' || position || '.jpg',
  position - 1
from generate_series(1, 10) as positions(position);

do $$
declare
  violated_constraint text;
begin
  begin
    insert into public.listing_images (listing_id, storage_path, sort_order)
    values (
      '30000000-0000-4000-8000-000000000004',
      '30000000-0000-4000-8000-000000000004/photo-11.jpg',
      10
    );
  exception
    when check_violation then
      get stacked diagnostics violated_constraint = constraint_name;
  end;

  if violated_constraint is distinct from 'listing_images_max_ten_per_listing' then
    raise exception 'listing edit: eleventh photo failed unexpected constraint %', violated_constraint;
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
  changed_rows integer;
  rejected_reorder boolean := false;
  rejected_image_insert boolean := false;
  rejected_listing_update boolean := false;
begin
  update public.listings
  set title = 'Unauthorized change'
  where id = '30000000-0000-4000-8000-000000000002';
  get diagnostics changed_rows = row_count;

  if changed_rows <> 0 then
    raise exception 'listing edit: non-owner changed % listing rows', changed_rows;
  end if;

  begin
    perform public.update_listing_with_images(
      '30000000-0000-4000-8000-000000000002',
      'Unauthorized RPC update',
      'Chiang Mai',
      'Should not persist.',
      2,
      array['dog']::public.pet_species[],
      null,
      'published',
      null,
      array[
        '50000000-0000-4000-8000-000000000003',
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000002'
      ]::uuid[],
      '[]'::jsonb,
      array[
        '50000000-0000-4000-8000-000000000003',
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000002'
      ]::uuid[]
    );
  exception
    when insufficient_privilege then rejected_listing_update := true;
  end;

  begin
    perform public.reorder_listing_images(
      '30000000-0000-4000-8000-000000000002',
      array[
        '50000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000002',
        '50000000-0000-4000-8000-000000000003'
      ]::uuid[]
    );
  exception
    when insufficient_privilege then rejected_reorder := true;
  end;

  begin
    insert into public.listing_images (listing_id, storage_path, sort_order)
    values (
      '30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000002/intruder.jpg',
      3
    );
  exception
    when insufficient_privilege then rejected_image_insert := true;
  end;

  if not rejected_listing_update or not rejected_reorder or not rejected_image_insert then
    raise exception 'listing edit: non-owner photo mutation was accepted';
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

update public.listings
set status = 'deleted', deleted_at = '2026-09-13T00:00:00Z'::timestamptz
where id = '30000000-0000-4000-8000-000000000002';

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.update_listing_with_images(
      '30000000-0000-4000-8000-000000000002',
      'Deleted listing update',
      'Chiang Mai',
      'Should not persist.',
      2,
      array['dog']::public.pet_species[],
      null,
      'published',
      null,
      array[]::uuid[],
      '[]'::jsonb,
      array[]::uuid[]
    );
  exception
    when insufficient_privilege then rejected := true;
  end;

  if not rejected then
    raise exception 'listing edit: owner updated a soft-deleted listing';
  end if;
end;
$$;

reset role;
rollback;
