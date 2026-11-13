# ADR 0010: Public listing availability without exposing private bookings

**Status:** Accepted, amended by 0011

## Context

FR-4.2 requires public search to exclude listings with overlapping confirmed
bookings. Booking RLS intentionally allows only participants to read bookings.
An invoker-rights search therefore misses conflicts belonging to other people,
including every conflict when browsing anonymously.

## Decision

Use the existing `search_published_listings` RPC as the restricted security-definer
read boundary. It uses an empty search path, qualified application tables, explicit
published/undeleted predicates in both the count and row queries, and explicit
execute grants to `anon`, `authenticated`, and `service_role` only.

It returns the existing public listing projection and pagination metadata. It never
returns booking identities, dates, notes, or statuses. Booking-table RLS stays unchanged.

We rejected broadening booking SELECT policies because public availability does
not require exposing private records. A separate privileged conflict helper could
preserve invoker rights on the search function, but would add another callable
boundary for the same public availability question. Keeping the check inside the
search RPC makes its publication and output restrictions reviewable together.

## Consequences

Availability works identically for anonymous and authenticated visitors. Search is
a discovery check, not a reservation: booking confirmation must still enforce the
database's confirmed-overlap constraint if availability changes after searching.

Future search changes must retain both publication predicates and the restricted
output projection. Database tests cover anonymous and unrelated callers, owners'
private listings, and continued denial of direct private-booking reads.
