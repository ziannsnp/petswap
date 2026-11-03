-- FR-4.2 filters listings by the pet type a booking is for, so a listing's
-- accepted_pet_types has to be comparable to pets.species. The two columns had
-- drifted: pets.species is the pet_species enum ('dog', 'cat', ...) while
-- listings.accepted_pet_types was free-form text[]. A listing saved as 'Dog'
-- therefore never matched a pet whose species is 'dog', and the filter returned
-- an empty result instead of an error.
--
-- Typing the column as pet_species[] keeps one source of truth for that
-- vocabulary. A text[] column with a CHECK constraint was rejected because a
-- CHECK cannot contain a subquery, so it would have to hardcode a second copy
-- of the enum labels and drift again the next time a species is added.
-- See docs/decisions/0006-listing-pet-type-vocabulary.md.

-- Local databases may hold hand-entered values such as 'Dog' or 'Guinea Pig'.
-- Normalise those first. Anything still outside the enum aborts the migration
-- rather than being silently dropped.
update public.listings
set accepted_pet_types = array(
  select replace(lower(btrim(pet_type)), ' ', '_')
  from unnest(accepted_pet_types) with ordinality as u(pet_type, ord)
  order by u.ord
)
where cardinality(accepted_pet_types) > 0;

alter table public.listings
  alter column accepted_pet_types drop default;

alter table public.listings
  alter column accepted_pet_types type public.pet_species[]
  using accepted_pet_types::public.pet_species[];

alter table public.listings
  alter column accepted_pet_types set default '{}'::public.pet_species[];
