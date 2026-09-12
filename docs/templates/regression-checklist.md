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
| Sprint / date | |
| Tester | |
| Commit (`git rev-parse --short HEAD`) | |
| Supabase | local (`supabase db reset`) |
| Browsers / viewports | Chrome desktop @ ____ , Chrome mobile @ ____ |

## Checks

### Accounts and profiles (FR-1.1, FR-1.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 1 | Register with a new, valid email + password creates an account and lands signed in | | | |
| 2 | Registering a used email, a bad email, or a weak password shows a field error and no account is created | | | |
| 3 | Consent must be accepted before the account is created; the privacy notice and terms open from the form | | | |
| 4 | Log out, then log back in with the same credentials | | | |
| 5 | Visiting a protected page while logged out redirects to `/login` | | | |
| 6 | Edit display name, phone, and location; values persist after a refresh | | | |
| 7 | Required profile fields cannot be saved empty | | | |
| 8 | Profile photo upload shows a preview and persists | | | |

### Pets (FR-2.1, FR-2.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 9 | Create a pet with name, species, breed, age, photo, description | | | |
| 10 | Missing required pet fields block submission | | | |
| 11 | Edit and delete a pet you own | | | |
| 12 | Another user's pet cannot be edited or deleted | | | |
| 13 | Add and edit care info (feeding, medical, behaviour, allergies, vaccination) | | | |

### Listings and search (FR-3.1, FR-3.2, FR-4.1, FR-4.2)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 14 | Create a listing with title, location, description, capacity, pet types, any combination of the six optional facility checkboxes, and photos | | | |
| 15 | Required listing fields block submission; published listing is publicly visible | | | |
| 16 | Edit every supported field and photo on a listing you own, select a new main photo, and confirm the changes persist; delete it and confirm direct access and search no longer expose it | | | |
| 17 | Listing detail shows host profile, facilities, capacity, pet types, photos, description | | | |
| 18 | Search by location/keyword; empty query lists all published; no matches shows an empty state | | | |
| 19 | Pet-type + capacity + date filters exclude listings that are too small or have an overlapping confirmed booking | | | |
| US-2.2-A | Invalid listing edits and an eleventh photo are rejected; another user cannot update the listing or its photos | | | |

### Bookings (FR-5.1 – FR-5.4)

| # | Check | Desktop | Mobile | Evidence / notes |
| --- | --- | --- | --- | --- |
| 20 | Request a booking for your pet at another user's listing with start/end dates; new request is `Pending` | | | |
| 21 | End date not after start date is rejected | | | |
| 22 | You cannot request a booking on your own listing | | | |
| 23 | Outgoing (your pets) and incoming (your listings) lists show pet, listing, dates, status | | | |
| 24 | An unrelated user cannot open a booking they are not part of | | | |
| 25 | Owner confirms a pending request; requester then sees `Confirmed` | | | |
| 26 | Owner declines a pending request; requester cancels a pending/confirmed request | | | |
| 27 | A second confirmed booking overlapping an existing one on the same listing is blocked; back-to-back dates are allowed | | | |
| 28 | Owner completes a confirmed booking after its end date | | | |

## Sign-off

| Field | Value |
| --- | --- |
| Fails opened as issues | |
| Blocked rows (feature not yet built) | |
| Ready for demo? (tester opinion) | |
