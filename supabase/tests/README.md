# Database contract tests

SQL checks that pin the promises the MVP schema makes to the app. They are the
automated form of the database review points in
[environments.md](../../docs/environments.md#verifying-migrations).

| File | What it checks | Writes data? |
| --- | --- | --- |
| `database_contract.sql` | Catalogue checks: RLS is on, booking policies exist, the listing-wide confirmed-overlap exclusion is gone and the capacity and capacity-edit triggers plus the per-pet overlap constraint are installed (ADR 0011), the booking capacity helpers are not executable by API roles, the consent-pair constraint exists, the listing accepted-pet contract and storage policies exist, the booking status enum and guard triggers are present, owner-only listing RPCs and the pet-deletion RPC are not executable by `anon`, direct pet updates cannot soft-delete or restore a pet, booking inserts lock the pet against deletion, the listing-photo and pet-photos buckets are private, and the avatar bucket is public. | No |
| `booking_rules.test.sql` | Constraints that hold with triggers off (ADR 0011): one pet cannot hold overlapping confirmed stays on the same or another listing, back-to-back stays and pending/cancelled/completed overlaps are allowed, a different pet on the same listing and dates is not blocked by any constraint (capacity is the trigger's job), and a zero-length window is rejected. Runs in one transaction that is rolled back. | No (rolled back) |
| `booking_capacity.test.sql` | Capacity and pet overlap through the real triggers and RLS (ADR 0011, P-02/P-03): peak occupancy (capacity 2 accepts A [1,3), B [3,5), C [1,5)), a third pet on any night refused with `PBC01`, non-confirmed bookings never block, cancelling frees a place, back-to-back stays fit, one pet at two hosts refused with `PBP01` without DETAIL/HINT or read access to the blocking booking, capacity edits refused below the current/future confirmed peak (direct update and `update_listing_with_images`) while past nights do not count, and the migration preflight fails loudly on broken data. | No (rolled back) |
| `booking_concurrency.test.py` | Real two-session races (Python stdlib + psql): one remaining place, two places, one pet at two hosts, capacity reduction vs confirmation in both orders, and Repeatable Read/Serializable failing closed with `0A000`. No refusal exposes a DETAIL. | Yes, its own fixtures, removed afterwards |
| `booking_lifecycle.test.sql` | Behaviour of the booking status guard and RLS, signed in as each actor: only the listing owner confirms or declines a pending request (and a confirmation beyond the listing capacity is refused), only the requester cancels a pending or confirmed booking, only the owner completes a confirmed booking on or after its end date, terminal statuses stay terminal, and strangers or anonymous callers change nothing. | No (rolled back) |
| `booking_day.test.sql` | The UTC booking day (ADR 0011): `booking_today()` is the UTC date under any session TimeZone, the booking guard uses it instead of `current_date`, requests may start on that day but not the day before, and completion opens on the UTC end day. | No (rolled back) |
| `listing_rules.test.sql` | Behaviour of the required accepted-pet rule: an empty accepted-pet array is rejected by the named constraint. Runs in one transaction that is rolled back. | No (rolled back) |
| `listing_facility_migration.test.sql` | Behaviour of the legacy facility-label backfill: old labels map to the prototype vocabulary, unknown values survive, and replacement duplicates are removed. | No (rolled back) |
| `listing_photo_access.test.sql` | Storage RLS behaviour: an owner can select draft photos for signing, other authenticated and anonymous users cannot read drafts, and anonymous users can select published photos for signing. | No (rolled back) |
| `listing_host_access.test.sql` | Listing host projection behaviour: anonymous visitors can read only the minimal host projection of published listings; owners can read their own draft host projection; other users cannot read draft host details or profiles directly. | No (rolled back) |
| `listing_edit_rules.test.sql` | US-2.2 behaviour: owners can edit valid listing fields, invalid updates fail, non-owners cannot edit listing data or photos, photo metadata stays under the correct listing path and ten-photo cap, and main-photo ordering changes atomically. | No (rolled back) |
| `listing_deletion.test.sql` | Listing-owner deletion behaviour: a pending or confirmed booking blocks deletion while a declined, cancelled, or completed one does not (one fixture listing per status), only owners may delete, a signed-out caller, a missing listing, or an already-deleted one is refused, only the owner may unpublish (never a deleted listing) and unpublishing clears `published_at`, audit timestamps persist, and direct update/hard-delete bypasses are rejected. | No (rolled back) |
| `listing_search.test.sql` | Published-listing search matching, case-insensitive and literal wildcard handling, deterministic ordering, the newest/oldest/title/capacity sorts across page boundaries and an unknown-sort rejection, page boundaries, invalid inputs, and asserted `EXPLAIN ANALYZE` index usage over temporary 50,000-row fixtures. | No (rolled back) |
| `listing_search_filters.test.sql` | Pet matching, inclusive minimum capacity, confirmed-only end-exclusive availability, combined filters before pagination, invalid filters, and anonymous/unrelated/owner privacy checks. | No (rolled back) |
| `avatar_storage_access.test.sql` | Avatar storage behaviour: avatars are publicly readable; users may create and replace their own avatars but cannot upload into or delete another user's folder. | No (rolled back) |
| `pet_photo_access.test.sql` | Pet photo storage behaviour: private bucket; pet owners have full CRUD over their pet photos; listing hosts with a booking for that pet can read photos; unrelated users and anonymous requests are blocked. | No (rolled back) |
| `profile_rules.test.sql` | Profile RLS behaviour: users can update their own profile; non-owners and anonymous users cannot update or delete other profiles. | No (rolled back) |
| `pet_rules.test.sql` | Behaviour of pet management and integrity rules: the owner can update and delete a pet; a non-owner, including a listing host who can read a booked pet, cannot; a pet with any booking cannot be hard-deleted; through the deletion RPC a pending or confirmed booking blocks deletion while a declined, cancelled, or completed one does not (one fixture pet per status); a soft-deleted pet stays readable to its owner and past hosts but cannot be edited, restored, or booked, its owner can still read and remove a leftover photo file, but cannot upload or replace one, and its past hosts can no longer read it; booking another user's deleted pet does not reveal that it was deleted. Runs in one transaction that is rolled back. | No (rolled back) |

## Run locally

After rebuilding the database, the host projection contract can also be run with:

```bash
docker exec -i supabase_db_petswap psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/listing_host_access.test.sql
```

```bash
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/database_contract.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/booking_rules.test.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/booking_lifecycle.test.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/booking_capacity.test.sql
python3 supabase/tests/booking_concurrency.test.py \
  --database-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/listing_rules.test.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/listing_facility_migration.test.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/listing_photo_access.test.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/listing_edit_rules.test.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/listing_deletion.test.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/listing_search.test.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/listing_search_filters.test.sql
psql "******127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/avatar_storage_access.test.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/pet_photo_access.test.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/profile_rules.test.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/pet_rules.test.sql
```

No local `psql`? Run it inside the database container instead:

```bash
docker exec -i supabase_db_petswap psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/database_contract.sql
```

Any failed check raises an error and exits non-zero.

## CI

[`.github/workflows/db-contract.yml`](../../.github/workflows/db-contract.yml) runs
all files on every change under `supabase/`, weekly, and on demand. It is not
part of the required Quality gate (it boots containers); still treat a red run as
a blocker for a schema change.

## Scope

These check the database in isolation. Actor-specific RLS behaviour (a signed-in
user reading only their own bookings) still needs Studio, JWT impersonation in the
SQL editor, or the Playwright journey once auth-backed screens exist.
