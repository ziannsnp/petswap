# Sprint regression checklist

A pre-release pass over the shipped user journeys, run on desktop and mobile
before a sprint demo or release. It is the manual counterpart to the automated
gates: Jest and the Playwright smoke suite cover units and the public shell, the
[database contract checks](../testing.md#database-and-rls-verification) cover the
schema, and this covers whole journeys a person can see.

Copy this file per run (for example `docs/qa/regression-<sprint>-<date>.md`),
fill the result columns, and link it from the release-readiness PR.

## How to run

1. Local stack with seed data:

   ```bash
   npx supabase db reset          # accounts + fixtures: supabase/seed.sql
   cd web && npm run dev
   ```

2. Run each row twice: once at a desktop width, once at a mobile width
   (Chrome DevTools device toolbar, e.g. Pixel 5). Record **Pass**, **Fail**, or
   **Blocked** (feature not built yet) in each column.
3. For any **Fail**, open an issue, link it in the row, and note it in the
   release-readiness summary. A checklist with open Fails does not block the demo
   by itself — the release-readiness call does.
4. Attach evidence (screenshot or short clip) for every Fail and for the booking
   journey regardless of result.

## Environment

| Field | Value |
| --- | --- |
| Sprint / date | Sprint 2 / 2026-10-19 |
| Tester | Kasidech (Team D), via Claude Code |
| Commit | `aa04470` on branch `feature/booking-lifecycle` ([PR #78](https://github.com/ziannsnp/petswap/pull/78), rebased onto `main` `e72e2e9` the same day — not yet merged) |
| Supabase | **Could not start.** Docker Desktop would not come up in this environment (`docker info` never returned; see note below) — no local stack, so no browser-driven click-through was possible this run |
| Browsers / viewports | None run by hand this pass — see "How this run differs" below |

**How this run differs from the template:** the environment Claude Code was running in could not start Docker Desktop, so the usual `supabase db reset` + `npm run dev` + manual click-through was not possible. Rather than fabricate Pass results, this run instead cites **live, automated evidence from the same commit**, pulled from actual CI runs and a real local Jest run, and marks every row that genuinely needs a human click-through as **Blocked (environment)** — not Pass, not Fail. Treat those rows as not yet re-verified this sprint; whoever has Docker available should re-run them before sign-off, not just trust this document.

Automated evidence cited below, all from commit `aa04470` on 2026-10-19:

- [Quality](https://github.com/ziannsnp/petswap/actions/runs/39191001854) — lint, typecheck, build, and the full Jest suite — **success**. Independently re-run locally (via the known `.claude/worktrees` Jest path workaround): **51 suites / 838 tests passed**.
- [Database contract](https://github.com/ziannsnp/petswap/actions/runs/39191001813) — every SQL file under `supabase/tests/`, including the new `booking_lifecycle.test.sql` (confirm/decline/cancel/complete authorization as owner, requester, stranger, and anonymous) — **success**.
- [E2E smoke](https://github.com/ziannsnp/petswap/actions/runs/39191001843) — public-route Playwright suite on desktop Chromium, mobile Chromium, and desktop Firefox — **success**. Also re-run locally from this checkout (not the worktree-cursed copy): **15/15 passed** across the same three projects.
- [E2E booking](https://github.com/ziannsnp/petswap/actions/runs/39191001898) — `booking-flow.spec.ts` and `booking-lifecycle.spec.ts` against a real Supabase stack booted on the CI runner, desktop Chromium + mobile Chromium + desktop Firefox — **success**. This is live, browser-driven coverage of request → confirm, decline, cancel (pending and confirmed), and complete.

## Checks

### Accounts and profiles (FR-1.1, FR-1.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 1 | Register with a new, valid email + password creates an account and lands signed in | Blocked (environment) | Blocked (environment) | Needs a live Supabase session; the smoke suite only confirms the registration form renders without one |
| 2 | Registering a used email, a bad email, or a weak password shows a field error and no account is created | Blocked (environment) | Blocked (environment) | Same |
| 3 | Consent must be accepted before the account is created; the privacy notice and terms open from the form | Pass (automated) | Pass (automated) | `e2e/smoke.spec.ts` "the privacy notice and terms are reachable and cross-link" — passed on both desktop and mobile Chromium plus desktop Firefox, this run |
| 4 | Log out, then log back in with the same credentials | Blocked (environment) | Blocked (environment) | Needs a live session |
| 5 | Visiting a protected page while logged out redirects to `/login` | Blocked (environment) | Blocked (environment) | Needs a live session |
| 6 | Edit display name, phone, and location; values persist after a refresh | Blocked (environment) | Blocked (environment) | Needs a live session |
| 7 | Required profile fields cannot be saved empty | Blocked (environment) | Blocked (environment) | Needs a live session |
| 8 | Profile photo upload shows a preview and persists | Blocked (environment) | Blocked (environment) | Needs a live session |

### Pets (FR-2.1, FR-2.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 9 | Create a pet with name, species, breed, age, photo, description | Blocked (environment) | Blocked (environment) | `pet_rules.test.sql` / `pet_photo_access.test.sql` cover the data-layer rules (passed in Database contract), but creating a pet through the UI needs a live session |
| 10 | Missing required pet fields block submission | Blocked (environment) | Blocked (environment) | Same |
| 11 | Edit and delete a pet you own | Blocked (environment) | Blocked (environment) | Same |
| 12 | Another user's pet cannot be edited or deleted | Pass (automated, data layer only) | Pass (automated, data layer only) | `pet_rules.test.sql` asserts non-owner mutation is blocked at the RLS layer; the UI path itself is not click-tested this run |
| 13 | Add and edit care info (feeding, medical, behaviour, allergies, vaccination) | Blocked (environment) | Blocked (environment) | Needs a live session |

### Listings and search (FR-3.1, FR-3.2, FR-4.1, FR-4.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 14 | Create a listing with title, location, description, capacity, pet types, any combination of the six optional facility checkboxes, and photos | Blocked (environment) | Blocked (environment) | Needs a live session |
| 15 | Required listing fields block submission; published listing is publicly visible | Blocked (environment) | Blocked (environment) | Needs a live session |
| 16 | Edit every supported field and photo on a listing you own... delete it... | Pass (automated, data layer only) | Pass (automated, data layer only) | `listing_edit_rules.test.sql` and `listing_deletion.test.sql` cover valid/invalid/unauthorized edits and owner-only delete at the RLS layer; UI click-through not done this run |
| 17 | Listing detail shows host profile, facilities, capacity, pet types, photos, description | Blocked (environment) | Blocked (environment) | The Sprint 1 regression ([docs/qa/regression-sprint1-2026-09-12.md](regression-sprint1-2026-09-12.md), check 17) found host info missing; tracked as [issue #76](https://github.com/ziannsnp/petswap/issues/76), still **open** as of this run. Not re-verified live this run, so treat the gap as still present |
| 18 | Search by location/keyword; empty query lists all published; no matches shows an empty state | Pass (automated, data layer only) | Pass (automated, data layer only) | `listing_search.test.sql` covers matching, literal special characters, deterministic order, and page boundaries; passed in Database contract. UI click-through not done this run |
| 19 | Pet-type + capacity + date filters exclude listings that are too small or have an overlapping confirmed booking | Blocked (environment) | Blocked (environment) | Needs a live session to exercise the filter UI |
| US-2.2-A | Invalid listing edits and an eleventh photo are rejected; another user cannot update the listing or its photos | Pass (automated, data layer only) | Pass (automated, data layer only) | Covered by `listing_edit_rules.test.sql` and `listing_photo_access.test.sql` |

### Bookings (FR-5.1 – FR-5.4)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 20 | Request a booking for your pet at another user's listing with start/end dates; new request is `Pending` | Pass (automated) | Pass (automated) | `e2e/booking-flow.spec.ts` "a requester books a listing and the owner confirms it" — live Playwright run against a real Supabase stack on the CI runner, desktop Chromium + mobile Chromium + desktop Firefox, this commit |
| 21 | End date not after start date is rejected | Blocked (environment) | Blocked (environment) | Not exercised by the current Playwright specs; needs a live session or a new assertion in `booking-flow.spec.ts` |
| 22 | You cannot request a booking on your own listing | Blocked (environment) | Blocked (environment) | Same |
| 23 | Outgoing (your pets) and incoming (your listings) lists show pet, listing, dates, status | Pass (automated) | Pass (automated) | Exercised as part of `booking-flow.spec.ts` and `booking-lifecycle.spec.ts`, which read both lists to drive their assertions |
| 24 | An unrelated user cannot open a booking they are not part of | Blocked (environment) | Blocked (environment) | Not exercised by the current Playwright specs |
| 25 | Owner confirms a pending request; requester then sees `Confirmed` | Pass (automated) | Pass (automated) | `e2e/booking-flow.spec.ts`, same run as check 20 |
| 26 | Owner declines a pending request; requester cancels a pending/confirmed request | Pass (automated) | Pass (automated) | `e2e/booking-lifecycle.spec.ts` — "a listing owner declines a pending request", "a requester cancels a pending request", "a requester cancels a confirmed booking" — all three passed live this run |
| 27 | A second confirmed booking overlapping an existing one on the same listing is blocked; back-to-back dates are allowed | Pass (automated, data layer) | Pass (automated, data layer) | `booking_rules.test.sql` and `booking_lifecycle.test.sql` exercise the exclusion constraint and end-exclusive logic directly against Postgres; passed in Database contract |
| 28 | Owner completes a confirmed booking after its end date | Pass (automated) | Pass (automated) | `e2e/booking-lifecycle.spec.ts` "a listing owner marks a finished confirmed booking completed" — passed live this run, same CI run as check 26 |

## Additional observations (not on the numbered checklist)

- [PR #74](https://github.com/ziannsnp/petswap/pull/74) duplicates the booking-cancellation feature already merged via [PR #72](https://github.com/ziannsnp/petswap/pull/72); its author appears to have started before #72 landed. Not a regression, but worth closing or redirecting so it doesn't collide with `main` further.
- This run leans heavily on automated/CI evidence because the environment running this pass could not start Docker Desktop. That is a gap in *this run*, not evidence the app itself has a problem — but it is a real gap: nothing here confirms visual layout, responsiveness, or anything an assertion-based test wouldn't catch. Re-run the Blocked rows by hand before treating this sprint as demo-ready.

## Sign-off

| Field | Value |
| --- | --- |
| Fails opened as issues | None found this run — no Fail rows, only Blocked (environment) and automated Pass |
| Blocked rows (feature not yet built) | None — every Blocked row this run is blocked on *this environment's* Docker, not on missing product features |
| Ready for demo? (tester opinion) | The booking lifecycle (request, confirm, decline, cancel, complete) and the data-layer rules behind listings/pets/search all have live or automated evidence from this exact commit and look solid. Accounts/profile/pets/listings UI journeys are **not re-verified this run** — someone with a working local Docker stack should click through the Blocked rows above before calling this demo-ready. |
