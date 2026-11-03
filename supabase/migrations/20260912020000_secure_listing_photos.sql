update storage.buckets
set public = false
where id = 'listing-photos';

create policy "Listing owners read private listing photos"
on storage.objects for select
using (
  bucket_id = 'listing-photos'
  and public.current_user_owns_listing(public.storage_folder_listing_id(name))
);
