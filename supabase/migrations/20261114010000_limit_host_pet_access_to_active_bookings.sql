-- A host could read a pet's row, including its care notes (medical notes, allergies,
-- behaviour, vaccinations), and its photos for as long as ANY booking for that pet existed
-- at one of their listings. That included requests they declined and requests the owner
-- cancelled, so declining a stranger's request granted permanent access to their pet's
-- medical information (found in the 14 Nov 2026 bug hunt).
--
-- Access now follows the booking: a host can read the pet while a request is pending (to
-- decide on it), while the stay is confirmed, and after it is completed (the stay
-- happened). Declined and cancelled bookings no longer grant access.
--
-- The same helper backs the pets SELECT policy "Listing owners can read pets booked at
-- their listings" and, through active_pet_is_booked_at_own_listing(), the pet-photos
-- storage policy "Listing owners can read booked pet photos", so both are fixed here.
-- The bookings list embeds pets with a left join, so a declined or cancelled booking now
-- arrives with pet = null for the host; the bookings screen handles that.

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
      and b.status in ('pending', 'confirmed', 'completed')
  );
$$;
