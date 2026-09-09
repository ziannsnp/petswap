# Database contract tests

SQL checks that pin the promises the MVP schema makes to the app. They are the
automated form of the database review points in
[environments.md](../../docs/environments.md#verifying-migrations).

| File | What it checks | Writes data? |
| --- | --- | --- |
| `database_contract.sql` | Catalogue checks: RLS is on, booking policies exist, the confirmed-overlap and consent-pair constraints exist, the booking status enum and guard triggers are present, the storage bucket is public. | No |
| `booking_rules.test.sql` | Behaviour of the confirmed-overlap rule: overlap rejected, back-to-back allowed, non-confirmed and different-listing bookings allowed, zero-length window rejected. Runs in one transaction that is rolled back. | No (rolled back) |

## Run locally

```bash
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/database_contract.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/booking_rules.test.sql
```

No local `psql`? Run it inside the database container instead:

```bash
docker exec -i supabase_db_petswap psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/database_contract.sql
```

Any failed check raises an error and exits non-zero.

## CI

[`.github/workflows/db-contract.yml`](../../.github/workflows/db-contract.yml) runs
both files on every change under `supabase/`, weekly, and on demand. It is not
part of the required Quality gate (it boots containers); still treat a red run as
a blocker for a schema change.

## Scope

These check the database in isolation. Actor-specific RLS behaviour (a signed-in
user reading only their own bookings) still needs Studio, JWT impersonation in the
SQL editor, or the Playwright journey once auth-backed screens exist.
