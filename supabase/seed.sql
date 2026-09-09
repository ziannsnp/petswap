-- Safe local demo seed.
-- Auth users are intentionally not inserted here. Create local users through
-- Supabase Studio or the app so auth.users owns identities and profiles are
-- created by the database trigger in the first migration.

insert into public.listings (
  id,
  owner_id,
  title,
  location,
  description,
  capacity,
  accepted_pet_types,
  facilities,
  status,
  published_at
)
select
  '00000000-0000-4000-8000-000000000101',
  p.id,
  'Demo sunny spare room',
  'Local demo neighborhood',
  'A deterministic local listing for smoke testing once a demo user exists.',
  2,
  array['dog', 'cat']::public.pet_species[],
  E'Fenced yard\nAir conditioning\nDaily photo updates',
  'published',
  now()
from public.profiles p
order by p.created_at
limit 1
on conflict (id) do nothing;
