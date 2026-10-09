# US implementation status

Status date: 9 October 2026  
Branch: `feat/team-a-us-4-3-4-4`  
Latest implementation commit: see the branch `HEAD` after the US-4.4.3/4.4.4 implementation commit.

Status labels:

- **Done** — implementation and relevant tests are present.
- **Partial** — one or more assigned pieces are present, but coverage or integration remains.
- **Blocked** — dependent on another team's backend, fixture, or integration work.
- **Not started** — no implementation in this branch.

## US-4.3 — Listing details

| Item | Owner | Status | Detail |
| --- | --- | --- | --- |
| US-4.3.1 Responsive listing-details structure | A | **Done** | Responsive desktop/mobile detail layout is implemented. |
| US-4.3.2 Display title, location, description, capacity, pet types, and host | A | **Partial** | All fields and host UI are present; real host data is waiting for the backend projection. |
| US-4.3.3 Listing-detail retrieval API and response type | B | **Partial / Blocked** | Listing retrieval exists, but the response still lacks the authorized host projection. |
| US-4.3.4 Host retrieval and private signed photo URLs | B | **Partial / Blocked** | Signed photos and failure fallback exist; host retrieval is not yet supplied by the backend. |
| US-4.3.5 Published/draft/deleted/missing fixtures | C | **Partial** | Seed and deletion coverage exist, but the complete dedicated detail fixture matrix is not present. |
| US-4.3.6 Host/facility/multi-photo/no-photo/failed-photo fixtures | C | **Partial** | Unit fixtures cover several cases; the full shared matrix remains. |
| US-4.3.7 Main-photo and thumbnail gallery | A | **Done** | Main image, thumbnails, counter, and previous/next controls are implemented. |
| US-4.3.8 Photo fallback, keyboard, alt text, responsive behavior | A | **Done** | Missing/broken images, keyboard navigation, alt text, and responsive behavior are tested. |
| US-4.3.9 Public, owner-preview, unpublished, and deleted visibility | A | **Done** | RLS plus client guards enforce the visibility rules. |
| US-4.3.10 Safe missing/forbidden/deleted/photo-failure responses | A | **Done** | Typed errors and safe loading/error/placeholder states are implemented. |
| US-4.3.11 Detail fields, host, facilities, gallery, placeholders tests | A/B/C | **Done for A slice** | Component and API tests cover the Team A surface. |
| US-4.3.12 Visibility and regression tests | A/B/C | **Partial** | Unit/component tests exist; real Supabase RLS and full Playwright coverage remain. |

### US-4.3 conclusion

Team A's frontend work is complete. The only material blocker is Team B's authorized host-profile retrieval. The UI and `ListingHost` response contract are ready for that response.

## US-4.4 — Unpublish/delete

| Item | Owner | Status | Detail |
| --- | --- | --- | --- |
| US-4.4.1 Owner-only Unpublish/Delete controls | B | **Done** | Merged owner action controls are present. |
| US-4.4.2 Confirmation, cancellation, keyboard, and focus behavior | B | **Done** | Dialog supports Escape, focus trapping, focus restoration, cancel, and pending states. |
| US-4.4.3 Error codes for unauthorized/missing/deleted/active-booking cases | A | **Done** | Both unpublish and delete adapters expose stable typed codes and translate database/RPC failures without leaking backend details. |
| US-4.4.4 Owner-authorized unpublish API and cache refresh | A | **Done** | Owner checks, deleted-row protection, scoped updates, and cache invalidation are implemented and covered by API/hook tests. |
| US-4.4.5 Transactional soft deletion and active-booking checks | B | **Done** | Migration and database RPC are merged from the latest `main`. |
| US-4.4.6 Status, deleted_at, and updated_at audit persistence | B | **Done** | Soft deletion persists all required audit information. |
| US-4.4.7 Owner/non-owner/missing/already-deleted fixtures | C | **Partial** | SQL scenarios exist; a reusable UI fixture matrix is still needed. |
| US-4.4.8 Pending/confirmed/declined/cancelled/completed fixtures | C | **Done** | Local seed data includes every requested booking status. |
| US-4.4.9 Pending/success UI and cache removal | C | **Done** | Action dialog states and listing-cache invalidation are implemented. |
| US-4.4.10 Authorization, booking-blocked, network, and retry messages | C | **Partial** | Main messages exist, but all paths should use the stable typed error contract. |
| US-4.4.11 Authorization, booking restrictions, deletion, audit tests | C | **Done** | Database deletion contract tests cover these rules. |
| US-4.4.12 Confirmation, cancellation, repeated/failed request tests | C | **Done** | UI tests cover cancel, Escape, retry, success, and failure behavior. |
| US-4.4.13 Successful unpublish/delete and cancelled confirmations | A/B/C | **Done** | Successful and cancelled flows are covered. |
| US-4.4.14 Cross-feature details/search/My Listings/bookings regressions | A/B/C | **Partial** | Details, search, and My Listings are covered; broader booking regression remains. |

## US-5.1 — Search

| Item | Owner | Status | Detail |
| --- | --- | --- | --- |
| US-5.1.1 Search input, submission, URL state, clear, keyboard behavior | C | **Done** | Search form, URL persistence, clear, Escape, and navigation behavior are implemented. |
| US-5.1.2 Responsive result cards | C | **Done** | Result cards include main photo, title, location, pet types, and capacity. |
| US-5.1.3 Trimmed, case-insensitive location and keyword matching | A | **Done** | Literal matching covers trimmed location, title, and description text. |
| US-5.1.4 Published-only results and special-character safety | A | **Done** | API filters published/non-deleted rows; client defense treats wildcard/filter punctuation literally. |
| US-5.1.5 Exact/partial/mixed-case/location/title/description fixtures | C | **Partial** | Core search fixtures and tests exist; the full shared fixture matrix remains. |
| US-5.1.6 Unpublished/deleted/no-photo/no-result/pagination fixtures | C | **Partial** | Hidden/no-photo cases are covered in parts; pagination fixtures are not present. |
| US-5.1.7 Initial and active-search loading states | A | **Partial** | Query busy state exists; a distinct active-search loading experience is still needed. |
| US-5.1.8 Browse-all/no-results/error/retry/clear states | A | **Partial** | Browse-all and clear work; explicit no-results, error, and retry UI remain. |
| US-5.1.9 Pagination with deterministic ordering and retained state | B | **Not started** | No pagination implementation yet. |
| US-5.1.10 Search indexes and query-plan inspection | B | **Not started** | No search-specific index/query-plan work yet. |
| US-5.1.11 Matching/case/special-character/order/page-boundary tests | B | **Partial** | Matching, case, and special-character tests exist; ordering/page-boundary tests await pagination. |
| US-5.1.12 Browse/search/clear/navigation/no-results tests | A/B/C | **Partial** | Browse, submit, clear, URL, and navigation tests exist; no-results/error coverage remains. |
| US-5.1.13 Hidden listings/photo failures/API errors/pagination integration | A/B/C | **Partial** | Published-only and photo fallback behavior exist; API error and pagination integration remain. |

## Verification

- 36 Jest suites passed.
- 434 tests passed.
- Lint passed.
- Typecheck passed.
- Production build passed.
- Working tree was clean before this status document was added.

## Remaining next steps

1. Team B: supply the authorized public host profile projection for US-4.3.
2. Team C: complete shared fixture matrices for listing details, deletion, and search.
3. Team A/C: add explicit search no-results/error/retry states.
4. Team B: implement pagination, deterministic ordering, indexes, and query-plan validation.
5. Shared: add real Supabase RLS and Playwright regression coverage.
