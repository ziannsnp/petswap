# Booking detail and refresh check evidence

| Field | Record |
| --- | --- |
| Requirement / story | FR-5.3 (booking detail for both participants, unrelated users refused), FR-5.4 (status actions), US-6.3 (refresh after requests and status changes, no cache across accounts), P-07, P-08, P-09 (ADR 0011). Sprint3C batches 4 and 5 |
| Tester | Automated checks only (Claude Code, run for Pipe). **No person has done the manual desktop and mobile pass yet** |
| Date and environment | 2026-11-15. Windows 11, Node 22, Jest and the production build run locally. SQL checks ran in CI (`Database contract`). No local Supabase stack, `psql` or `python3` on this machine |
| Browser and viewport | None run. The Playwright journey uses `desktop-chromium`, `mobile-chromium` (Pixel 5) and `desktop-firefox`, but see "Playwright" below |
| Test data | `supabase/seed.sql` accounts and listings; SQL files create and roll back their own fixtures; the journey uses 2030 dates |

This record is deliberately honest about what is not proven. The manual rows and the browser journey are open, so
the desktop and mobile regression evidence the sprint asks for is **not complete**.

## Automated checks

| Check | Where | Result |
| --- | --- | --- |
| `npm run lint` | local | 0 errors, 35 warnings (32 on `main`); the three new ones are `complexity` in `BookingCard`, `DetailActions` and `BookingDetailBody` |
| `npm run typecheck` | local | Pass |
| `npm test -- --runInBand` | local | 1194 tests in 62 suites. One run had `CreateListingScreen.test.tsx` time out (a screen this change does not touch); it passed alone (15 of 15) |
| `npm run build` | local | Pass |
| Scripts `check-acceptance-traceability.sh`, `check-test-wiring.sh` | local | Pass (26 scenarios checked, every `Verified by` path exists) |
| OpenAPI parses and has unique `operationId`s | local (`js-yaml`) | Pass. `openapi-spec-validator` runs in CI (`repo-checks`) |
| `Database contract` (`database_contract.sql`, every `supabase/tests/*.test.sql` including the new `booking_detail.test.sql` and `booking_cancellation_release.test.sql`, then `booking_concurrency.test.py`) | CI, [run 43717530972](https://github.com/ziannsnp/petswap/actions/runs/43717530972) | Pass |
| `Quality`, `E2E smoke` (public routes, desktop and mobile), `CodeQL`, `Dependency review` | CI | Pass |

What the new SQL test proves is listed in [`supabase/tests/README.md`](../../supabase/tests/README.md). What the new Jest
files prove is listed in [`docs/testing.md`](../testing.md#database-and-rls-verification).

## Playwright

`web/e2e/booking-detail-journey.spec.ts`, `web/e2e/booking-conflict-and-capacity.spec.ts` (ported from #128) and the
extended `booking-lifecycle.spec.ts` **have not been run**:

- The `E2E booking` workflow is **disabled manually** on the repository (`gh workflow list --all` shows
  `disabled_manually`), so it did not run on this PR. Earlier PRs in this sprint ran it before it was disabled.
- This machine cannot run the local Supabase stack in a reasonable time.
- The specs type-check, and the selectors follow the markup in `BookingDetailScreen.tsx`, but a selector or timing mistake
  would only show in a browser. Treat them as unverified until someone runs them.

To run them, with Docker and `psql` available:

```bash
supabase db reset
cd web
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> \
  npx playwright test e2e/booking-detail-journey.spec.ts e2e/booking-conflict-and-capacity.spec.ts \
  e2e/booking-lifecycle.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1
```

| # | Journey | Desktop Chromium | Mobile Chromium | Desktop Firefox |
| --- | --- | --- | --- | --- |
| 1 | Search by dates, request, open the detail, host confirms by keyboard, requester cancels | Not run | Not run | Not run |
| 2 | A booking is shown only to the two people in it | Not run | Not run | Not run |
| 3 | A stale confirmation is refused and the screen refreshes | Not run | Not run | Not run |
| 4 | Capacity, pet overlap and back-to-back stays (ported) | Not run | Not run | Not run |
| 5 | Completed stay opens from both lists (extends the lifecycle journey) | Not run | Skipped by design | Skipped by design |

## Manual regression (desktop and mobile)

Rows 29 to 33 of [`regression-checklist.md`](../templates/regression-checklist.md) were added for this change. Copy the
checklist for the run and record each result here.

| # | Action | Expected result | Desktop | Mobile | Evidence link |
| --- | --- | --- | --- | --- | --- |
| 29 | **View details** on an outgoing and an incoming booking | Detail shows ID, dates, status, listing, pet, the other person, notes, activity; no email or phone; no sideways scroll on mobile | Not run | Not run | |
| 30 | Care notes and history | Host reads care notes while pending, confirmed or completed; after a decline or cancellation the pet is "no longer shared"; unpublished or deleted listing and removed pet still open | Not run | Not run | |
| 31 | Third user, and signed out | "Booking not found" and the login redirect; nothing about the booking shown | Not run | Not run | |
| 32 | Stale action in two sessions | Own message per refusal, screen refreshes, no action left | Not run | Not run | |
| 33 | Keyboard only | Tab order, Enter, Escape closes the cancel dialog | Not run | Not run | |

## Defects / follow-up

1. **Browser journeys unverified.** Enable `E2E booking` or run the command above before relying on the three specs.
   - Issue link: none
   - Owner: QA / Scrum / Infra squad
   - Retest date/result: open
2. **Manual desktop and mobile pass open** (rows 29 to 33 above), including screenshots for the booking journey.
3. **New lint warnings.** `BookingCard` (22), `DetailActions` (16) and `BookingDetailBody` (16) exceed the complexity limit of
   15. They are warnings and match the existing style of the booking screens; splitting them is a follow-up.
