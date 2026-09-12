-- Profile avatars are intentionally public so profile pages can render them with a stable URL.
-- Write access remains private: an object must live directly inside its owner's UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read avatars"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users upload own avatars"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and storage.foldername(name) = array[auth.uid()::text]
);

create policy "Users update own avatars"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and storage.foldername(name) = array[auth.uid()::text]
)
with check (
  bucket_id = 'avatars'
  and storage.foldername(name) = array[auth.uid()::text]
);

create policy "Users delete own avatars"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and storage.foldername(name) = array[auth.uid()::text]
);
