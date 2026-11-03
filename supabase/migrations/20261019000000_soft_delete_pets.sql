-- FR-2.1: an owner can delete a pet once none of its bookings is still active.
-- bookings.pet_id stays ON DELETE RESTRICT, so booking history keeps its pet: a
-- deleted pet's row stays for those bookings, and the owner no longer sees it.
-- Follows listing deletion (20261006000000_enforce_listing_deletion_rules.sql).

alter table public.pets add column deleted_at timestamptz;

-- Replace the single "for all" policy so a deleted pet can be read (booking
-- history) but not changed, and so deleted_at is only ever set by the RPC below.
drop policy if exists "Users manage their pets" on public.pets;

create policy "Owners read own pets"
on public.pets for select
using (owner_id = auth.uid());

create policy "Owners create own pets"
on public.pets for insert
with check (owner_id = auth.uid() and deleted_at is null);

create policy "Owners update own pets"
on public.pets for update
using (owner_id = auth.uid() and deleted_at is null)
with check (owner_id = auth.uid() and deleted_at is null);

-- A hard delete stays available: the foreign key refuses it while any booking
-- references the pet, which is stricter than the RPC's active-booking check.
-- createPet() uses it to roll back a pet whose photo upload failed.
create policy "Owners delete own pets"
on public.pets for delete
using (owner_id = auth.uid());

-- Booking inserts lock the pet row, so a request cannot slip in between the
-- RPC's active-booking check and its soft delete. Named to sort before
-- guard_booking_insert, like bookings_lock_listing_before_guard.
create or replace function public.lock_pet_for_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pet_owner uuid;
  current_deleted_at timestamptz;
begin
  select owner_id, deleted_at
  into pet_owner, current_deleted_at
  from public.pets
  where id = new.pet_id
  for share;

  -- A missing pet or someone else's is left to guard_booking_change, which rejects
  -- it without saying whether that pet was deleted.
  if found and pet_owner = auth.uid() and current_deleted_at is not null then
    raise exception 'booking pet has been deleted';
  end if;

  return new;
end;
$$;

revoke all on function public.lock_pet_for_booking_insert() from public, anon, authenticated, service_role;

create trigger bookings_lock_pet_before_guard
before insert on public.bookings
for each row execute function public.lock_pet_for_booking_insert();

-- Soft-deletes the caller's pet and returns its old photo path, so the app can
-- remove the file while the row still proves ownership to the storage policy.
create or replace function public.delete_pet_with_active_booking_check(target_pet_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pet_owner uuid;
  current_deleted_at timestamptz;
  old_photo_url text;
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'You must be signed in to delete a pet.';
  end if;

  select owner_id, deleted_at, photo_url
  into pet_owner, current_deleted_at, old_photo_url
  from public.pets
  where id = target_pet_id
  for update;

  if not found or pet_owner is distinct from auth.uid() then
    raise insufficient_privilege using message = 'Only the pet owner can delete this pet.';
  end if;

  if current_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'Pet is already deleted.';
  end if;

  if exists (
    select 1
    from public.bookings
    where pet_id = target_pet_id
      and status in ('pending', 'confirmed')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Pet has active bookings and cannot be deleted.';
  end if;

  update public.pets
  set deleted_at = now(),
      photo_url = null
  where id = target_pet_id;

  return old_photo_url;
end;
$$;

-- Pet photos of a deleted pet: nobody may add or replace one, and past hosts may
-- no longer read one, so a file left behind by a failed cleanup stays private.
-- The owner keeps read and delete, because the Storage API needs both to remove
-- the file after the RPC above (its remove() selects the object before deleting).
-- Like current_user_owns_pet() and pet_is_booked_at_own_listing(), each helper only
-- answers about the caller's own pets or listings, so it reveals nothing new.
create or replace function public.current_user_owns_active_pet(target_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pets
    where id = target_pet_id
      and owner_id = auth.uid()
      and deleted_at is null
  );
$$;

create or replace function public.active_pet_is_booked_at_own_listing(target_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.pet_is_booked_at_own_listing(target_pet_id)
    and exists (
      select 1
      from public.pets
      where id = target_pet_id
        and deleted_at is null
    );
$$;

grant execute on function public.current_user_owns_active_pet(uuid) to authenticated, anon;
grant execute on function public.active_pet_is_booked_at_own_listing(uuid) to authenticated, anon;

drop policy if exists "Listing owners can read booked pet photos" on storage.objects;
create policy "Listing owners can read booked pet photos"
on storage.objects for select
using (
  bucket_id = 'pet-photos'
  and public.active_pet_is_booked_at_own_listing(public.storage_folder_pet_id(name))
);

drop policy if exists "Pet owners can upload pet photos" on storage.objects;
create policy "Pet owners can upload pet photos"
on storage.objects for insert
with check (
  bucket_id = 'pet-photos'
  and public.current_user_owns_active_pet(public.storage_folder_pet_id(name))
);

drop policy if exists "Pet owners can update pet photos" on storage.objects;
create policy "Pet owners can update pet photos"
on storage.objects for update
using (
  bucket_id = 'pet-photos'
  and public.current_user_owns_active_pet(public.storage_folder_pet_id(name))
)
with check (
  bucket_id = 'pet-photos'
  and public.current_user_owns_active_pet(public.storage_folder_pet_id(name))
);

revoke all on function public.delete_pet_with_active_booking_check(uuid) from public;
-- Supabase grants EXECUTE on new public functions to anon directly; see
-- 20261015000000_revoke_anon_owner_rpc_access.sql.
revoke execute on function public.delete_pet_with_active_booking_check(uuid) from anon;
grant execute on function public.delete_pet_with_active_booking_check(uuid) to authenticated;
