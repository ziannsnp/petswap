# Sprint 3 regression — 2026-11-14

Full pre-review regression ahead of the Sprint Review on Monday 2026-11-16, built from
[Sprint 1](regression-sprint1-2026-09-12.md), [Sprint 2](regression-sprint2-2026-10-19.md) (every row re-run,
including the "Blocked (environment)" ones) and `docs/requirements.md`. Template:
`docs/templates/regression-checklist.md`. This run counts as the Sprint 3 card
"re-run Blocked (environment) rows with Docker stack": **the Docker Compose stack was used** (not `supabase start`).

## Environment

| Field | Value |
| --- | --- |
| Sprint / date | Sprint 3 / 2026-11-14 |
| Tester | Kasidech (Team D), via Claude Code |
| Commit | `36de85c` (`main`, includes PR #78 booking lifecycle). The web bundle tested is the production build of `main` served by the Compose stack |
| Supabase | Docker Compose stack: web `http://127.0.0.1:5174`, API `http://127.0.0.1:55321`, Postgres `127.0.0.1:55322`. `supabase start` cannot run on this PC (Windows WinNAT reserves ports 54234–54333). Seeds from `supabase/seed.sql` |
| Production | Signed-out rows (search, sort, filters, listing detail, `/privacy`, `/terms`, 404, redirect) were also run read-only against `https://petswap-web.zianporrutai.workers.dev`, no sign-in |
| Browsers / viewports | Built-in browser (Chromium), desktop ~1024px and 375×812 mobile emulation |
| Test data | Everything created is prefixed `REG-` (account `reg_user1`, pet `REG-Biscuit`, listing `REG-Listing Bangkok garden`, bookings on it). Seed rows were not deleted |

**How mobile was run.** At 375px every route below was opened and checked for horizontal overflow
(`scrollWidth` = 375 on `/`, `/bookings`, `/profile`, `/pets/new`, `/listings`, listing detail, listing edit,
`/privacy`, 404), and the hamburger menu, search form and bookings list were checked visually. The full write
flows (register, create pet/listing, request/confirm) were driven at desktop width only, so the mobile column says
"Pass (layout)" where only layout was checked.

**Two test-harness notes.** (1) To exercise "Mark completed" I backdated one confirmed `REG-Listing` booking in the
local DB with triggers off for that session (bookings are immutable after request by design, and the UI cannot
create a past booking). (2) The local stack auto-confirms email (`GOTRUE_MAILER_AUTOCONFIRM: 'true'` in
`docker-compose.yml`, `enable_confirmations = false` in `supabase/config.toml`) by design, so the
email-confirmation rows cannot run locally.

Evidence files are `evidence/regression-s3-*.jpg` (the browser tool produces JPEG, not PNG).

## Checks

### Accounts and profiles (FR-1.1, FR-1.2)

| # | Check | Desktop | Mobile (375px) | Evidence / notes |
| --- | --- | --- | --- | --- |
| 1 | Register with a new, valid email + password creates an account and lands signed in (hosted: check-your-email screen, see S3-5) | Pass | Pass (layout) | `reg_user1` registered; lands signed in because local auto-confirms. `evidence/regression-s3-register-lands-signed-in.jpg` |
| 2 | Used email, bad email, weak password, mismatched confirmation show field errors; no account created | Pass | Pass (layout) | Used email → "This email is already registered."; weak password → rule message. Mismatch was only seen as the inline hint "Both passwords must match.", not captured as a separate submit error |
| 3 | Consent required before account creation; privacy notice and terms open from the form | Pass | Pass (layout) | Unchecked → "You must accept the Terms of Service and Privacy Policy."; `/privacy` and `/terms` reachable and cross-link. Their content is a placeholder, see F1 |
| 4 | Log out, then log back in with the same credentials | Pass | Pass (layout) | Log out from the account menu and the mobile menu (with confirm dialog); re-login worked by username (`REG_User1`, case-insensitive) and by email; wrong password → "Username/email or password is incorrect." Sprint 1's "no logout entry point" is fixed |
| 5 | Visiting a protected page while logged out redirects to `/login` | Pass | Pass (layout) | Resumes the interrupted page after sign-in. `evidence/regression-s3-prod-protected-redirect.jpg` |
| 6 | Edit display name, phone, location; values persist after refresh | Pass | Pass (layout) | Phone `0812345678`, location `Bangkok` persisted after reload |
| 7 | Required profile fields cannot be saved empty | Pass | Pass (layout) | "Display name / Phone number / Location cannot be empty." |
| 8 | Profile photo upload shows a preview and persists | Pass | Pass (layout) | Photo goes through a crop dialog ("Use photo"), then saves; avatar renders from `/storage/v1/object/public/avatars/…` after reload. `evidence/regression-s3-profile-avatar.jpg` |

### Pets (FR-2.1, FR-2.2)

| # | Check | Desktop | Mobile (375px) | Evidence / notes |
| --- | --- | --- | --- | --- |
| 9 | Create a pet with name, species, breed, age, photo, description | Pass | Pass (layout) | `REG-Biscuit` (Dog, Corgi, 3, description) created; the photo field was not exercised (optional) |
| 10 | Missing required pet fields block submission | Pass | Pass (layout) | "Pet name is required.", "Choose a species.", "Description is required." |
| 11 | Edit and delete a pet you own | Pass | Pass (layout) | Edit saved; delete works when only inactive bookings exist (S3-11) |
| 12 | Another user's pet cannot be edited or deleted | Pass | Pass (layout) | `/pets/<alex's pet>/edit` as `reg_user1` → "Pet not found … belongs to someone else." |
| 13 | Add and edit care info (feeding, medical, behaviour, allergies, vaccination, other) | Pass | Pass (layout) | All six fields saved; edited allergies and cleared the medical note → card updated and the empty section disappears. `evidence/regression-s3-pet-care-card.jpg` |

### Listings and search (FR-3.1, FR-3.2, FR-4.1, FR-4.2)

| # | Check | Desktop | Mobile (375px) | Evidence / notes |
| --- | --- | --- | --- | --- |
| 14 | Create a listing with title, location, description, capacity, pet types, facilities, photos | Pass | Pass (layout) | Dog + Cat, Lawn + Enclosed fence, capacity 2; 10 synthetic photos added on edit |
| 15 | Required listing fields block submission; published listing is publicly visible | Pass | Pass (layout) | Required errors shown; published listing opened signed out |
| 16 | Edit every field and photo, set new main photo, changes persist; delete and confirm direct access and search no longer expose it | Pass | Pass (layout) | Title/capacity saved; photo order change persisted after reload; Unpublish (with confirm) removed it from search; Delete → direct URL shows "Listing unavailable". Minor: see O2 |
| 17 | Listing detail shows host profile, facilities, capacity, pet types, photos, description | Pass | Pass (layout) | "Your host" section with name and city is present on production and locally (Sprint 1 fail, issue #76, appears fixed) |
| 18 | Search by location/keyword; empty query lists all; no matches shows empty state | Pass | Pass (layout) | Location filter and empty state verified (`evidence/regression-s3-prod-search-empty-state.jpg`). The keyword field was not separately exercised |
| 19 | Pet-type + capacity + date filters exclude small listings and listings with an overlapping confirmed booking | Pass | Pass (layout) | Confirmed REG booking Apr 14–18 2027: search Apr 15–16 hides `REG-Listing`; Apr 18–20 shows it (end-exclusive). Rabbit + 2+ pets returns only the two matching seed listings |
| US-2.2-A | Invalid listing edits and an eleventh photo rejected; another user cannot update the listing or its photos | Pass | Pass (layout) | 11th photo → "A listing can have at most 10 photos."; another host's `/listings/<id>/edit` → "belongs to another host". Data-layer rules are also covered in `supabase/tests/` |

### Bookings (FR-5.1 – FR-5.4)

| # | Check | Desktop | Mobile (375px) | Evidence / notes |
| --- | --- | --- | --- | --- |
| 20 | Request a booking for your pet at another user's listing; new request is `Pending` | Pass | Pass (layout) | casey/Rocket → `REG-Listing`, and reg_user1/REG-Biscuit → Sunny garden room, both Pending. `evidence/regression-s3-booking-request-sent.jpg` |
| 21 | End date not after start date is rejected | Pass | Pass (layout) | "End date must be later than the start date."; past start → "Start date cannot be in the past." |
| 22 | You cannot request a booking on your own listing | Pass | Pass (layout) | The owner's view of their own listing has no request form |
| 23 | Outgoing and incoming lists show pet, listing, dates, status | Pass | Pass (layout) | `evidence/regression-s3-booking-incoming-desktop.jpg`, `evidence/regression-s3-mobile-menu-bookings-375.jpg` |
| 24 | An unrelated user cannot see a booking they are not part of | Pass | Not re-run | alex's lists showed none of the `REG-Listing` bookings. No booking detail route exists |
| 25 | Owner confirms a pending request; requester sees `Confirmed` | Pass | Pass (layout) | Confirmed in place; the outgoing status updated |
| 26 | Owner declines a pending request; requester cancels a pending and a confirmed booking | Pass | Pass (layout) | Decline → `DECLINED`; casey cancelled a confirmed (Apr 14–18) and a pending (Apr 12–16) → `CANCELLED`; reg_user1 cancelled a pending. Cancel has no confirm step, see O3 |
| 27 | Overlapping confirmed booking blocked; back-to-back allowed | Pass | Pass (layout) | Confirming Apr 12–16 over confirmed Apr 10–14 → "This request overlaps another confirmed booking on this listing…"; Apr 14–18 confirmed fine |
| 28 | Owner completes a confirmed booking after its end date | Pass | Pass (layout) | "Mark completed" is shown only on the ended confirmed booking (not on the future confirmed one); click → `COMPLETED`. Needed a backdated row, see harness note |

### Sprint 3 additions

| # | Check | Desktop | Mobile (375px) | Evidence / notes |
| --- | --- | --- | --- | --- |
| S3-1 | Search sort: Newest / Oldest / Title (A–Z) / Capacity (high to low) reorder results and persist in `?sort=` | Pass | Pass (layout) | Production: title order A quiet home, asdf, asdf, big dada's house, Chatuchak, Chula, home, House 1, my home eiei; capacity 5,5,5,4,4,1,1,1,1. Oldest was not checked separately |
| S3-2 | Pet-type and min-capacity filters, alone and combined; `Clear` resets everything including sort | Pass | Pass (layout) | `evidence/regression-s3-prod-filter-fish-cap5.jpg` (sort kept when filtering). Clear returns `/` with sort back to Newest |
| S3-3 | Date filter: end <= start shows an error; valid range excludes overlapping confirmed bookings | Pass | Pass (layout) | `evidence/regression-s3-prod-date-range-error.jpg`; overlap exclusion verified locally (row 19) |
| S3-4 | Pagination Previous/Next keeps filters and sort | Partial | Partial | Production shows "Page 1 of 2" with Previous/Next; Next was not clicked and the local seed has fewer than one page (4 listings). Not verified |
| S3-5 | Email confirmation: check-your-email screen after register, resend after cooldown, link returns to `/login` with success message | Blocked (environment) | Blocked (environment) | Local stack auto-confirms by design. `/check-email` renders (heading, address, Resend, Go to sign in). The full flow is recorded on hosted Supabase in [email-confirmation-2026-11-10.md](email-confirmation-2026-11-10.md) and [email-confirm-redirect-2026-11-12.md](email-confirm-redirect-2026-11-12.md); not re-run today |
| S3-6 | Unconfirmed account cannot log in by email or username; safe error | Blocked (environment) | Blocked (environment) | Same reason; see the 11-10 evidence |
| S3-7 | Pet care info on PetCard and in create/edit forms; blank optional fields allowed | Pass | Pass (layout) | `evidence/regression-s3-pet-care-card.jpg` |
| S3-8 | Care info visible on a booking request that includes the pet | Pass | Pass (layout) | alex's incoming request shows all care sections; a pet without care shows "No care information added." `evidence/regression-s3-booking-care-info.jpg` |
| S3-9 | Booking lifecycle in UI: request, confirm, decline, cancel (pending), cancel (confirmed), complete | Pass | Pass (layout) | Rows 20, 25–28 |
| S3-10 | Pet with pending or confirmed booking cannot be deleted; clear message | Pass | Pass (layout) | "REG-Biscuit has active bookings, so it can't be deleted." `evidence/regression-s3-pet-delete-blocked.jpg` |
| S3-11 | Pet with only inactive bookings can be deleted and still appears on those bookings | Pass | Pass (layout) | After cancelling the pending request, delete succeeded; the outgoing list still shows `REG-Biscuit (Dog) CANCELLED` |
| S3-12 | `/privacy`, `/terms`, unknown route 404 with back link | **Fail** (privacy/terms content); 404 Pass | Pass (layout) | 404 "Page not found" with "Back to search" is fine. Privacy/terms show placeholder text, see F1 |
| S3-13 | 375px layout: no horizontal scroll, nav usable | n/a | Pass | Overflow check on 9 routes, hamburger menu. `evidence/regression-s3-mobile-search-375.jpg`, `evidence/regression-s3-mobile-menu-bookings-375.jpg` |

## Fails

### F1 — `/privacy` and `/terms` show placeholder text to users (S3-12, row 3)

- **Repro:** open `/privacy` or `/terms` (signed out, production or local).
- **Expected:** the approved policy copy.
- **Actual:** the page contains "Foundation route for US-D.1. Replace with the approved VibeCode privacy/terms content."
- **Suspect:** `web/src/features/consent/components/PrivacyNoticeScreen.tsx:13`, `TermsOfServiceScreen.tsx:14`.
- **Impact:** registration requires accepting these two pages.

No other Fail rows. Everything else that could be exercised passed.

## Observations (not Fails)

- **O1** — The "My listings" nav tab stays highlighted when viewing another host's listing detail (`/listings/:id`), probably because the active match is on the `/listings` prefix. Suspect the nav component under `web/src/shared/components/`.
- **O2** — On listing edit, a stale error ("reg-10.png: A listing can have at most 10 photos.") stays on screen next to "Changes saved successfully." after a save.
- **O3** — "Cancel booking" cancels immediately with no confirmation dialog, while Unpublish, Delete listing and Delete pet all ask first.
- **O4** — Seed data has requests whose dates are already past but status is still `PENDING` (Casey, Sunny garden room, Nov 1–4 2026); nothing handles stale pending requests.
- **O5** — Sprint 1 follow-ups now fixed: logout entry point, host info on listing detail (#76), requester cancel, owner complete.
- **O6** — Local `docker-compose.yml` and `supabase/config.toml` auto-confirm email, so the local stack never shows the check-your-email screen after register; the hosted flow has to be re-checked there before the demo.

## Sign-off

| Field | Value |
| --- | --- |
| Fails opened as issues | F1 not filed yet (already on the parent session's P1 list). O1–O4 are suggestions |
| Blocked rows | S3-5, S3-6 (local stack auto-confirms; recorded on hosted 2026-11-10 / 11-12); S3-4 partial |
| Ready for demo? (tester opinion) | Yes for the shipped journeys: accounts, profile, pets with care info, listings, search sort/filters and the whole booking lifecycle passed on a real stack at desktop width, with 375px layout checked. Replace the privacy/terms placeholder before the demo, and re-confirm the email flow on hosted Supabase because it cannot run locally. |
