# Manual test evidence

| Field | Record |
| --- | --- |
| Requirement / story | FR-2.1 / US-3.2 — edit or delete my pet profile |
| Tester | Liger, run with Claude Code driving the app through a Playwright script (each step's result and screenshot recorded as it ran) |
| Date and environment | 2026-10-17, `npm run dev` on `fix/pet-failure-feedback` (`main` at `6b436f8` plus this branch's fixes) against the local Supabase stack (`npx supabase db reset` before each pass) |
| Browser and viewport | Desktop: Chromium, 1280×800. Mobile: Chromium emulating Pixel 5 (393×851, touch) |
| Test data | Seed accounts from `supabase/seed.sql`, all with password `petswap-local-dev`. Signed in as `alex@petswap.test`, who owns **Miso** (no bookings) and **Nimbus** (a pending booking). Casey's **Rocket** and Blair's **Pixel** are booked at Alex's listing, so Alex can read them but does not own them. Photo fixtures: two 600×600 PNGs, an 11 MB `.png`, and a `.pdf` |

"Offline" means the browser is offline (Playwright `setOffline`, the same as DevTools → Network → Offline). "Server unreachable" means the browser stays online, but every request to Supabase is refused.

## Steps and result

### Desktop

| # | Action | Expected result | Actual result | Pass/Fail | Evidence link |
| --- | --- | --- | --- | --- | --- |
| 1 | Open **My Pets** and choose **Edit** on Miso. | `/pets/<id>/edit` opens with **Edit pet**, and the form shows the pet's name, species, breed, age, description, and photo (or the placeholder). | The form showed Miso, Cat, Domestic shorthair, 3, and the seeded description; Miso has no photo, so the paw placeholder showed. | Pass | [01](evidence/pet-desktop-01.png) |
| 2 | Change the name, breed, age, and description, then choose **Save changes**. | Returns to My Pets with **Pet saved successfully.**, and the card shows the new values. | Returned with **Pet saved successfully.**; the card shows Miso Updated, Siamese mix, 4 years, and the new description. | Pass | [02](evidence/pet-desktop-02.png) |
| 3 | Refresh My Pets, then open **Edit** again. | The saved values are still there, and the save confirmation does not show again. | The card and the form still showed the saved values; **Pet saved successfully.** was gone after the refresh. | Pass | [03](evidence/pet-desktop-03.png) |
| 4 | Clear the name and description and enter age `-1`, then `1.5`, then `101`, choosing **Save changes** each time. Then choose **Cancel**. | Field errors appear and nothing is saved; the other fields keep their input. Cancel leaves the pet unchanged. | **Pet name is required.**, **Description is required.**, **Age must be a whole number of years, 0 or more.** (for -1 and 1.5), and **Age must be 100 years or less.** (for 101); the form stayed open, and the breed was kept. After Cancel, the pet was unchanged. | Pass | [04a](evidence/pet-desktop-04a.png), [04b](evidence/pet-desktop-04b.png) |
| 5 | Choose **Change photo**, pick a PNG, choose **Use photo**, then **Adjust crop** and **Use photo** again, and save. | My Pets shows the new photo, also after a refresh. | The crop dialog opened, and both crops worked; the card shows the new photo after saving and after a refresh. | Pass | [05a](evidence/pet-desktop-05a.png), [05b](evidence/pet-desktop-05b.png) |
| 6 | On the edit screen, choose a `.pdf`, then an 11 MB `.png`. | **Unsupported file type. Choose a JPG, PNG, WebP, or GIF file.** and **Photo is larger than the 10 MB limit.** appear right away; the current photo stays. | Both messages appeared straight away, and the current photo stayed. The files were set on the input directly, like choosing "All files" in the file dialog. | Pass | [06](evidence/pet-desktop-06.png) |
| 7 | Choose **Remove photo**, then save. | My Pets shows the placeholder instead of the photo, also after a refresh. | The card shows the paw placeholder after saving and after a refresh. | Pass | [07](evidence/pet-desktop-07.png) |
| 8 | Open **Edit**, change the name, then choose **Cancel**. | Returns to My Pets; the pet is unchanged. | Returned to My Pets; the name stayed Miso Updated. | Pass | [08](evidence/pet-desktop-08.png) |
| 9 | (a) Go offline and save a name change, then go back online. (b) With the server unreachable, save another change. | (a) Nothing is lost while offline, and the change saves once back online. (b) **We could not save your changes. Check your connection and try again.** shows straight away, and the form keeps the input. | (a) The button stayed on **Saving changes...** with no error (React Query pauses saves while offline); back online, the save finished by itself and returned to My Pets with **Pet saved successfully.** (b) The error showed straight away (0 s), and the form kept the input; nothing was saved. | Pass | [09a](evidence/pet-desktop-09a.png), [09b](evidence/pet-desktop-09b.png) |
| 10 | Open `/pets/00000000-0000-4000-8000-000000000000/edit`, then `/pets/abc/edit`. | Both show **Pet not found** with **Back to my pets**. | Both showed **Pet not found** with the link. | Pass | [10a](evidence/pet-desktop-10a.png), [10b](evidence/pet-desktop-10b.png) |
| 11 | As Alex, open the edit URLs of Casey's Rocket and Blair's Pixel. | **Pet not found**; no details of the other owners' pets are shown. | Both showed **Pet not found** and no pet details, although Alex can read both pets because they are booked at Alex's listing. | Pass | [11](evidence/pet-desktop-11.png) |
| 12 | In a signed-out browser, open Miso's edit URL. | Redirects to `/login`. | Redirected to `/login`. | Pass | [12](evidence/pet-desktop-12.png) |
| 13 | On My Pets, choose **Delete** on Miso. | A **Delete <name>?** dialog opens, with focus on **Cancel**. | **Delete Miso Offline?** opened with focus on Cancel. | Pass | [13](evidence/pet-desktop-13.png) |
| 14 | Close the dialog with **Cancel**, then reopen it and press **Escape**, then reopen it and click the backdrop. | Each time, the dialog closes, the pet stays, and focus returns to the **Delete** button. | All three closed the dialog, kept the pet, and returned focus to **Delete Miso Offline**. | Pass | [14](evidence/pet-desktop-14.png) |
| 15 | Give Nimbus a photo, then choose **Delete** on Nimbus and **Delete** in the dialog. Cancel and refresh. | The dialog stays open with **Nimbus has bookings, so it can't be deleted.** After a refresh, the pet and its photo are still there. | The dialog stayed open with the message; after Cancel and a refresh, Nimbus and its photo are still there. | Pass | [15a](evidence/pet-desktop-15a.png), [15b](evidence/pet-desktop-15b.png) |
| 16 | With the server unreachable, choose **Delete** on Miso and **Delete** in the dialog. | **We couldn't delete <name>. Please try again.** shows in the dialog; the pet stays. | **We couldn't delete Miso Offline. Please try again.** showed straight away (0 s), and the cards stayed on screen; after a refresh, the pet is still listed. | Pass | [16](evidence/pet-desktop-16.png) |
| 17 | Online, open Miso's edit screen, go **Back to my pets**, then delete Miso. | The dialog closes, and the card is gone from My Pets. | The dialog closed, and the card disappeared. | Pass | [17](evidence/pet-desktop-17.png) |
| 18 | Press browser **Back** to the deleted pet's edit URL, then refresh My Pets. | **Pet not found** straight away, without the old form; after a refresh, the pet is still gone. | **Pet not found** showed, and a DOM observer confirmed the old form never appeared; after a refresh, the pet is still gone. | Pass | [18a](evidence/pet-desktop-18a.png), [18b](evidence/pet-desktop-18b.png) |

### Mobile

Same steps and expected results as desktop. On every step, the page also had to fit the screen without horizontal scrolling.

| # | Action | Expected result | Actual result | Pass/Fail | Evidence link |
| --- | --- | --- | --- | --- | --- |
| 1 | Desktop step 1 | As desktop | As desktop | Pass | [01](evidence/pet-mobile-01.png) |
| 2 | Desktop step 2 | As desktop | As desktop | Pass | [02](evidence/pet-mobile-02.png) |
| 3 | Desktop step 3 | As desktop | As desktop | Pass | [03](evidence/pet-mobile-03.png) |
| 4 | Desktop step 4 | As desktop | As desktop; each error sits under its field | Pass | [04a](evidence/pet-mobile-04a.png), [04b](evidence/pet-mobile-04b.png) |
| 5 | Desktop step 5 | As desktop | As desktop; the crop dialog fits the screen | Pass | [05a](evidence/pet-mobile-05a.png), [05b](evidence/pet-mobile-05b.png) |
| 6 | Desktop step 6 | As desktop | As desktop | Pass | [06](evidence/pet-mobile-06.png) |
| 7 | Desktop step 7 | As desktop | As desktop | Pass | [07](evidence/pet-mobile-07.png) |
| 8 | Desktop step 8 | As desktop | As desktop | Pass | [08](evidence/pet-mobile-08.png) |
| 9 | Desktop step 9 | As desktop | As desktop; the server-unreachable error showed straight away | Pass | [09a](evidence/pet-mobile-09a.png), [09b](evidence/pet-mobile-09b.png) |
| 10 | Desktop step 10 | As desktop | As desktop | Pass | [10a](evidence/pet-mobile-10a.png), [10b](evidence/pet-mobile-10b.png) |
| 11 | Desktop step 11 | As desktop | As desktop | Pass | [11](evidence/pet-mobile-11.png) |
| 12 | Desktop step 12 | As desktop | As desktop | Pass | [12](evidence/pet-mobile-12.png) |
| 13 | Desktop step 13 | As desktop | As desktop; the dialog fits the screen | Pass | [13](evidence/pet-mobile-13.png) |
| 14 | Desktop step 14 (tap the backdrop) | As desktop | As desktop | Pass | [14](evidence/pet-mobile-14.png) |
| 15 | Desktop step 15 | As desktop | As desktop; the message wraps inside the dialog | Pass | [15a](evidence/pet-mobile-15a.png), [15b](evidence/pet-mobile-15b.png) |
| 16 | Desktop step 16 | As desktop | As desktop | Pass | [16](evidence/pet-mobile-16.png) |
| 17 | Desktop step 17 | As desktop | As desktop | Pass | [17](evidence/pet-mobile-17.png) |
| 18 | Desktop step 18 | As desktop | As desktop | Pass | [18a](evidence/pet-mobile-18a.png), [18b](evidence/pet-mobile-18b.png) |

## Defects / follow-up

The first run, against `main` at `6b436f8`, found three defects. They are fixed on the same branch, and the results above are the retest.

1. **A failed delete hid its own error (step 16 failed).** The failed delete refreshed My Pets, the refresh failed too, and `PetsScreen` replaced the list with **We could not load your pets**. That unmounted the card and the dialog inside it, so **We couldn't delete …** never showed. Fixed: My Pets shows that error only when no pets are loaded.
   - Issue link: none, fixed in the same pull request
   - Owner: Squad A (Liger)
   - Retest date/result: 2026-10-17, Pass on desktop and mobile
2. **Failed saves showed their error after about 15 s (step 9b).** The hooks waited for the pet queries to refetch, even after a failure, and React Query retried each failed refetch 3 times. Fixed: after a failure, the create, update, and delete hooks still refresh the caches but no longer make the error wait.
   - Issue link: none, fixed in the same pull request
   - Owner: Squad A (Liger)
   - Retest date/result: 2026-10-17, Pass (error after 0 s) on desktop and mobile
3. **Pet saved successfully. came back after every refresh**, because the flag stayed in the browser history entry. Fixed: My Pets reads it once and clears it from history.
   - Issue link: none, fixed in the same pull request
   - Owner: Squad A (Liger)
   - Retest date/result: 2026-10-17, Pass (checked in step 3) on desktop and mobile
