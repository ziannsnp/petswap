create or replace function public.lock_listing_for_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.listing_id::text, 0));
  return new;
end;
$$;

create trigger bookings_lock_listing_before_guard
before insert on public.bookings
for each row execute function public.lock_listing_for_booking_insert();

create or replace function public.delete_listing_with_active_booking_check(target_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_owner uuid;
  current_status public.listing_status;
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'You must be signed in to delete a listing.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_listing_id::text, 0));

  select owner_id, status
  into listing_owner, current_status
  from public.listings
  where id = target_listing_id
  for update;

  if not found or listing_owner is distinct from auth.uid() then
    raise insufficient_privilege using message = 'Only the listing owner can delete this listing.';
  end if;

  if current_status = 'deleted' then
    raise exception using errcode = 'P0001', message = 'Listing is already deleted.';
  end if;

  if exists (
    select 1
    from public.bookings
    where listing_id = target_listing_id
      and status in ('pending', 'confirmed')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Listing has active bookings and cannot be deleted.';
  end if;

  update public.listings
  set status = 'deleted',
      deleted_at = now()
  where id = target_listing_id;
end;
$$;

revoke all on function public.delete_listing_with_active_booking_check(uuid) from public;
grant execute on function public.delete_listing_with_active_booking_check(uuid) to authenticated;

drop policy if exists "Owners update own listings" on public.listings;
create policy "Owners update own listings"
on public.listings for update
using (owner_id = auth.uid() and status <> 'deleted')
with check (owner_id = auth.uid() and status <> 'deleted');

drop policy if exists "Owners delete own listings" on public.listings;