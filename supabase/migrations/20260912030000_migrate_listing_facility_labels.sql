-- Keep existing listing data compatible with the facility vocabulary adopted in ADR 0007.
-- Unknown free-text facilities are intentionally preserved.
with facility_lines as (
  select
    listing.id,
    facility.ordinality,
    facility.label,
    case btrim(facility.label)
      when 'Fenced yard' then 'Lawn'
      when 'Air conditioning' then 'Air-conditioned room'
      when 'Indoor play area' then 'Enclosed fence'
      when 'Near a vet clinic' then 'Near a veterinary clinic'
      else facility.label
    end as canonical_label
  from public.listings as listing
  cross join lateral regexp_split_to_table(listing.facilities, E'\n')
    with ordinality as facility(label, ordinality)
  where listing.facilities is not null
), listings_with_legacy_labels as (
  select distinct id
  from facility_lines
  where label is distinct from canonical_label
), deduplicated_lines as (
  select distinct on (id, canonical_label)
    id,
    ordinality,
    canonical_label
  from facility_lines
  order by id, canonical_label, ordinality
), migrated_listings as (
  select
    id,
    string_agg(canonical_label, E'\n' order by ordinality) as facilities
  from deduplicated_lines
  group by id
)
update public.listings as listing
set facilities = migrated.facilities
from migrated_listings as migrated
join listings_with_legacy_labels as legacy using (id)
where listing.id = migrated.id
  and listing.facilities is distinct from migrated.facilities;
