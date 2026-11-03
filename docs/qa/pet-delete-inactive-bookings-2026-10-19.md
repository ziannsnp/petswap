# Manual test evidence

| Field | Record |
| --- | --- |
| Requirement / story | FR-2.1 / US-3.2 — delete my pet once none of its bookings is active ([testing.md](../testing.md#manual-pet-edit-and-delete-journey) steps 7 and 10) |
| Tester | Liger, run with Claude Code driving the app through a Playwright script (each step's result and screenshot recorded as it ran, with database checks through `psql`) |
| Date and environment | 2026-10-19, `npm run dev` on `fix/pet-delete-inactive-bookings` (`main` at `e72e2e9` plus this branch) against the local Supabase stack (`npx supabase db reset` before each pass) |
| Browser and viewport | Desktop: Chromium, 1280×800. Mobile: Chromium emulating Pixel 5 (393×851, touch) |
| Test data | Seed accounts from `supabase/seed.sql`, all with password `petswap-local-dev`. Signed in as `alex@petswap.test`, who owns **Nimbus** (a dog with one pending booking at Blair's **Countryside cottage**, which accepts dogs and rabbits) and **Miso** (a cat, no bookings). Blair (`blair@petswap.test`) hosts that booking. Photo fixture: a PNG |

Local stack note: on this machine, the local `storage-api` (v1.72.1, started by Supabase CLI 2.121.0) is older than the storage schema in the database, so every photo upload failed with a 500 (`42P10`, no unique index for its `ON CONFLICT (name, bucket_id)`). This affects `main` too and is not part of this change. To run the test, a unique index on `storage.objects (bucket_id, name)` was added to the local database only, after each reset. It is not in the repository.

## Steps and result

### Desktop

| # | Action | Expected result | Actual result | Pass/Fail | Evidence link |
| --- | --- | --- | --- | --- | --- |
| 1 | Give Nimbus a photo on its edit screen and save. Open Countryside cottage. | The photo is saved. Nimbus can be chosen for a booking there. | **Pet saved successfully.**; `photo_url` points at a file in `pet-photos`. The pet choice lists **Nimbus (Dog)**. | Pass | [01](evidence/pet-delete-desktop-01.png) |
| 2 | On My Pets, choose **Delete** on Nimbus, then **Delete** in the dialog. Cancel and refresh. | The pending booking blocks the delete: **Nimbus has active bookings, so it can't be deleted.** After a refresh, the pet and its photo are still there. | The dialog stayed open with that message. After Cancel and a refresh, Nimbus is listed, `deleted_at` is empty, and the photo is kept. | Pass | [02a](evidence/pet-delete-desktop-02a.png), [02b](evidence/pet-delete-desktop-02b.png) |
| 3 | Under **Bookings**, choose **Cancel booking** on Nimbus's outgoing request. | The request shows **Cancelled**. | The card shows **Cancelled**; Nimbus's only booking is now `cancelled`. | Pass | [03](evidence/pet-delete-desktop-03.png) |
| 4 | On My Pets, delete Nimbus again, then refresh. | The delete succeeds: the dialog closes and the card is gone, also after a refresh. The photo file is removed. | The dialog closed and the card disappeared, also after a refresh. In the database, `deleted_at` is set, `photo_url` is empty, and no file is left at the old path. | Pass | [04](evidence/pet-delete-desktop-04.png) |
| 5 | Open Countryside cottage, then Nimbus's edit URL. | Nimbus is no longer offered for a booking. The edit URL shows **Pet not found**. | The form shows **None of your pets match what this listing accepts.** (Alex's other pet, Miso, is a cat). The edit URL shows **Pet not found**. | Pass | [05a](evidence/pet-delete-desktop-05a.png), [05b](evidence/pet-delete-desktop-05b.png) |
| 6 | Open **Bookings** as Alex, then sign in as Blair and open **Bookings**. | Booking history keeps the deleted pet on both sides. | Alex's outgoing and Blair's incoming request both show **Nimbus (Dog)**, **Cancelled**, Countryside cottage, Dec 1 – Dec 6, 2026. | Pass | [06a](evidence/pet-delete-desktop-06a.png), [06b](evidence/pet-delete-desktop-06b.png) |

### Mobile

Same steps and expected results as desktop. On step 2, the page with the dialog was also measured to fit the screen without horizontal scrolling; the other steps were checked from their screenshots.

| # | Action | Expected result | Actual result | Pass/Fail | Evidence link |
| --- | --- | --- | --- | --- | --- |
| 1 | Desktop step 1 | As desktop | As desktop | Pass | [01](evidence/pet-delete-mobile-01.png) |
| 2 | Desktop step 2 | As desktop | As desktop; the message wraps inside the dialog | Pass | [02a](evidence/pet-delete-mobile-02a.png), [02b](evidence/pet-delete-mobile-02b.png) |
| 3 | Desktop step 3 | As desktop | As desktop | Pass | [03](evidence/pet-delete-mobile-03.png) |
| 4 | Desktop step 4 | As desktop | As desktop | Pass | [04](evidence/pet-delete-mobile-04.png) |
| 5 | Desktop step 5 | As desktop | As desktop | Pass | [05a](evidence/pet-delete-mobile-05a.png), [05b](evidence/pet-delete-mobile-05b.png) |
| 6 | Desktop step 6 | As desktop | As desktop | Pass | [06a](evidence/pet-delete-mobile-06a.png), [06b](evidence/pet-delete-mobile-06b.png) |

## Defects / follow-up

No defects in this change. One environment problem, outside this change:

1. **Local photo uploads fail with a 500** because the local `storage-api` is older than the database's storage schema (see the note above). Worked around for this run with a local-only index.
   - Issue link: none yet; to raise with QA / Infra
   - Owner: QA / Scrum / Infra (Tonpai)
   - Retest date/result: not retested
