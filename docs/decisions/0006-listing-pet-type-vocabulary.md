# 0006. Listings reuse the pet_species vocabulary for accepted pet types

Status: Accepted, amended by 0007

## Context

[FR-4.2](../requirements.md) lets a pet owner filter listings by the pet type they need
care for. That filter compares a listing's `accepted_pet_types` against the species of
the pet being booked.

The MVP schema gave the two sides different types. `pets.species` is the `pet_species`
enum (`dog`, `cat`, `rabbit`, `hamster`, `guinea_pig`, `fish`, `reptile`,
`exotic_mammal`, `bird`, `other`), while `listings.accepted_pet_types` was `text[]` with
no constraint. `supabase/seed.sql` already stored lowercase enum labels, but the
create-listing form offers capitalised labels (`Dog`, `Cat`, `Rabbit`, `Bird`). Once that
form is wired to an insert, a listing accepting `Dog` would never match a pet whose
species is `dog`.

The failure is silent: the filter returns an empty result set rather than an error, so it
reads as "no listings available" instead of a bug.

## Decision

`listings.accepted_pet_types` is typed `public.pet_species[]`. The enum is the single
source of truth for the vocabulary, and both listings and pets refer to it.

Capitalised strings are display labels only. The interface maps enum values to labels at
render time and never sends a label to the database.

`listings.facilities` is deliberately unchanged. FR-3.1 specifies plain-text facilities,
no requirement filters on them, and `seed.sql` already stores them as free text.

## Consequences

- An invalid pet type is rejected by Postgres on insert instead of producing an empty
  filter result later.
- Generated types make `accepted_pet_types` a union of the enum labels, so sending
  `'Dog'` from the web app is a TypeScript error rather than a runtime surprise.
- Adding a species now requires `alter type public.pet_species add value`, which affects
  pets and listings together. That coupling is intended: the two must not diverge.
- The create-listing form needs a label map before it can submit. That work belongs to
  the form's own card, not to this migration.

### Alternatives rejected

- **Keep `text[]` and add a CHECK constraint.** A CHECK cannot contain a subquery, so it
  would have to hardcode the enum labels — a second copy of the vocabulary that drifts
  the next time a species is added. That is the problem this decision removes.
- **Keep `text[]` and normalise in the API adapter.** Browser-side normalisation is user
  experience, not a constraint; another client, a manual SQL insert, or a seed file
  bypasses it. [conventions.md](../conventions.md) already requires ownership and
  validity to be enforced in the database.
- **Add a `pet_types` lookup table.** More flexible at runtime, but the project already
  chose an enum for `pets.species`. Introducing a second mechanism for the same concept
  would leave two inconsistent representations with no requirement that needs one.
