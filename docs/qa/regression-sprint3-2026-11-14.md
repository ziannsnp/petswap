# Sprint 3 regression — 2026-11-14

Full pre-review regression for the Sprint Review on Monday 2026-11-16, built from
[Sprint 1](regression-sprint1-2026-09-12.md), [Sprint 2](regression-sprint2-2026-10-19.md)
(including its "Blocked (environment)" rows) and `docs/requirements.md`. Template:
`docs/templates/regression-checklist.md`. **Status: DRAFT — local-stack rows are Pending.**

## Environment

| Field | Value |
| --- | --- |
| Sprint / date | Sprint 3 / 2026-11-14 |
| Tester | Kasidech (Team D), via Claude Code |
| Commit | `36de85c` on `main` (worktree branch `claude/qa-regression-sprint3-395e60`) |
| Supabase | local stack shared with the parent session (not started by this run); signed-out rows were also run read-only against production `https://petswap-web.zianporrutai.workers.dev` |
| Browsers / viewports | built-in browser, desktop ~1024px, mobile 375px |
| Test data | anything created is prefixed `REG-` |

## Checks

### Accounts and profiles (FR-1.1, FR-1.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 1 | Register with a new, valid email + password creates an account and (now) shows the check-your-email screen, not a signed-in session | Pending | Pending |  |
| 2 | Used email, bad email, used username, weak password, mismatched confirmation each show a field error and create no account | Pending | Pending |  |
| 3 | Consent must be accepted before the account is created; privacy notice and terms open from the form | Pending | Pending |  |
| 4 | Log out, then log back in with email and with username | Pending | Pending |  |
| 5 | Visiting a protected page while logged out redirects to `/login`; sign-in resumes the destination | Pending | Pending |  |
| 6 | Edit display name, phone, and location; values persist after a refresh | Pending | Pending |  |
| 7 | Required profile fields cannot be saved empty | Pending | Pending |  |
| 8 | Profile photo upload shows a preview and persists | Pending | Pending |  |

### Pets (FR-2.1, FR-2.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 9 | Create a pet with name, species, breed, age, photo, description | Pending | Pending |  |
| 10 | Missing required pet fields block submission | Pending | Pending |  |
| 11 | Edit and delete a pet you own | Pending | Pending |  |
| 12 | Another user's pet cannot be edited or deleted (UI and direct URL `/pets/:id/edit`) | Pending | Pending |  |
| 13 | Add and edit care info (feeding, medical, behaviour, allergies, vaccination, other) | Pending | Pending |  |

### Listings and search (FR-3.1, FR-3.2, FR-4.1, FR-4.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 14 | Create a listing with title, location, description, capacity, pet types, facilities, photos | Pending | Pending |  |
| 15 | Required listing fields block submission; published listing is publicly visible | Pending | Pending |  |
| 16 | Edit every field/photo, change main photo, changes persist; delete and confirm direct access and search no longer expose it | Pending | Pending |  |
| 17 | Listing detail shows host profile, facilities, capacity, pet types, photos, description | Pass (signed-out, production) | Pending |  |
| 18 | Search by location/keyword; empty query lists all; no matches shows empty state | Pending | Pending |  |
| 19 | Pet-type + capacity + date filters exclude small listings and listings with an overlapping confirmed booking | Pending | Pending |  |
| US-2.2-A | Invalid listing edits and an eleventh photo rejected; another user cannot update the listing or its photos | Pending | Pending |  |

### Bookings (FR-5.1 � FR-5.4)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 20 | Request a booking for your pet at another user's listing; new request is `Pending` | Pending | Pending |  |
| 21 | End date not after start date is rejected | Pending | Pending |  |
| 22 | You cannot request a booking on your own listing | Pending | Pending |  |
| 23 | Outgoing and incoming lists show pet, listing, dates, status | Pending | Pending |  |
| 24 | An unrelated user cannot see a booking they are not part of | Pending | Pending |  |
| 25 | Owner confirms a pending request; requester sees `Confirmed` | Pending | Pending |  |
| 26 | Owner declines a pending request; requester cancels a pending and a confirmed booking | Pending | Pending |  |
| 27 | Overlapping confirmed booking blocked; back-to-back allowed | Pending | Pending |  |
| 28 | Owner completes a confirmed booking after its end date | Pending | Pending |  |

