# Black-box test plan

<!-- cover-page -->
**Project:** Don't Like My Pets (PetSwap), a pet-sitting marketplace
**Course:** 2110423 Software Engineering, first semester 2026
**Document date:** 16 November 2026
**Repository:** [github.com/ziannsnp/petswap](https://github.com/ziannsnp/petswap)

| Author | Student ID | Squad | Contribution to this document |
| --- | --- | --- | --- |
| Pattharakorn Amornsupparat | 6730363621 | A | 11.6% (360 lines) |
| Sukrit Nuntasakulwiroj | 6730542621 | A | 0.3% (8 lines) |
| Pinnaraya Kantakanith | 6730375121 | A | 2.0% (63 lines) |
| Porrutai Chinkarnjanaroj | 6730356221 | B | 0.0% (0 lines) |
| Pacharakamon Wattanasiri | 6730334421 | B | 3.9% (121 lines) |
| Rahut Nopnirapath | 6731345521 | B | 0.6% (19 lines) |
| Sornchon Srichoonim | 6731350621 | C | 8.3% (258 lines) |
| Kittichot Uaypornchaikul | 6730040921 | C | 22.7% (703 lines) |
| Pisitpong Duangkaeo | 6730379721 | C | 9.9% (305 lines) |
| Kasidech Aewsrisakul (leader) | 6730023221 | D | 40.6% (1254 lines) |

Contribution is measured from git: lines added or removed by each author in this plan, [test-plan.md](test-plan.md), [testing.md](testing.md), the acceptance scenarios, the QA evidence in `docs/qa/`, and the Playwright specs in `web/e2e/`, up to the commit that produced this PDF. Team leader: **Kasidech Aewsrisakul** (6730023221).
<!-- /cover-page -->

This is the course's black-box test plan: two EPICs, four user stories from each, input equivalence classes for every story, test cases that cover every class, and a coverage matrix. The overall strategy (test levels, environments, entry and exit criteria, risks) is in [test-plan.md](test-plan.md); this document does not repeat it.

## 1. Scope and method

| EPIC | User stories under test | How it is tested in the demonstration |
| --- | --- | --- |
| **E-6 Booking Management** | US-6.1 request a booking, US-6.2 prevent double booking, US-6.4 confirm or decline, US-6.5 cancel | **Automated** black-box testing with Playwright (`web/e2e/`) |
| **E-4 Listings** | US-4.1 create, US-4.2 edit, US-4.3 view detail, US-4.4 unpublish or delete | **Manual** black-box testing in the browser, 2 to 3 cases from section 3 |

Method: equivalence partitioning. For each story the inputs are listed, each input is split into one valid class and the invalid classes the system must reject, and boundary values are added where an input has a limit (capacity 1 and 50, photo size exactly 10 MB, back-to-back dates). Each invalid class gets its own test case, so a failure points at one cause; valid classes are combined into as few cases as possible.

Conventions:

- Class IDs are `EC-<story>-<n>`; **V** = valid, **I** = invalid.
- Dates are written relative to the run day D (the UTC booking day). For example D+10 is ten days after the run. Stays are end-exclusive: `[D+10, D+14)` is four nights and the guest leaves on D+14.
- Test accounts are the seeded local users (`supabase/seed.sql`): **Alex** owns listings, **Casey** requests with the dog **Rocket**, **Blair** is an outsider.
- **Actual output** is what the run produced and where. **Status**: P = pass, F = fail, NR = not run yet.

Evidence sources used for actual outputs:

| Source | What it ran | Date |
| --- | --- | --- |
| CI-E2E | GitHub Actions `E2E booking`, run [43822524478](https://github.com/ziannsnp/petswap/actions/runs/43822524478) on `main` (commit af35a41): the four booking specs on desktop Chromium, mobile Chromium, and desktop Firefox against a fresh local Supabase. 29 passed, 4 failed (two tests), 2 skipped by design | 16 Nov 2026 |
| SQL | `supabase/tests/*.test.sql` in the `Database contract` CI job on `main` (the authoritative database rules) | 15 Nov 2026 |
| JEST | `npx jest` on the validators the forms use (`listingForm`, `listingPhotos`, `bookingRequestForm`, `bookingRules`): 133 tests passed | 16 Nov 2026 |
| REG-S3 | Manual Sprint 3 regression on the Docker Compose stack, desktop and 375 px: [qa/regression-sprint3-2026-11-14.md](qa/regression-sprint3-2026-11-14.md) | 14 Nov 2026 |

## 2. EPIC E-6 Booking Management (automated with Playwright)

### US-6.1 Request a booking

> As a pet owner, I want to request a booking for one of my pets so that I can arrange pet care.

Inputs: pet, start date, end date, the listing chosen (whose owner the requester may or may not be).

| Class | Input | Description | V/I |
| --- | --- | --- | --- |
| EC-6.1-1 | all | Own pet whose species the listing accepts; start ≥ D; end > start; listing owned by someone else and published | V |
| EC-6.1-2 | pet | No pet chosen | I |
| EC-6.1-3 | start date | Missing | I |
| EC-6.1-4 | end date | Missing | I |
| EC-6.1-5 | dates | End date equal to or earlier than the start date | I |
| EC-6.1-6 | start date | In the past (start < D) | I |
| EC-6.1-7 | listing | The requester's own listing | I |
| EC-6.1-8 | pet | Same pet, same dates, while an identical request is still pending | I |

| Test case | Inputs | Expected output | Actual output | Classes | Status |
| --- | --- | --- | --- | --- | --- |
| TC-6.1-01 | Casey, pet Rocket, `[D+5, D+8)`, Alex's listing | Request saved as **Pending**; it appears in Casey's outgoing and Alex's incoming list | CI-E2E `booking-flow.spec.ts` "a requester books a listing and the owner confirms it": Pending row shown to both, on all 3 browsers | EC-6.1-1 | P |
| TC-6.1-02 | No pet, `[D+5, D+8)` | "Choose which pet this booking is for."; nothing saved | JEST `bookingRequestForm` "requires a pet to be chosen": that message | EC-6.1-2 | P |
| TC-6.1-03 | Rocket, start empty, end D+8 | "Start date is required." | JEST "requires a start date" | EC-6.1-3 | P |
| TC-6.1-04 | Rocket, start D+5, end empty | "End date is required." | JEST "requires an end date" | EC-6.1-4 | P |
| TC-6.1-05 | Rocket, start D+8, end D+8 | "End date must be later than the start date."; nothing saved | JEST "rejects an end date that is not after the start date"; REG-S3 row 21 | EC-6.1-5 | P |
| TC-6.1-06 | Rocket, start D−1, end D+2 | "Start date cannot be in the past."; the database also refuses it (`P0001`) | JEST "rejects a stay that starts before today"; REG-S3 row 21; SQL `booking_day.test.sql` (database refuses a past start) | EC-6.1-6 | P |
| TC-6.1-07 | Alex opens his own listing | No request form is offered; a direct insert is refused by the database | REG-S3 row 22 "The owner's view of their own listing has no request form"; the database guard also refuses the insert ("requester cannot book their own or missing listing") | EC-6.1-7 | P |
| TC-6.1-08 | Casey repeats TC-6.1-01 while it is pending | "You already have a pending request for this pet on these dates." | SQL `booking_transition_rules.test.sql` (duplicate request refused) | EC-6.1-8 | P |

### US-6.2 Prevent double booking

> As a listing owner, I want the system to prevent double bookings so that I do not accept overlapping stays.

Inputs: the candidate stay's dates and pet, the listing's capacity, and the confirmed stays that already exist. Since ADR 0011 the rule is capacity by peak nightly occupancy, plus one pet cannot be in two places at once.

| Class | Input | Description | V/I |
| --- | --- | --- | --- |
| EC-6.2-1 | dates vs. confirmed stays | Overlaps confirmed stays, but every night stays within capacity | V |
| EC-6.2-2 | dates vs. confirmed stays | Back-to-back: starts on the check-out day of a confirmed stay | V |
| EC-6.2-3 | status of the other stay | The overlapping stay is Pending, Declined, or Cancelled (never blocks) | V |
| EC-6.2-4 | dates vs. capacity | Some night would exceed the listing's capacity | I |
| EC-6.2-5 | pet | The same pet already has a confirmed overlapping stay at another listing | I |

| Test case | Inputs | Expected output | Actual output | Classes | Status |
| --- | --- | --- | --- | --- | --- |
| TC-6.2-01 | Capacity 2; confirm A `[D+1, D+3)`, then B `[D+1, D+5)` (different pets) | Both confirmed | CI-E2E `booking-conflict-and-capacity.spec.ts` "allows overlapping confirmed stays within capacity…": both Confirmed, on all 3 browsers | EC-6.2-1 | P |
| TC-6.2-02 | Then confirm C `[D+2, D+4)` on the same capacity-2 listing | Refused: "This listing is full for some of these dates…"; C stays Pending | Same test, second half: refusal message shown, C still Pending, on all 3 browsers | EC-6.2-4 | P |
| TC-6.2-03 | Rocket confirmed at Alex's listing `[D+10, D+14)`; confirm Rocket at another listing `[D+12, D+16)` | Refused: "This pet already has a confirmed booking for some of these dates…" | CI-E2E "rejects confirming a stay when the same pet already has an overlapping confirmed booking at another listing": refused with that message, on all 3 browsers | EC-6.2-5 | P |
| TC-6.2-04 | Capacity 1; confirmed `[D+20, D+24)`; confirm `[D+24, D+28)` | Both confirmed | CI-E2E "allows back-to-back confirmed stays…": both Confirmed, on all 3 browsers | EC-6.2-2 | P |
| TC-6.2-05 | Two pending requests for the same nights on a capacity-1 listing; confirm one | The pending one never blocked the confirmation | SQL `booking_rules.test.sql` (a non-confirmed booking never blocks); `booking_cancellation_release.test.sql` (a cancelled stay frees its place) | EC-6.2-3 | P |

### US-6.4 Confirm or decline a pending request

> As a listing owner, I want to confirm or decline a pending request so that I can manage my place.

Inputs: the actor (listing owner or someone else), the action (confirm or decline), the booking's current status, and its start date.

| Class | Input | Description | V/I |
| --- | --- | --- | --- |
| EC-6.4-1 | actor, action, status | Listing owner confirms a Pending request whose start date has not passed and which fits | V |
| EC-6.4-2 | actor, action, status | Listing owner declines a Pending request | V |
| EC-6.4-3 | actor | Not the listing owner (the requester or an outsider) tries to confirm or decline | I |
| EC-6.4-4 | status | The booking is no longer Pending (changed on another screen) | I |
| EC-6.4-5 | start date | Confirming after the start date has passed | I |
| EC-6.4-6 | capacity / pet | Confirming would break the US-6.2 rules | I |

| Test case | Inputs | Expected output | Actual output | Classes | Status |
| --- | --- | --- | --- | --- | --- |
| TC-6.4-01 | Alex confirms Casey's pending `[D+5, D+8)` | Status **Confirmed** for both users | CI-E2E `booking-flow.spec.ts`: Confirmed on all 3 browsers | EC-6.4-1 | P |
| TC-6.4-02 | Alex declines a pending request | Status **Declined** | CI-E2E `booking-lifecycle.spec.ts` "a listing owner declines a pending request" | EC-6.4-2 | P |
| TC-6.4-03 | Casey (requester) or Blair (outsider) sends confirm for that booking | Refused by the database; status unchanged | SQL `booking_lifecycle.test.sql` (requester and outsider cannot confirm or decline); the UI offers no button | EC-6.4-3 | P |
| TC-6.4-04 | Booking cancelled in another tab, then Alex presses Confirm on the stale screen | "This booking was changed by someone else, so that action no longer applies. It has been refreshed." | CI-E2E `booking-detail-journey.spec.ts` "a stale confirmation is refused…": **the confirmation was refused, but the message was "Could not update this booking. Please try again."** on all 3 browsers. Cause: once cancelled, the row no longer matches the host's UPDATE policy, so the update matches no row (`PGRST116`) instead of raising the transition error the adapter maps. Defect D-1, see §6 | EC-6.4-4 | F |
| TC-6.4-05 | Pending request whose start date was yesterday | Confirm is not offered; a direct update is refused | SQL `booking_transition_rules.test.sql`; JEST `canConfirmBooking` | EC-6.4-5 | P |
| TC-6.4-06 | As TC-6.2-02 | Refused with the listing-full message | See TC-6.2-02 | EC-6.4-6 | P |

### US-6.5 Cancel a booking

> As a requester, I want to cancel my pending or confirmed booking so that I can change my plans.

Inputs: the actor, the booking's status, and today relative to its end date.

| Class | Input | Description | V/I |
| --- | --- | --- | --- |
| EC-6.5-1 | status | Requester cancels a Pending request | V |
| EC-6.5-2 | status, date | Requester cancels a Confirmed stay before its end date | V |
| EC-6.5-3 | status | Booking already Declined, Cancelled, or Completed | I |
| EC-6.5-4 | actor | The listing owner (not the requester) tries to cancel | I |
| EC-6.5-5 | date | Confirmed stay whose end date has passed | I |

| Test case | Inputs | Expected output | Actual output | Classes | Status |
| --- | --- | --- | --- | --- | --- |
| TC-6.5-01 | Casey cancels a pending request and confirms in the dialog | Status **Cancelled** | CI-E2E `booking-lifecycle.spec.ts` "a requester cancels a pending request" | EC-6.5-1 | P |
| TC-6.5-02 | Casey cancels a confirmed `[D+5, D+8)` | Status **Cancelled**; the place and the pet are free again | CI-E2E "a requester cancels a confirmed booking"; SQL `booking_cancellation_release.test.sql` | EC-6.5-2 | P |
| TC-6.5-03 | Cancel a Declined, a Cancelled, and a Completed booking | No Cancel button; a direct update is refused | SQL `booking_lifecycle.test.sql`; JEST `isValidBookingTransition` | EC-6.5-3 | P |
| TC-6.5-04 | Alex (owner) sends cancel for a pending and a confirmed booking | Refused by the database | SQL `booking_lifecycle.test.sql` (listing-owner cancellation rejected, PR #126) | EC-6.5-4 | P |
| TC-6.5-05 | Confirmed stay that ended yesterday | "This stay has already ended and can no longer be cancelled." | SQL `booking_transition_rules.test.sql`; JEST `canCancelBooking` | EC-6.5-5 | P |

## 3. EPIC E-4 Listings (manual)

### US-4.1 Create a listing

> As a listing owner, I want to create a place listing so that pet owners can discover and understand the accommodation I provide.

Inputs: title, location, description, capacity, accepted pet types, photos.

| Class | Input | Description | V/I |
| --- | --- | --- | --- |
| EC-4.1-1 | all | Title, location, and description not blank; capacity a whole number from 1 to 50; at least one supported pet type; 0 to 10 photos, each JPG/PNG/WebP/GIF of at most 10 MB | V |
| EC-4.1-2 | title | Blank or only spaces | I |
| EC-4.1-3 | location | Blank | I |
| EC-4.1-4 | description | Blank | I |
| EC-4.1-5 | capacity | Empty | I |
| EC-4.1-6 | capacity | Less than 1 (0, −1) | I |
| EC-4.1-7 | capacity | More than 50 | I |
| EC-4.1-8 | capacity | Not a whole number (2.5) | I |
| EC-4.1-9 | pet types | None selected | I |
| EC-4.1-10 | photo | Unsupported type (`.pdf`, `.heic`) | I |
| EC-4.1-11 | photo | Larger than 10 MB | I |
| EC-4.1-12 | photo | An 11th photo | I |

| Test case | Inputs | Expected output | Actual output | Classes | Status |
| --- | --- | --- | --- | --- | --- |
| **TC-4.1-01** (demo) | "Sunny garden room", "Bangkok", "Quiet house with a lawn", capacity 2, Dog + Cat, one 2 MB JPG, Publish | Listing created and shown in My listings; preview opens; visible in search signed out | REG-S3 row 14: created (Dog + Cat, capacity 2); row 15: published listing opened signed out | EC-4.1-1 | P |
| TC-4.1-02 | Title "   ", the rest as TC-4.1-01 | "Listing title is required."; not saved; other fields keep their values | REG-S3 row 15 "Required errors shown"; JEST `listingForm` | EC-4.1-2 | P |
| TC-4.1-03 | Location empty | "Location is required." | JEST `listingForm` | EC-4.1-3 | P |
| TC-4.1-04 | Description empty | "Description is required." | JEST `listingForm` | EC-4.1-4 | P |
| TC-4.1-05 | Capacity empty | "Capacity is required." | JEST `listingForm` | EC-4.1-5 | P |
| TC-4.1-06 | Capacity 0 | "Capacity must be at least 1." (boundary: 1 is accepted) | JEST `listingForm`; SQL `listing_edit_rules.test.sql` (zero capacity refused) | EC-4.1-6 | P |
| **TC-4.1-07** (demo) | Capacity 51 | "Capacity must be 50 or fewer." (boundary: 50 is accepted) | JEST `listingForm`; SQL `listing_rules.test.sql` (capacity 51 fails `listings_capacity_max_check`, PR #106) | EC-4.1-7 | P |
| TC-4.1-08 | Capacity 2.5 | "Capacity must be a whole number." | JEST `listingForm` | EC-4.1-8 | P |
| TC-4.1-09 | No pet type ticked | "Choose at least one accepted pet type." | JEST `listingForm` | EC-4.1-9 | P |
| TC-4.1-10 | Add `menu.pdf` as a photo | "Unsupported file type. Choose a JPG, PNG, WebP, or GIF file."; the rest of the form is kept | JEST `listingPhotos` "rejects an unsupported type and keeps the rest of the selection" | EC-4.1-10 | P |
| TC-4.1-11 | Add a 12 MB JPG (and a file of exactly 10 MB) | 12 MB rejected with a reason naming "10 MB"; exactly 10 MB accepted | JEST `listingPhotos` "rejects a file over the limit…", "accepts a file that is exactly at the limit" | EC-4.1-11 | P |
| TC-4.1-12 | Add an 11th photo | "A listing can have at most 10 photos." | REG-S3 row US-2.2-A; JEST `listingPhotos` | EC-4.1-12 | P |

### US-4.2 Edit a listing

> As a listing owner, I want to edit my existing listing so that its information, photos, facilities, price, and availability remain accurate.

Inputs: the editor (owner or not), the changed fields (same rules as US-4.1), photo changes.

| Class | Input | Description | V/I |
| --- | --- | --- | --- |
| EC-4.2-1 | fields | Owner changes fields to values valid under US-4.1 | V |
| EC-4.2-2 | photos | Owner adds or removes photos or picks a new main photo, staying within 10 | V |
| EC-4.2-3 | fields | A required field cleared or an invalid value (as EC-4.1-2 to EC-4.1-9) | I |
| EC-4.2-4 | editor | Someone other than the owner opens or saves the edit page | I |
| EC-4.2-5 | listing | The listing has been deleted | I |

| Test case | Inputs | Expected output | Actual output | Classes | Status |
| --- | --- | --- | --- | --- | --- |
| TC-4.2-01 | Alex changes the title to "Sunny garden room (renovated)" and the capacity to 3, saves | "Changes saved"; the detail page and search show the new values | REG-S3 row 16 "Title/capacity saved" | EC-4.2-1 | P |
| TC-4.2-02 | Alex moves the third photo to first (main) and removes one | New order and main photo persist after reload | REG-S3 row 16 "photo order change persisted after reload" | EC-4.2-2 | P |
| **TC-4.2-03** (demo) | Alex clears the location and saves | "Location is required."; nothing saved; the previous listing is unchanged | REG-S3 row US-2.2-A "Invalid listing edits … rejected" | EC-4.2-3 | P |
| TC-4.2-04 | Blair opens `/listings/<Alex's id>/edit` | "Listing unavailable … it belongs to another host"; a direct update is refused | REG-S3 row US-2.2-A; SQL `listing_edit_rules.test.sql` | EC-4.2-4 | P |
| TC-4.2-05 | Save an edit to a listing deleted in another tab | Refused, nothing changes | JEST `listingApi` "rejects an already deleted listing without sending an update"; SQL `listing_edit_rules.test.sql` | EC-4.2-5 | P |

### US-4.3 View listing detail

> As a pet owner, I want to view the complete details of a listing so that I can decide whether the place is suitable for my pet.

Inputs: the listing's state (published, draft, deleted, missing), the viewer (anyone, owner), whether its photos load.

| Class | Input | Description | V/I |
| --- | --- | --- | --- |
| EC-4.3-1 | state, viewer | Published listing, any viewer (also signed out) | V |
| EC-4.3-2 | state, viewer | Draft listing viewed by its owner (preview) | V |
| EC-4.3-3 | photos | A photo fails to load | V (degraded) |
| EC-4.3-4 | state, viewer | Draft listing viewed by someone else | I |
| EC-4.3-5 | state | Deleted listing, or an ID no listing has | I |

| Test case | Inputs | Expected output | Actual output | Classes | Status |
| --- | --- | --- | --- | --- | --- |
| TC-4.3-01 | Signed out, open a published listing | Title, description, location, photos, facilities, accepted pet types, capacity, and "Your host" | REG-S3 row 17 (also on production) | EC-4.3-1 | P |
| TC-4.3-02 | Alex opens his own draft | Preview shown, marked as a draft | JEST `ListingDetailScreen` "labels a private owner preview and links back to My Listings" | EC-4.3-2 | P |
| TC-4.3-03 | Listing whose photo URL is broken | Placeholder in place of the photo; the rest of the page still readable | JEST `ListingDetailScreen` "keeps the details and host when no photo could be signed" | EC-4.3-3 | P |
| TC-4.3-04 | Blair opens Alex's draft by URL | "Listing unavailable" | JEST `ListingDetailScreen` "uses the same safe response for missing, forbidden, and deleted listings"; RLS policy "Published listings are publicly readable" (drafts only to the owner) | EC-4.3-4 | P |
| TC-4.3-05 | Open a deleted listing's URL and `/listings/00000000-0000-0000-0000-000000000299` | "Listing unavailable" for both | REG-S3 row 16 "direct URL shows Listing unavailable" | EC-4.3-5 | P |

### US-4.4 Unpublish or delete a listing

> As a listing owner, I want to unpublish or delete my listing so that unavailable or discontinued places are not shown to pet owners.

Inputs: the action (unpublish, delete), the owner's answer in the confirmation dialog, active bookings on the listing, the actor.

| Class | Input | Description | V/I |
| --- | --- | --- | --- |
| EC-4.4-1 | action, answer | Owner unpublishes and confirms | V |
| EC-4.4-2 | action, bookings | Owner deletes a listing with no pending or confirmed booking and confirms | V |
| EC-4.4-3 | answer | Owner presses Cancel in the confirmation dialog | V (no change) |
| EC-4.4-4 | bookings | Delete while a pending or confirmed booking exists | I |
| EC-4.4-5 | actor | Someone other than the owner tries to unpublish or delete | I |

| Test case | Inputs | Expected output | Actual output | Classes | Status |
| --- | --- | --- | --- | --- | --- |
| TC-4.4-01 | Alex unpublishes "Sunny garden room", confirms | Hidden from search and its public URL; still in Alex's My listings as a draft | REG-S3 row 16 "Unpublish (with confirm) removed it from search" | EC-4.4-1 | P |
| TC-4.4-02 | Alex deletes a listing with no active booking, confirms | Gone from My listings and search; its URL shows "Listing unavailable" | REG-S3 row 16 "Delete → direct URL shows Listing unavailable" | EC-4.4-2 | P |
| TC-4.4-03 | Alex presses Delete, then Cancel | Listing unchanged | JEST `ListingsScreen` "cancels with the Cancel button and restores focus to the delete control" | EC-4.4-3 | P |
| TC-4.4-04 | Alex deletes a listing that has Casey's confirmed booking | Refused: the listing has an active booking; nothing deleted | SQL `listing_deletion.test.sql` (pending and confirmed block, other statuses do not) | EC-4.4-4 | P |
| TC-4.4-05 | Blair calls delete for Alex's listing | Refused | SQL `listing_deletion.test.sql`; JEST `listingApi` "rejects non-owners…" | EC-4.4-5 | P |

## 4. Test coverage matrix

| User story | Test case IDs | Classes covered | Status |
| --- | --- | --- | --- |
| US-6.1 | TC-6.1-01 … TC-6.1-08 | EC-6.1-1 … 8 (all) | P, P, P, P, P, P, P, P |
| US-6.2 | TC-6.2-01 … TC-6.2-05 | EC-6.2-1 … 5 (all) | P, P, P, P, P |
| US-6.4 | TC-6.4-01 … TC-6.4-06 | EC-6.4-1 … 6 (all) | P, P, P, F, P, P |
| US-6.5 | TC-6.5-01 … TC-6.5-05 | EC-6.5-1 … 5 (all) | P, P, P, P, P |
| US-4.1 | TC-4.1-01 … TC-4.1-12 | EC-4.1-1 … 12 (all) | P × 12 |
| US-4.2 | TC-4.2-01 … TC-4.2-05 | EC-4.2-1 … 5 (all) | P × 5 |
| US-4.3 | TC-4.3-01 … TC-4.3-05 | EC-4.3-1 … 5 (all) | P × 5 |
| US-4.4 | TC-4.4-01 … TC-4.4-05 | EC-4.4-1 … 5 (all) | P × 5 |

Every equivalence class appears in at least one test case: 46 classes, 51 test cases.

## 5. Demonstration (17 November 2026)

### 5.1 Manual black-box testing: EPIC E-4 Listings

Run in the browser against the demo stack, reading the inputs aloud from section 3 and comparing what appears with the Expected output column:

1. **TC-4.1-01**, create and publish a valid listing (valid class).
2. **TC-4.1-07**, capacity 51 is rejected with "Capacity must be 50 or fewer." (invalid class, boundary).
3. **TC-4.2-03**, clearing the location on edit is rejected and the saved listing is unchanged (invalid class).

### 5.2 Automated black-box testing: EPIC E-6 Booking Management

The Playwright specs drive two browser sessions (requester and host) against a freshly seeded local Supabase:

| Spec | Test cases it automates |
| --- | --- |
| `web/e2e/booking-flow.spec.ts` | TC-6.1-01, TC-6.4-01 |
| `web/e2e/booking-lifecycle.spec.ts` | TC-6.4-02, TC-6.5-01, TC-6.5-02 |
| `web/e2e/booking-conflict-and-capacity.spec.ts` | TC-6.2-01, TC-6.2-02, TC-6.2-03, TC-6.2-04, TC-6.4-06 |
| `web/e2e/booking-detail-journey.spec.ts` | TC-6.4-04, and the US-6.3 detail journey |

```bash
cd web
npx playwright test -c playwright.demo.config.ts \
  e2e/booking-flow.spec.ts e2e/booking-lifecycle.spec.ts e2e/booking-conflict-and-capacity.spec.ts \
  --project=desktop-chromium --headed
npx playwright show-report
```

Latest run: [E2E booking 43822524478](https://github.com/ziannsnp/petswap/actions/runs/43822524478) on `main`, 16 November 2026: 29 passed, 4 failed, 2 skipped by design (the seeded finished stay can be completed only once, so that test runs on desktop Chromium only). The 4 failures are the two defects in section 6.

### 5.3 Unit testing one backend function with Jest: 100% statement coverage

Function under test: `getBookingConflict()` (with its wrapper `hasBookingConflict()`) in `web/src/features/bookings/lib/bookingRules.ts`. It is the pure form of the database's availability rule (ADR 0011: peak nightly occupancy and cross-listing pet overlap). The database trigger `hold_booking_availability` makes the same decision in the same order, so the function lets the rule be tested exhaustively without a database.

```bash
cd web
npx jest src/features/bookings/lib/bookingRules.test.ts --coverage \
  --collectCoverageFrom="src/features/bookings/lib/bookingRules.ts" --coverageReporters=text
```

Result on 16 November 2026:

```text
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
 bookingRules.ts |     100 |      100 |     100 |     100 |
Tests:       92 passed, 92 total
```

Its test cases are themselves partitioned: invalid windows and capacities (throws `RangeError`), only non-confirmed stays (never block), self-check, same pet on another listing (`pet_booked`), within and over capacity including the A `[1,3)`, B `[3,5)`, C `[1,5)` capacity-2 case (overlap count is not occupancy), and back-to-back stays.

## 6. Defects found by this plan

| ID | Found by | Defect | Severity | Status |
| --- | --- | --- | --- | --- |
| D-1 | TC-6.4-04, all 3 browsers | A host who confirms a request the requester has just cancelled sees the generic "Could not update this booking. Please try again." instead of "This booking was changed by someone else…". The database correctly refuses the change; only the message is wrong. Root cause: the host's RLS update policy matches only pending or confirmed rows, so the update matches no row and PostgREST returns `PGRST116`, which `updateBookingStatus()` does not map. | Low: no wrong data, a misleading message | Open, fix in progress |
| D-2 | `booking-lifecycle.spec.ts` "a listing owner marks a finished confirmed booking completed", desktop Chromium | A test defect, not a product defect. The owner-side assertion does not wait for the detail page, so it can still see the bookings list, which now holds two completed stays (the seed gained one in PR #129), and the locator matches both. The product steps before it (complete, no actions left, requester detail) passed. | Low: test only | Open, fix in progress |
