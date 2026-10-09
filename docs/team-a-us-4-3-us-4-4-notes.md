# Team A implementation notes: US-4.3 and US-4.4

Status date: 9 October 2026
Working branch: `feat/team-a-us-4-3-4-4`

The branch now includes the latest `origin/main` merge (`9331e67`), including the
group's search result cards and transactional listing deletion work.

The branch also implements US-5.1.3 and US-5.1.4 in the search screen: trimmed,
case-insensitive literal matching for location/title/description, a published-only
API predicate, and a defensive published-only client filter.

For the complete done/partial/blocked matrix across US-4.3, US-4.4, and US-5.1,
see [US implementation status](us-status-4-3-4-4-5-1.md).

## Scope order

1. Finish the public listing-details experience first because search and booking both link to it.
2. Lock down the visibility and safe-error contract before adding more owner actions.
3. Implement Team A's owner-authorized unpublish adapter and cache refresh.
4. Hand the stable detail/host and action-error contracts to Teams B and C for their assigned retrieval, delete, confirmation, and fixture work.

## Changes made

### US-4.3 listing details

- Rebuilt `ListingDetailScreen` as a responsive two-column desktop layout that collapses to one column on smaller screens.
- Added title, location, description, capacity, accepted pet types, facilities, host, and booking sections.
- Added owner-preview messaging for draft listings. The existing database RLS remains the authority that allows owners to read drafts and prevents other viewers from doing so.
- Added a safe unavailable state shared by missing, forbidden, unpublished-to-viewer, and deleted listings. This avoids confirming that a private listing exists.
- Added a distinct retry state for network and unknown service failures.
- Added loading skeletons so the route has an explicit pending state.
- Added `ListingPhotoGallery` with a main image, thumbnails, previous/next controls, Arrow Left/Arrow Right/Home/End keyboard navigation, responsive sizing, and meaningful fallback alt text.
- Added per-photo placeholders. A failed or missing signed photo URL no longer makes the listing's text details inaccessible.
- Changed signed photo URLs to `string | null` so photo failure is represented explicitly instead of throwing away the whole detail response.
- Added the minimal `ListingHost` UI contract (`id`, `display_name`, `photo_url`, and `location`). The adapter currently returns `host: null` until Team B adds the authorized host projection.
- Blocked direct rendering of rows whose status is `deleted` or whose `deleted_at` value is set, including owner reads permitted by the current RLS policy.

### US-4.4 unpublish foundation

- Added stable listing action error codes: `unauthorized`, `forbidden`, `not_found`, `deleted`, `active_booking`, `network`, and `unknown`.
- Added safe translation for permission, missing-row, active-booking, and browser network failures.
- Hardened publication-status changes to require an authenticated user, load the current row, verify ownership, reject deleted listings, and scope the update by both listing ID and owner ID.
- Hardened deletion with the same authenticated-owner/missing/deleted checks before invoking the transactional database operation; database RPC failures are translated to the same stable codes.
- Kept Supabase RLS as the authorization boundary; the client checks provide immediate and testable errors but do not replace RLS.
- Confirmed both owner-action mutations refresh the complete `['listings']` cache family after success, covering search/browse, My Listings, and detail queries.
- Integrated the group's owner action dialog, delete mutation, soft-delete migration, active-booking guard, audit timestamps, and database contract tests from the newest `main`.

### Tests and compatibility

- Added gallery tests for alt text, thumbnail selection, keyboard navigation, missing URLs, image load failure, and no-photo placeholders.
- Added detail-screen tests for complete fields, host display, owner draft preview, safe unavailable responses, and network retry.
- Added API tests for photo-signing degradation, deleted/missing visibility, successful unpublish, unauthorized access, non-owner access, repeated action protection for deleted rows, and transactional delete error mapping.
- Added error-contract tests and cache-invalidation tests for both owner actions.
- Updated the edit-listing photo preview to accept the new nullable signed-URL contract.
- Added search tests for location matching, keyword matching, case/space normalization, literal wildcard characters, and draft/deleted exclusion.

## Team handoffs and remaining work

### Team B

- Implement the listing-detail retrieval response that supplies the `ListingHost` projection without exposing private profile fields.
- Generate the private signed photo URLs server-side/through the approved adapter while preserving nullable per-photo failures.
- The delete controls and transactional deletion migration are now present from the merged group work. The remaining Team B dependency for US-4.3 is the authorized host-profile projection and retrieval API.

### Team C

- Add the published, draft, deleted, missing, host, facility, multi-photo, no-photo, and failed-photo fixtures.
- Add owner/non-owner/deleted and all booking-status fixtures for US-4.4.
- The merged action dialog covers confirmation, cancellation, keyboard focus, and pending/error states. Remaining C work is broader fixture expansion and release-level scenario coverage.

### Shared follow-up

- Add integration coverage using real Supabase RLS for anonymous published access, owner draft preview, non-owner draft denial, and deleted direct access.
- Add search and My Listings regression tests once US-5.1 cache behavior is implemented.
- Add Playwright coverage for gallery keyboard behavior and cancelled/successful owner confirmations after the Team B/C UI lands.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm test -- --runInBand`
- `npm run build`

The pre-merge Team A slice passed on 30 September 2026. After merging the newest `origin/main` and completing US-4.4.3/4.4.4, the full web suite passed 36 suites / 434 tests on 9 October 2026. The production build requires running Vite outside the restricted filesystem sandbox so esbuild can resolve its local configuration.
