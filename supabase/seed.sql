-- Deterministic local seed for PetSwap.
--
-- `npx supabase db reset` rebuilds Postgres from supabase/migrations/ and then
-- runs this file. It is for the local stack only: the identities below are
-- throwaway test accounts with one well-known password, never hosted data.
--
--   Test accounts (password for all three): petswap-local-dev
--     alex@petswap.test    hosts listings, owns pets, receives bookings
--     blair@petswap.test   hosts one listing, also requests bookings
--     casey@petswap.test   requests bookings, owns pets
--
-- Fixed UUIDs keep every run identical so tests and screenshots can refer to a
-- known listing or booking. Booking rows cover each lifecycle status plus a
-- back-to-back confirmed pair on one listing (end-exclusive dates, so they do
-- not conflict).
--
-- session_replication_role = replica disables triggers for the load: profiles
-- are inserted here rather than by the auth trigger, and bookings are seeded
-- directly in their final status instead of going through the pending-only
-- guard. CHECK and EXCLUDE constraints stay enforced, so a bad row still fails
-- the reset.

set session_replication_role = replica;

-- ---------------------------------------------------------------------------
-- Auth accounts
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  u.id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('petswap-local-dev', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', u.display_name),
  now(), now(),
  '', '', '', ''
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'alex@petswap.test',  'Alex Rivera'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'blair@petswap.test', 'Blair Chen'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'casey@petswap.test', 'Casey Ito')
) as u(id, email, display_name)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
from auth.users u
where u.email in ('alex@petswap.test', 'blair@petswap.test', 'casey@petswap.test')
on conflict (provider_id, provider) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
insert into public.profiles (
  id, display_name, username, phone_number, location, consent_version, consent_given_at
)
values
  ('10000000-0000-4000-8000-000000000001', 'Alex Rivera', 'alex',  '0800000001', 'Chiang Mai',   'demo-consent-1', now()),
  ('10000000-0000-4000-8000-000000000002', 'Blair Chen',  'blair', '0800000002', 'Bangkok',      'demo-consent-1', now()),
  ('10000000-0000-4000-8000-000000000003', 'Casey Ito',   'casey', '0800000003', 'Nonthaburi',   'demo-consent-1', now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Pets
-- ---------------------------------------------------------------------------
insert into public.pets (id, owner_id, name, species, breed, age_year, description)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Miso',   'cat', 'Domestic shorthair', 3, 'Shy but affectionate once settled.'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Nimbus', 'dog', 'Border collie',       5, 'High energy, needs a daily walk.'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Pixel',  'rabbit', 'Mini lop',          2, 'Litter trained, eats twice a day.'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'Rocket', 'dog', 'Beagle mix',          4, 'Friendly with other dogs.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Listings: published, draft, and a soft-deleted row
-- ---------------------------------------------------------------------------
insert into public.listings (
  id, owner_id, title, location, description, capacity, accepted_pet_types,
  facilities, status, published_at, deleted_at
)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'Sunny garden room', 'Chiang Mai',
   'Fenced garden, quiet street, daily photo updates for your pet.',
   2, array['dog', 'cat'], 'Fenced yard, crate available, vet 5 minutes away',
   'published', now(), null),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'Quiet studio with catio', 'Chiang Mai',
   'Enclosed balcony catio, calm home with no other pets.',
   1, array['cat'], 'Catio, litter provided',
   'published', now(), null),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
   'Countryside cottage', 'Bangkok',
   'Large open space and a big fenced field for dogs to run.',
   3, array['dog', 'rabbit'], 'Fenced field, indoor pen, daily walks',
   'published', now(), null),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
   'Beach house (draft)', 'Phuket',
   'Not published yet - used to check that drafts stay private.',
   2, array['dog'], null,
   'draft', null, null),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002',
   'Retired listing', 'Bangkok',
   'Soft-deleted row - used to check that deleted listings never appear.',
   1, array['cat'], null,
   'deleted', null, now())
on conflict (id) do nothing;

insert into public.listing_images (id, listing_id, storage_path, alt_text, sort_order)
values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001/main.jpg',   'Garden room with pet bed', 0),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001/garden.jpg', 'Fenced back garden',       1),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003/field.jpg',  'Open field for dogs',      0)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Bookings: one row per lifecycle status, plus a back-to-back confirmed pair
-- on listing 1 (2026-11-10..14 then 2026-11-14..18 - end-exclusive, no conflict)
-- ---------------------------------------------------------------------------
insert into public.bookings (
  id, listing_id, pet_id, requester_id, status, start_date, end_date,
  requester_note, owner_note, confirmed_at, declined_at, cancelled_at, completed_at
)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'pending',   date '2026-11-01', date '2026-11-04', 'First time away, will call to introduce Rocket.', null, null, null, null, null),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'confirmed', date '2026-11-10', date '2026-11-14', null, 'Happy to host Rocket again.', now(), null, null, null),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
   'confirmed', date '2026-11-14', date '2026-11-18', 'Pixel is quiet, mostly stays in her pen.', null, now(), null, null, null),
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'declined',  date '2026-11-05', date '2026-11-08', null, 'Sorry, only set up for cats here.', null, now(), null, null),
  ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
   'cancelled', date '2026-11-20', date '2026-11-23', 'Trip postponed, will rebook later.', null, null, null, now(), null),
  ('40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
   'completed', date '2026-09-01', date '2026-09-05', null, null, date '2026-08-20', null, null, now()),
  ('40000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'pending',   date '2026-12-01', date '2026-12-06', 'Nimbus needs a long daily walk.', null, null, null, null, null)
on conflict (id) do nothing;

reset session_replication_role;
