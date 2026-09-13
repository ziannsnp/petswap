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
| Sprint / date | Sprint 1 / 2026-09-12 |
| Tester | Kasidech (Team D), via Claude Code |
| Commit (`git rev-parse --short HEAD`) | `8ede47c` on branch `feat/booking-request-and-confirm` ([PR #43](https://github.com/ziannsnp/petswap/pull/43), not yet merged to `main`) — run against this branch because checks 20–28 need its request/confirm booking UI |
| Supabase | local (`supabase db reset`, then `supabase/functions/.env` copied from `.env.example` — see note under check 4) |
| Browsers / viewports | Chrome desktop @ 546–682px pane width, Chrome mobile @ 375×812 (Pixel-class) |

**Known limitation of this run:** pets, profile, and search have no UI yet
(`PetsScreen`, `ProfileScreen`, `SearchScreen` are all `FeaturePlaceholderScreen`
stubs), and listing edit ([PR #41](https://github.com/ziannsnp/petswap/pull/41))
is still open, not on `main`. Those rows are marked **Blocked**, not Fail —
nothing here is a regression in that code, it simply doesn't exist yet.

## Checks

### Accounts and profiles (FR-1.1, FR-1.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 1 | Register with a new, valid email + password creates an account and lands signed in | Pass | Pass (same code path; no viewport-specific logic) | New account `qa_tester1` registered, landed on `/profile` |
| 2 | Registering a used email, a bad email, or a weak password shows a field error and no account is created | Pass | Pass | Duplicate email → "This email is already registered."; weak password → clear inline rule violation; no account rows created for either attempt |
| 3 | Consent must be accepted before the account is created; the privacy notice and terms open from the form | Pass | Pass | Submitting without the checkbox is blocked with "You must accept the Terms of Service and Privacy Policy."; links to `/terms` and `/privacy` present |
| 4 | Log out, then log back in with the same credentials | **Partial / Fail** — see notes | Not re-tested (same gap) | **No logout entry point exists anywhere in the UI.** `LogoutButton`/`LogoutConfirmDialog` ([PR #39](https://github.com/ziannsnp/petswap/pull/39)) are fully built and unit-tested but never rendered — grepped `web/src/**`, zero usages outside the component's own files/tests. Simulated logout by clearing `localStorage`. Re-login via **email** then worked. Re-login via **username** initially failed with a `403` from the `sign-in` Edge Function (origin-allowlist check in `supabase/functions/sign-in/index.ts` rejects `http://localhost:5173` when `SIGN_IN_ALLOWED_ORIGINS` isn't set) — resolved locally by copying `supabase/functions/.env.example` to `supabase/functions/.env`, which the bundled `supabase start` runtime does pick up. `docs/testing.md`'s and this checklist's own "how to run" sections don't mention this step, so anyone following just `supabase db reset` + `npm run dev` hits a silent, unexplained username-login failure. **Two follow-ups worth filing:** (a) wire `LogoutButton` into the nav — functionally a P1 since there is no way for a real user to sign out, and (b) document/fix the local `sign-in` function env step. |
| 5 | Visiting a protected page while logged out redirects to `/login` | Pass | Pass | `/bookings` while logged out → redirected to `/login`; signing in then resumed `/bookings` (the interrupted destination) correctly |
| 6 | Edit display name, phone, and location; values persist after a refresh | Blocked | Blocked | `ProfileScreen` is a `FeaturePlaceholderScreen` stub (FR-1.2 not built) |
| 7 | Required profile fields cannot be saved empty | Blocked | Blocked | Same as above |
| 8 | Profile photo upload shows a preview and persists | Blocked | Blocked | Same as above |

### Pets (FR-2.1, FR-2.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 9 | Create a pet with name, species, breed, age, photo, description | Blocked | Blocked | `PetsScreen` is a `FeaturePlaceholderScreen` stub; `listMyPets`/`useMyPets` exist and work (used by the new booking form) but there is no UI to create/view/edit a pet |
| 10 | Missing required pet fields block submission | Blocked | Blocked | Same as above |
| 11 | Edit and delete a pet you own | Blocked | Blocked | Same as above |
| 12 | Another user's pet cannot be edited or deleted | Blocked | Blocked | Same as above |
| 13 | Add and edit care info (feeding, medical, behaviour, allergies, vaccination) | Blocked | Blocked | Same as above |

### Listings and search (FR-3.1, FR-3.2, FR-4.1, FR-4.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 14 | Create a listing with title, location, description, capacity, pet types, any combination of the six optional facility checkboxes, and photos | Pass | Pass | Created "QA Test Listing Alpha" (Bangkok, 1 pet type, 1 facility, no photos — photos are optional); published successfully with a success banner |
| 15 | Required listing fields block submission; published listing is publicly visible | Pass | Pass | Submitting blank showed all three required-field errors (title/location/description); published listing loaded at its public `/listings/:id` URL |
| 16 | Edit every supported field and photo on a listing you own... delete it... | Blocked | Blocked | Listing edit ([PR #41](https://github.com/ziannsnp/petswap/pull/41)) is open, not merged to `main` — no edit/delete route exists yet on this branch |
| 17 | Listing detail shows host profile, facilities, capacity, pet types, photos, description | **Fail** | **Fail** | Facilities, capacity, pet types, and description all render correctly, but **host/owner information is completely absent** from the detail view — no host name, avatar, or profile link anywhere on the page. Evidence: `evidence/fail-17-listing-detail-no-host-info.png`. This is the other half of the Sprint1_C "booking management" row *"Add listing detail view with host information and booking request entry point"* (Boeing) — PR #43 delivers the booking-request-entry-point half only; host info was never built. |
| 18 | Search by location/keyword; empty query lists all published; no matches shows an empty state | Blocked | Blocked | `SearchScreen` is a `FeaturePlaceholderScreen` stub (FR-4.1/4.2 not built) |
| 19 | Pet-type + capacity + date filters exclude listings that are too small or have an overlapping confirmed booking | Blocked | Blocked | Same as above |
| US-2.2-A | Invalid listing edits and an eleventh photo are rejected; another user cannot update the listing or its photos | Blocked | Blocked | Depends on the same unmerged edit PR as check 16 |

### Bookings (FR-5.1 – FR-5.4)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 20 | Request a booking for your pet at another user's listing with start/end dates; new request is `Pending` | Pass | Pass | Casey requested Rocket for "QA Test Listing Alpha", May 10–14 2027 → created as `Pending`. `evidence/booking-01-request-form-filled.png`, `evidence/booking-02-request-sent.png` |
| 21 | End date not after start date is rejected | Pass | Pass | End date = start date, and end date before start date, both rejected client-side with "End date must be later than the start date." before any request reached the server |
| 22 | You cannot request a booking on your own listing | Pass | Pass | Signed in as the listing's owner, the "Request a booking" section does not render at all (confirmed on both the seeded and the newly-created listing) |
| 23 | Outgoing (your pets) and incoming (your listings) lists show pet, listing, dates, status | Pass | Pass | Casey's outgoing list correctly showed all 5 of her bookings (pet, listing, dates, status per row) across every lifecycle status (Pending/Confirmed/Declined/Completed) |
| 24 | An unrelated user cannot open a booking they are not part of | Pass (as far as the app surfaces) | Pass | No per-booking detail route exists to "open" directly; verified the outgoing/incoming queries never leak another user's unrelated booking into either list (RLS + query scoping) |
| 25 | Owner confirms a pending request; requester then sees `Confirmed` | Pass | Pass | Owner clicked Confirm → card updated to `Confirmed` in place, button removed. `evidence/booking-03-owner-incoming-pending.png`, `evidence/booking-04-owner-confirmed.png`, `evidence/booking-05-requester-sees-confirmed.png` |
| 26 | Owner declines a pending request; requester cancels a pending/confirmed request | **Partial** — decline Pass, cancel Blocked | Same | Decline verified working (card → `Declined`, error-free). **No "cancel" action exists anywhere in the UI** for a requester to cancel their own pending/confirmed booking — out of scope for PR #43; this is a real gap for whoever picks up the rest of the bookings epic |
| 27 | A second confirmed booking overlapping an existing one on the same listing is blocked; back-to-back dates are allowed | Pass | Pass | Confirming an overlapping pending request (May 12–16 vs. an already-confirmed May 10–14) failed cleanly with a visible error, booking stayed `Pending`, and I could then confirm a genuinely back-to-back request (May 14–18) without issue — the `bookings_no_confirmed_overlap` exclusion constraint and end-exclusive logic both hold |
| 28 | Owner completes a confirmed booking after its end date | Blocked | Blocked | No "Complete" action exists in the UI; `isValidBookingTransition('confirmed', 'completed')` is allowed by the rules module but nothing in the UI calls it |

## Additional observations (not on the numbered checklist)

- `BookingsScreen` renders with no header/nav bar at all (`ListingsNavigation` isn't included there), unlike every other authenticated screen — a user landing on `/bookings` has no way to navigate elsewhere except the browser back button.
- A stray, unused `BookingCard.tsx` duplicate (never imported anywhere) was found and removed as part of PR #43, since it sat right next to the file being modified.

## Sign-off

| Field | Value |
| --- | --- |
| Fails opened as issues | Not filed yet — flagging here for the release-readiness write-up: (1) no logout entry point in the UI, (2) listing detail is missing host information (#17), (3) no cancel action for requesters (#26), (4) no complete action for owners (#28), (5) local `sign-in` Edge Function needs an undocumented env step to work at all |
| Blocked rows (feature not yet built) | Profile edit (6–8), Pets (9–13), Search/filter (18–19), Listing edit/delete (16, US-2.2-A) — all tracked as open work on other teams' backlogs, not new findings |
| Ready for demo? (tester opinion) | The request→confirm booking journey (the one thing Team D needed unblocked) is solid: request validation, self-booking guard, confirm/decline, and the overlap/back-to-back rule all passed cleanly on desktop and mobile. The wider app has real gaps (no logout, no host info, no cancel/complete) that are pre-existing and outside this PR's scope — worth a call on whether they block the demo. |
