update storage.buckets
set public = false
where id = 'listing-photos';

create policy "Listing owners read private listing photos"
on storage.objects for select
using (
  bucket_id = 'listing-photos'
  and public.current_user_owns_listing(public.storage_folder_listing_id(name))
);

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
set search_path = public
as $$
  select
    profile.id,
    profile.display_name,
    profile.photo_url,
    profile.location
  from public.listings as listing
  join public.profiles as profile on profile.id = listing.owner_id
  where listing.id = target_listing_id
    and listing.status <> 'deleted'
    and listing.deleted_at is null
    and (
      listing.status = 'published'
      or listing.owner_id = auth.uid()
    );
$$;

revoke all on function public.get_listing_host(uuid) from public;
grant execute on function public.get_listing_host(uuid) to anon, authenticated;
