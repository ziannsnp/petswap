-- Owner-only listing operations are for signed-in users. Supabase's default
-- privileges grant EXECUTE on new public functions to anon directly, so the
-- earlier `revoke all ... from public` statements did not remove it. Each
-- operation still refuses a caller without auth.uid(); this makes the grant
-- say the same thing.

revoke execute on function public.delete_listing_with_active_booking_check(uuid) from anon;

revoke execute on function public.reorder_listing_images(uuid, uuid[]) from anon;

revoke execute on function public.update_listing_with_images(
  uuid, text, text, text, integer, public.pet_species[], text,
  public.listing_status, timestamptz, uuid[], jsonb, uuid[]
) from anon;
