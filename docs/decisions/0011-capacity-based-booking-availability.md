# ADR 0011: Capacity-based booking availability, pet overlap, and the UTC booking day

**Status:** Accepted

## Context

[ADR 0003](0003-booking-rules-and-scope.md) let one confirmed booking block a whole
listing. Listings already carry a `capacity`, hosts care for several pets at once,
and the backlog (US-5.2, US-6.2, US-6.3, US-6.4, US-6.7) now asks for:

- confirmations limited by capacity rather than by any overlap;
- one pet never confirmed into two overlapping stays, on any listing;
- search availability derived from those same rules;
- a booking detail view showing both participants what they need.

The browser and the database also disagreed about "today": forms used the visitor's
local day, the guard trigger used the session's `current_date`.

## Decision

1. **One pet per booking.** A booking is one pet for one end-exclusive stay
   `[start_date, end_date)`. Group stays are several bookings.
2. **Capacity is peak nightly occupancy.** Only `Confirmed` bookings occupy a
   listing. A confirmation is valid when, on every night of its stay, the confirmed
   bookings on that listing (including it) do not exceed `capacity`. Counting
   overlapping bookings is wrong: with capacity 2, A `[1,3)`, B `[3,5)` and
   C `[1,5)` are all valid because no night holds more than two.
3. **A pet cannot be in two places.** A pet may not have two overlapping
   `Confirmed` bookings on any listings. Back-to-back stays are valid. `Pending`,
   `Declined`, `Cancelled`, and `Completed` bookings never block.
4. **The database decides, atomically.** Every confirmation path checks capacity
   and pet overlap under locks (listing row, then pet row) so concurrent sessions
   serialize; capacity edits take the same listing lock and are refused below the
   confirmed peak of any current or future night. Migrations preflight existing
   data and fail loudly rather than silently cancelling bookings.
5. **Availability is derived, never managed.** A listing is available for a range
   when its remaining capacity (capacity minus confirmed peak) is at least one. Search
   exposes only that aggregate answer, never other people's bookings
   ([ADR 0010](0010-listing-search-availability-privacy.md) still applies).
6. **Distinct, safe conflict errors.** A refused confirmation reports either
   "listing full" or "pet already booked" without revealing whose booking, which
   dates, or which listing caused it.
7. **Participants see details; nobody else does.** The requester and listing owner
   may read a booking's dates, status, notes, listing, pet and care information,
   and a safe peer summary (display name, photo, location). Never email or phone.
   History survives a listing being unpublished or deleted and a pet being
   soft-deleted. Access is enforced by the server, not the UI.
8. **The booking day is the UTC calendar day.** `public.booking_today()` is the only
   "today" the database uses. The UI never offers what the database would refuse:
   a new request may start no earlier than the *later* of the visitor's local day and
   the UTC day; "Mark completed" appears from the UTC end day.

Rejected alternatives: keeping the listing-wide exclusion constraint (ignores
capacity); counting overlapping bookings instead of peak occupancy (refuses valid
staggered stays); checking only in the browser (not concurrency-safe); per-visitor
timezones in the database (the stored dates carry no zone, and a single rule is
testable); manual availability calendars (out of scope).

## Consequences

- Amends ADR 0003's "only confirmed bookings for the same listing block an
  overlapping date range" and ADR 0010's reliance on the listing-wide constraint.
  End-exclusive ranges, ratings-free scope, and the pure-function requirement remain.
- `hasBookingConflict()` must model peak occupancy and pet overlap and stay pure
  and Jest-tested; `isValidBookingTransition()` is unchanged.
- Delivered in steps: the UTC booking day lands with this ADR; capacity and pet
  overlap (P-02 to P-04), search (P-05, P-06), and booking detail (P-07, P-08)
  follow. Until each lands, the database keeps the stricter listing-wide rule.
- Near UTC midnight a visitor west of UTC may find "today" unavailable as a start
  day for a few hours; the form explains why.