### Sprint 3 additions

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| S3-1 | Search sort: Newest / Oldest / Title (A�Z) / Capacity (high to low) reorder results, persist in `?sort=` and survive paging | Pending | Pending |  |
| S3-2 | Pet-type filter, min-capacity filter, and both combined; `Clear` resets everything including sort | Pending | Pending |  |
| S3-3 | Date filter: start/end required together; end <= start shows an error; valid range excludes listings with an overlapping confirmed booking | Pending | Pending |  |
| S3-4 | Pagination Previous/Next, page count, filters kept across pages | Pending | Pending |  |
| S3-5 | Email confirmation: after register the check-your-email screen shows, resend is on cooldown then works, link returns to `/login` with success message | Pending | Pending |  |
| S3-6 | Unconfirmed account cannot log in with email or username and sees a safe error | Pending | Pending |  |
| S3-7 | Pet care info shown on PetCard and in create/edit forms; blank optional fields allowed | Pending | Pending |  |
| S3-8 | Care info visible on a booking request that includes the pet | Pending | Pending |  |
| S3-9 | Booking lifecycle in UI: request, confirm, decline, cancel (pending), cancel (confirmed), complete | Pending | Pending |  |
| S3-10 | Pet with pending or confirmed booking cannot be deleted; clear message | Pending | Pending |  |
| S3-11 | Pet with only inactive bookings (declined/cancelled/completed) can be deleted and still appears on those bookings | Pending | Pending |  |
| S3-12 | `/privacy`, `/terms`, unknown route 404 page with back link | Pending | Pending |  |
| S3-13 | Nav and layout at 375px: no horizontal scroll, all pages usable | Pending | Pending |  |
## Signed-out production run (read-only, no sign-in)

| Area | Result | Evidence |
| --- | --- | --- |
| Sort by Title (A–Z): A quiet home, asdf, asdf, big dada's house, Chatuchak, Chula, home, House 1, my home eiei | Pass | `?sort=title` |
| Sort by Capacity: 5,5,5,4,4,1,1,1,1 | Pass | `?sort=capacity` |
| Pet type = Fish + 5+ pets, sort kept in URL; returns only the all-species 5-pet listing | Pass | `evidence/regression-s3-prod-filter-fish-cap5.jpg` |
| Location `zzzqqq` shows empty state with "Clear search" | Pass | `evidence/regression-s3-prod-search-empty-state.jpg` |
| End date before start date shows "End date must be later than the start date." and does not search | Pass | `evidence/regression-s3-prod-date-range-error.jpg` |
| Valid date range sets `?startDate=&endDate=` and returns results | Pass (overlap exclusion itself needs confirmed bookings; not provable signed-out) | — |
| Listing detail shows host ("Your host", name, "Based in"), facilities, capacity, pet types, description; signed-out sees "Log in to request a booking" | Pass (issue #76 appears fixed) | — |
| `/bookings` signed-out redirects to `/login` | Pass | `evidence/regression-s3-prod-protected-redirect.jpg` |
| `/no-such-page` shows "Page not found" with "Back to search" | Pass | — |
| `/privacy` and `/terms` render and cross-link | **Fail (content)** — both show the placeholder line "Foundation route for US-D.1. Replace with the approved VibeCode privacy/terms content." to end users. Suspect `web/src/features/consent/` screens | — |

## Fails

_(to be filled after the local-stack run)_

- **F1 — placeholder text on `/privacy` and `/terms`.** Repro: open `/privacy` or `/terms`. Expected: final policy copy. Actual: "Foundation route for US-D.1. Replace with the approved VibeCode privacy/terms content." Suspect: `web/src/features/consent/`.

## Sign-off

| Field | Value |
| --- | --- |
| Fails opened as issues | |
| Blocked rows | |
| Ready for demo? (tester opinion) | |
