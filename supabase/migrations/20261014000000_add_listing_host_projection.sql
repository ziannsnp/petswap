create or replace function public.get_listing_host(target_listing_id uuid)
returns table (
  id uuid,
  display_name text,
  photo_url text,
  location text
)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.display_name, profile.photo_url, profile.location
  from public.listings as listing
  join public.profiles as profile on profile.id = listing.owner_id
  where listing.id = target_listing_id
    and listing.deleted_at is null
    and (
      listing.status = 'published'
      or listing.owner_id = auth.uid()
    );
$$;

comment on function public.get_listing_host(uuid) is
  'Returns only public host profile fields for published listings or the current user''s own listings.';

revoke all on function public.get_listing_host(uuid) from public;
grant execute on function public.get_listing_host(uuid) to anon, authenticated;
