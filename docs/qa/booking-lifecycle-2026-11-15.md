# Booking lifecycle check evidence

| Field | Record |
| --- | --- |
| Requirement / story | Booking management: a listing owner confirms or declines a pending request; a requester cancels a pending or confirmed booking; a listing owner marks a finished confirmed booking completed. Sprint Backlog task: run the full booking lifecycle SQL and Playwright checks after PR #78. |
| Tester | Sornchon (run with Claude Code) |
| Date and environment | 2026-11-15, Windows 11, local Supabase stack (CLI 2.117.0, PostgreSQL 15.8) rebuilt with `supabase db reset` before each run. Code: `main` at `0dc9d2d` plus the owner-cancellation SQL cases on `test/owner-cannot-cancel-booking`. Node 22.14.0, Playwright 1.62.1 |
| Browser and viewport | Playwright `desktop-chromium` (Desktop Chrome) and `mobile-chromium` (Pixel 5). `desktop-firefox` was not run locally; the `e2e-booking.yml` workflow runs it in CI |
| Test data | `supabase/seed.sql` accounts and listings; the SQL files create and roll back their own fixtures |

PR #78 (booking lifecycle) was reviewed and merged before this run (`36de85c`), so this
record only covers the checks.

## SQL contract checks

Run the same way as [`db-contract.yml`](../../.github/workflows/db-contract.yml): the schema
contract first, then every `supabase/tests/*.test.sql` in name order, each with
`psql -v ON_ERROR_STOP=1 -f <file>` inside `supabase_db_petswap`.

| File | Result |
| --- | --- |
| `database_contract.sql` | Pass |
| `avatar_storage_access.test.sql` | Pass |
| `booking_lifecycle.test.sql` | Pass: owner confirms or declines; requester cancels pending and confirmed; listing owner refused for both cancellations; owner completes on or after the end date; strangers and anonymous callers change nothing |
| `booking_rules.test.sql` | Pass |
| `booking_transition_rules.test.sql` | Pass: species, duplicate pending request, expired confirmation, and late cancellation rules |
| `host_pet_access.test.sql` | Pass |
| `listing_deletion.test.sql` | Pass |
| `listing_edit_rules.test.sql` | Pass |
| `listing_facility_migration.test.sql` | Pass |
| `listing_host_access.test.sql` | Pass |
| `listing_photo_access.test.sql` | Pass |
| `listing_rules.test.sql` | Pass |
| `listing_search.test.sql` | Pass |
| `listing_search_filters.test.sql` | Pass |
| `pet_photo_access.test.sql` | Pass |
| `pet_rules.test.sql` | Pass |
| `profile_rules.test.sql` | Pass |

`listing_facility_migration.test.sql` includes a migration by relative path, so it must be run
with `-f` from a checkout of `supabase/`, not piped through standard input.

## Playwright booking journeys

```bash
supabase db reset
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> \
  npx playwright test e2e/booking-flow.spec.ts e2e/booking-lifecycle.spec.ts \
  --project=desktop-chromium --project=mobile-chromium --workers=1
```

The environment variables override a `web/.env.local` that points at the hosted project, so the
journeys never write to shared data.

| # | Journey | Desktop Chromium | Mobile Chromium |
| --- | --- | --- | --- |
| 1 | A requester books a listing and the owner confirms it | Pass | Pass |
| 2 | A listing owner declines a pending request | Pass | Pass |
| 3 | A requester cancels a pending request | Pass | Pass |
| 4 | A requester cancels a confirmed booking | Pass | Pass |
| 5 | A listing owner marks a finished confirmed booking completed | Pass | Skipped by design (the seeded stay can be completed once per reset) |

Result: 9 passed, 1 skipped, 0 failed (1.1 min).

## Defects / follow-up

1. **Parallel local run timed out.** With Playwright's default local worker count, 6 of 10
   journeys hit the 30-second test timeout after signing in, on a laptop that was also running
   the Supabase containers. The same journeys passed with `--workers=1` after a fresh reset. No
   product defect was found. CI was not affected in this run.
   - Issue link: none
   - Owner: QA / Scrum / Infra squad
   - Retest date/result: 2026-11-15, pass with one worker
2. **Not run locally:** `desktop-firefox`, which CI runs in `e2e-booking.yml`.
