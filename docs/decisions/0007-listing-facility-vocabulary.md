# 0007. Listing facilities use the approved prototype vocabulary

Status: Accepted

## Context

[ADR 0006](0006-listing-pet-type-vocabulary.md) deliberately left
`listings.facilities` as free text. The approved US-2.1 prototype now presents six
facility checkboxes, so the create-listing workflow needs one stable vocabulary while
remaining compatible with the existing nullable text column.

Earlier versions of the form stored a different six-label vocabulary. Replacing those
labels only in the client would leave existing rows with values that a future checkbox
form could not select, causing facilities to disappear when a listing is loaded and
saved again.

## Decision

Keep `listings.facilities` as nullable text and store selected facility labels one per
line. The create-listing form offers these six labels:

- Lawn
- Air-conditioned room
- Security cameras
- Enclosed fence
- Daily photo updates
- Near a veterinary clinic

Migrate the previous labels to their corresponding prototype choices:

| Previous label | Prototype label |
| --- | --- |
| Fenced yard | Lawn |
| Air conditioning | Air-conditioned room |
| Security cameras | Security cameras |
| Indoor play area | Enclosed fence |
| Daily photo updates | Daily photo updates |
| Near a vet clinic | Near a veterinary clinic |

The migration preserves unrecognised facilities and removes duplicates created when a
row already contains both an old label and its replacement.

This decision amends only the facilities paragraph in ADR 0006. Its accepted-pet-type
decision remains unchanged.

## Consequences

- Existing listings remain compatible with the prototype vocabulary.
- The database schema stays unchanged, so filtering by facility is still out of scope.
- Facility labels remain stored presentation values. Renaming them again requires a
  data migration or a future move to stable facility identifiers.

### Alternatives rejected

- **Keep both old and new labels in the form.** This exposes obsolete product language
  and makes newly created data inconsistent.
- **Discard unknown values during migration.** Existing free-text data may have been
  entered by another client and must not be silently lost.
- **Normalise only in the browser.** Other clients and direct database reads would
  continue to see stale labels, and a later edit flow could still drop them.
