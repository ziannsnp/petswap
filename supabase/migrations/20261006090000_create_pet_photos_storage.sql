-- FR-2.1 / FR-5.3: Private 'pet-photos' Storage bucket + RLS
-- Pet owners manage photos of their own pets (CRUD).
-- A listing owner with a booking for a pet can read (SELECT) that pet's photo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-photos',
  'pet-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Helper to extract the pet UUID from the top-level folder name (e.g. "<pet_id>/photo.jpg")
create or replace function public.storage_folder_pet_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

-- Helper to verify if the currently authenticated user owns the pet
create or replace function public.current_user_owns_pet(target_pet_id uuid)
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
  );
$$;

-- Helper to verify if a listing owner has a booking for the target pet
create or replace function public.pet_is_booked_at_own_listing(target_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    join public.listings l on l.id = b.listing_id
    where b.pet_id = target_pet_id
      and l.owner_id = auth.uid()
  );
$$;

grant execute on function public.storage_folder_pet_id(text) to authenticated, anon;
grant execute on function public.current_user_owns_pet(uuid) to authenticated, anon;
grant execute on function public.pet_is_booked_at_own_listing(uuid) to authenticated, anon;

-- Clean up existing policies for idempotency
drop policy if exists "Pet owners can read pet photos" on storage.objects;
drop policy if exists "Listing owners can read booked pet photos" on storage.objects;
drop policy if exists "Pet owners can upload pet photos" on storage.objects;
drop policy if exists "Pet owners can update pet photos" on storage.objects;
drop policy if exists "Pet owners can delete pet photos" on storage.objects;

-- Read policies:
-- 1. Pet owners can read photos of their own pets
create policy "Pet owners can read pet photos"
on storage.objects for select
using (
  bucket_id = 'pet-photos'
  and public.current_user_owns_pet(public.storage_folder_pet_id(name))
);

-- 2. Listing owners can read photos of pets booked at their listings
create policy "Listing owners can read booked pet photos"
on storage.objects for select
using (
  bucket_id = 'pet-photos'
  and public.pet_is_booked_at_own_listing(public.storage_folder_pet_id(name))
);

-- Write policies (owner CRUD):
-- 3. Pet owners can upload (insert) pet photos
create policy "Pet owners can upload pet photos"
on storage.objects for insert
with check (
  bucket_id = 'pet-photos'
  and public.current_user_owns_pet(public.storage_folder_pet_id(name))
);

-- 4. Pet owners can update pet photos
create policy "Pet owners can update pet photos"
on storage.objects for update
using (
  bucket_id = 'pet-photos'
  and public.current_user_owns_pet(public.storage_folder_pet_id(name))
)
with check (
  bucket_id = 'pet-photos'
  and public.current_user_owns_pet(public.storage_folder_pet_id(name))
);

-- 5. Pet owners can delete pet photos
create policy "Pet owners can delete pet photos"
on storage.objects for delete
using (
  bucket_id = 'pet-photos'
  and public.current_user_owns_pet(public.storage_folder_pet_id(name))
);
