-- Tightens guard_booking_change with four rules the browser already implied but the
-- database did not enforce (found in the 14 Nov 2026 bug hunt):
--
--   1. A booking's pet must be a species the listing accepts. Only the request form
--      filtered pets, so a direct insert could book a dog at a cats-only listing.
--   2. The same pet cannot have two identical pending requests (same listing and
--      dates). A double submit or a retry after a lost response stored both. An
--      advisory lock on the pet serialises concurrent requests so the check holds
--      under a double click as well as a sequential retry. A partial unique index
--      would also work, but would fail this migration if production already holds
--      a duplicate, so the rule is enforced for new requests only.
--   3. A pending request cannot be confirmed once its start date has passed; the
--      host can still decline it. Before, a stay that started on 1 Nov could be
--      confirmed on 14 Nov.
--   4. A confirmed booking cannot be cancelled after its stay has ended
--      (end-exclusive: from the check-out day on). It can still be completed.
--
-- Everything else is unchanged from 20260913000000_reject_past_dated_bookings.sql.
-- current_date is the database's UTC day, the same convention as the past-date rule.

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

    if not exists (
      select 1
      from public.pets p
      join public.listings l on l.id = new.listing_id
      where p.id = new.pet_id
        and p.species = any (l.accepted_pet_types)
    ) then
      raise exception 'booking pet species is not accepted by this listing';
    end if;

    if new.start_date < current_date then
      raise exception 'booking start date cannot be in the past';
    end if;

    if new.status <> 'pending' then
      raise exception 'new bookings must start pending';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('booking-request:' || new.pet_id::text, 0));

    if exists (
      select 1 from public.bookings
      where pet_id = new.pet_id
        and listing_id = new.listing_id
        and start_date = new.start_date
        and end_date = new.end_date
        and status = 'pending'
    ) then
      raise exception 'an identical booking request is already pending';
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
    and new.status = 'confirmed'
    and actor = listing_owner then
    if old.start_date < current_date then
      raise exception 'a request whose start date has passed cannot be confirmed';
    end if;
    new.confirmed_at = now();
    return new;
  end if;

  if old.status = 'pending'
    and new.status = 'declined'
    and actor = listing_owner then
    new.declined_at = now();
    return new;
  end if;

  if old.status in ('pending', 'confirmed')
    and new.status = 'cancelled'
    and actor = old.requester_id then
    if old.status = 'confirmed' and current_date >= old.end_date then
      raise exception 'a stay that has ended cannot be cancelled';
    end if;
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
