# ADR 0010: Confirmed occupancy and pet exclusion

**Status:** Accepted

## Context

Sprint 3 changes US-6.2/US-6.4 to permit simultaneous stays within a listing's
capacity and adds US-6.7 to prevent the same pet staying at two places at once.
This amends the booking exclusivity decision in [ADR 0003](0003-booking-rules-and-scope.md).
Each booking still contains one pet. Manual host calendars remain out of scope.

## Decision

Only confirmed stays consume capacity. A confirmation must keep peak simultaneous
occupancy within capacity over the end-exclusive interval `[start, end)`.
Combine arrivals and departures on the same date before accumulating occupancy;
adding all overlapping bookings together incorrectly rejects disjoint stays.
The same pet cannot have overlapping confirmed stays across any listings.
Pending and terminal bookings reserve neither capacity nor a pet.

Database triggers lock the listing row, then the pet row, before checking a
confirmation. Capacity reductions already lock the listing being updated and
must accommodate confirmed stays that have not ended. A private, volatile
occupancy helper sees newly committed bookings after waiting for a lock.
Confirmations and capacity reductions require Read Committed (or PostgreSQL's
equivalent Read Uncommitted). Other isolation levels fail closed: an older
snapshot must not undercount a lock holder's newly confirmed bookings.
PostgREST's default satisfies this contract.

A partial GiST pet/date exclusion constraint is a second line of defence.
Check pet conflicts under the pet lock first to avoid exposing another host's
dates in a constraint error detail. Raise `PBC01` for capacity and `PBP01` for
pet conflicts; adapters translate these to safe messages. Ownership and lifecycle
checks still run before availability.

Allocating physical capacity slots with exclusion ranges was considered. That
requires allocation/repacking and a new model for capacity edits. Serialized
checks fit this MVP's existing model. Client-only counts were rejected because
concurrent confirmations and RLS-filtered reads cannot enforce the invariant.
Locking without an isolation contract was rejected because Repeatable Read can
count a stale snapshot.

## Consequences

The migration stops on existing conflicting pet stays or capacity overflow;
resolve those records explicitly before retrying. It never cancels bookings.
Privileged loads that disable triggers must separately validate capacity; pet
exclusion remains active. Locks serialize confirmations for the same listing or
pet. Failed attempts leave requests Pending.

This database rule is independent of Search or browser previews. The existing
two-argument `hasBookingConflict()` models capacity one with no pet identity and
has no production mutation caller. Its replacement, search filters, and expanded
booking details remain separate work. Do not use it for capacity authorization.

See PostgreSQL's [transaction isolation](https://www.postgresql.org/docs/15/transaction-iso.html)
and [function volatility](https://www.postgresql.org/docs/15/xfunc-volatility.html).
