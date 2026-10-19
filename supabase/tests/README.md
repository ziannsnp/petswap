# Database contract tests

SQL checks that pin the promises the MVP schema makes to the app. They are the
automated form of the database review points in
[environments.md](../../docs/environments.md#verifying-migrations).

| File | What it checks | Writes data? |
| --- | --- | --- |
| `database_contract.sql` | Catalogue checks: RLS is on, booking policies exist, the confirmed-overlap and consent-pair constraints exist, the listing accepted-pet contract and storage policies exist, the booking status enum and guard triggers are present, owner-only listing RPCs and the pet-deletion RPC are not executable by `anon`, direct pet updates cannot soft-delete or restore a pet, booking inserts lock the pet against deletion, the listing-photo and pet-photos buckets are private, and the avatar bucket is public. | No |
| `booking_rules.test.sql` | Behaviour of the confirmed-overlap rule: overlap rejected, back-to-back allowed, non-confirmed and different-listing bookings allowed, zero-length window rejected. Runs in one transaction that is rolled back. | No (rolled back) |
| `listing_rules.test.sql` | Behaviour of the required accepted-pet rule: an empty accepted-pet array is rejected by the named constraint. Runs in one transaction that is rolled back. | No (rolled back) |
| `listing_facility_migration.test.sql` | Behaviour of the legacy facility-label backfill: old labels map to the prototype vocabulary, unknown values survive, and replacement duplicates are removed. | No (rolled back) |
| `listing_photo_access.test.sql` | Storage RLS behaviour: an owner can select draft photos for signing, other authenticated and anonymous users cannot read drafts, and anonymous users can select published photos for signing. | No (rolled back) |
| `listing_host_access.test.sql` | Listing host projection behaviour: anonymous visitors can read only the minimal host projection of published listings; owners can read their own draft host projection; other users cannot read draft host details or profiles directly. | No (rolled back) |
| `listing_edit_rules.test.sql` | US-2.2 behaviour: owners can edit valid listing fields, invalid updates fail, non-owners cannot edit listing data or photos, photo metadata stays under the correct listing path and ten-photo cap, and main-photo ordering changes atomically. | No (rolled back) |
| `listing_deletion.test.sql` | Listing-owner deletion behaviour: a pending or confirmed booking blocks deletion while a declined, cancelled, or completed one does not (one fixture listing per status), only owners may delete, a signed-out caller, a missing listing, or an already-deleted one is refused, only the owner may unpublish (never a deleted listing) and unpublishing clears `published_at`, audit timestamps persist, and direct update/hard-delete bypasses are rejected. | No (rolled back) |
| `listing_search.test.sql` | Published-listing search matching, case-insensitive and literal wildcard handling, deterministic ordering, page boundaries, invalid inputs, and asserted `EXPLAIN ANALYZE` index usage over temporary 50,000-row fixtures. | No (rolled back) |
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
