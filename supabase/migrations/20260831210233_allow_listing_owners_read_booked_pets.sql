-- FR-5.3: incoming bookings must display the requester's pet, but the pets
-- RLS policy ("Users manage their pets") only lets a pet's own owner read it.
-- Add a narrow, additive select policy so a listing owner can read a pet
-- only when that pet has a booking against one of their own listings.

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

create policy "Listing owners can read pets booked at their listings"
on public.pets for select
using (public.pet_is_booked_at_own_listing(id));
