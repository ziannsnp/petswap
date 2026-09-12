\set ON_ERROR_STOP on

begin;

insert into public.listings (
  id,
  owner_id,
  title,
  location,
  description,
  capacity,
  accepted_pet_types,
  facilities,
  status
) values (
  '30000000-0000-4000-8000-000000000098',
  '10000000-0000-4000-8000-000000000001',
  'Legacy facility labels',
  'Chiang Mai',
  'A transaction-scoped fixture for the facility-label backfill.',
  1,
  array['dog']::public.pet_species[],
  E'Fenced yard\nAir conditioning\nSecurity cameras\nIndoor play area\nDaily photo updates\nNear a vet clinic\nCustom pool\nLawn',
  'draft'
);

-- The migration is deliberately idempotent, so rerunning it against this fixture
-- exercises the same transformation that production data receives during deployment.
\ir ../migrations/20260912030000_migrate_listing_facility_labels.sql

do $$
declare
  migrated_facilities text;
begin
  select facilities
  into migrated_facilities
  from public.listings
  where id = '30000000-0000-4000-8000-000000000098';

  if migrated_facilities is distinct from E'Lawn\nAir-conditioned room\nSecurity cameras\nEnclosed fence\nDaily photo updates\nNear a veterinary clinic\nCustom pool' then
    raise exception 'facility migration produced unexpected value: %', migrated_facilities;
  end if;
end
$$;

rollback;
