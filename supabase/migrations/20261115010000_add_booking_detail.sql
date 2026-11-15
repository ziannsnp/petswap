-- Booking detail for the two participants of a booking (ADR 0011 decision 7, P-07).
--
-- The bookings list embeds pets and listings through RLS, which is not enough for a detail
-- screen: it must also show the other participant's safe profile, keep working when the
-- listing was unpublished or deleted, and keep showing a soft-deleted pet to the person who
-- owns it. This function does that on the server so the UI never decides who may see what.
--
-- Access: only the requester and the owner of the booked listing get a row. Anyone else
-- (another signed-in user, a signed-out caller, an unknown id) gets no rows, so a missing
-- booking and one that is not yours look identical. Anonymous callers have no execute right.
--
-- Pet: the requester always sees their own pet, soft-deleted or not (history). The host sees
-- it only while the booking is pending, confirmed or completed, the same rule as
-- pet_is_booked_at_own_listing(); after a decline or cancellation the pet columns are null.
--
-- Peer: display name, photo and location only. Never email or phone number.

create or replace function public.get_booking_detail(target_booking_id uuid)
returns table (
  id uuid,
  status public.booking_status,
  start_date date,
  end_date date,
  requester_note text,
  owner_note text,
  created_at timestamptz,
  confirmed_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  viewer_role text,
  listing_id uuid,
  listing_title text,
  listing_location text,
  listing_status public.listing_status,
  pet_id uuid,
  pet_name text,
  pet_species public.pet_species,
  pet_breed text,
  pet_age_year integer,
  pet_photo_url text,
  pet_description text,
  pet_feeding_instruction text,
  pet_medical_note text,
  pet_behavior_note text,
  pet_allergies text,
  pet_vaccination_info text,
  pet_special_requirement text,
  pet_deleted boolean,
  peer_id uuid,
  peer_display_name text,
  peer_photo_url text,
  peer_location text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    booking.id,
    booking.status,
    booking.start_date,
    booking.end_date,
    booking.requester_note,
    booking.owner_note,
    booking.created_at,
    booking.confirmed_at,
    booking.declined_at,
    booking.cancelled_at,
    booking.completed_at,
    case when booking.requester_id = auth.uid() then 'requester' else 'owner' end,
    listing.id,
    listing.title,
    listing.location,
    listing.status,
    pet.id,
    pet.name,
    pet.species,
    pet.breed,
    pet.age_year,
    pet.photo_url,
    pet.description,
    pet.feeding_instruction,
    pet.medical_note,
    pet.behavior_note,
    pet.allergies,
    pet.vaccination_info,
    pet.special_requirement,
    pet.deleted_at is not null,
    peer.id,
    peer.display_name,
    peer.photo_url,
    peer.location
  from public.bookings as booking
  join public.listings as listing on listing.id = booking.listing_id
  join public.profiles as peer
    on peer.id = case when booking.requester_id = auth.uid() then listing.owner_id else booking.requester_id end
  left join public.pets as pet
    on pet.id = booking.pet_id
    and (
      booking.requester_id = auth.uid()
      or booking.status in ('pending', 'confirmed', 'completed')
    )
  where booking.id = target_booking_id
    and auth.uid() is not null
    and (booking.requester_id = auth.uid() or listing.owner_id = auth.uid());
$$;

comment on function public.get_booking_detail(uuid) is
  'One booking for its requester or the listing owner: dates, status, notes, listing, pet with care notes, and the other participant''s display name, photo and location. No rows for anyone else.';

revoke all on function public.get_booking_detail(uuid) from public;
revoke all on function public.get_booking_detail(uuid) from anon;
grant execute on function public.get_booking_detail(uuid) to authenticated;
