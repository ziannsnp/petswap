-- Reject booking requests whose stay has already started.
--
-- Raised in review of PR #43: the only window rule anywhere in the stack was
-- `start_date < end_date`, so a fully past-dated stay was accepted by the form,
-- the API, and the table's check constraint alike.
--
-- INSERT branch only: existing rows keep their dates (they are immutable after
-- request anyway), and confirm/decline/cancel/complete still work on bookings
-- whose start date has since passed. `current_date` is the database's UTC day,
-- so this is the backstop; RequestBookingForm applies the visitor's local day.

create or replace function public.guard_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  listing_owner uuid;
begin
  select owner_id into listing_owner
  from public.listings
  where id = coalesce(new.listing_id, old.listing_id);

  if tg_op = 'INSERT' then
    if actor is null or new.requester_id <> actor then
      raise exception 'booking requester must be the authenticated user';
    end if;

    if not exists (
      select 1 from public.pets
      where id = new.pet_id and owner_id = actor
    ) then
      raise exception 'booking pet must belong to requester';
    end if;

    if listing_owner is null or listing_owner = actor then
      raise exception 'requester cannot book their own or missing listing';
    end if;

    if not public.listing_is_public(new.listing_id) then
      raise exception 'booking listing must be published';
    end if;

    if new.start_date < current_date then
      raise exception 'booking start date cannot be in the past';
    end if;

    if new.status <> 'pending' then
      raise exception 'new bookings must start pending';
    end if;

    return new;
  end if;

  if new.listing_id <> old.listing_id
    or new.pet_id <> old.pet_id
    or new.requester_id <> old.requester_id
    or new.start_date <> old.start_date
    or new.end_date <> old.end_date then
    raise exception 'booking ownership, pet, listing, and dates are immutable after request';
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status = 'pending'
    and new.status in ('confirmed', 'declined')
    and actor = listing_owner then
    if new.status = 'confirmed' then
      new.confirmed_at = now();
    else
      new.declined_at = now();
    end if;
    return new;
  end if;

  if old.status in ('pending', 'confirmed')
    and new.status = 'cancelled'
    and actor = old.requester_id then
    new.cancelled_at = now();
    return new;
  end if;

  if old.status = 'confirmed'
    and new.status = 'completed'
    and actor = listing_owner
    and current_date >= old.end_date then
    new.completed_at = now();
    return new;
  end if;

  raise exception 'invalid booking status transition';
end;
$$;
