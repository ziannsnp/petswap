# ADR 0003: Booking rules and ratings-free scope

**Status:** Accepted, amended by 0011

## Context

Booking conflicts are the highest-risk business rule. The original requirements contained ratings, but the team removed FR-6.1 and FR-6.2 to keep the MVP focused.

## Decision

Only confirmed bookings for the same listing block an overlapping date range. Date ranges are end-exclusive, so a booking ending on the day another begins is valid. Ratings and average scores are out of scope.

The Booking squad will maintain pure, Jest-tested `hasBookingConflict()` and `isValidBookingTransition()` functions before database integration.

## Consequences

The UI and database must share this behaviour. Listing details must not show ratings. A later ratings feature requires a new ADR and requirements change.
