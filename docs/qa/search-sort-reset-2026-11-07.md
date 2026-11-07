# Search sorting and reset evidence

| Field | Record |
| --- | --- |
| Requirement / story | US-5.3 tasks 5.3.1–5.3.3; US-5.2 filter/result integration |
| Tester | Codex, driving the browser with Playwright against the real local Supabase API |
| Date and environment | 2026-11-07; `feature/search-api-filters`, based on main `6edc84d`; Vite at `http://127.0.0.1:5178`; local Supabase with the search-filter migration applied |
| Browser and viewport | Headless installed Chrome; 1440×1000, 768×1000, and 390×844 CSS pixels. These are viewport checks, not device emulation. |
| Test data | Seed data plus 13 temporary published listings titled Sort QA 01–13, location Sort Reset QA, accepting cat/dog, capacity 3–15, published on successive dates in September 2026. Listing 13 has a confirmed booking for 1–5 December 2026. All checks were anonymous. |

The combined search used location `Sort Reset QA`, keyword `Sort QA`, pet type
`cat`, minimum capacity `3`, and dates `2026-12-01` to `2026-12-05`. It matches
12 available listings, so nine appear on page 1 and three on page 2. No API
requests or booking conflicts were mocked for these browser checks.

## Steps and result

| # | Action | Expected result | Actual result | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Load a shared URL with all criteria, title sorting, and page 2. | Controls restore from the URL; the confirmed booking excludes listing 13. | Sort QA 10, 11, and 12 appeared on page 2 of 2; all criteria were restored. | Pass |
| 2 | Select Oldest, then Next. | Sorting returns to page 1 and continues the same order on page 2. | Page 1 showed 01–09; page 2 showed 10–12. The API and URL retained all criteria. | Pass |
| 3 | Select Capacity, then Next. | Capacity order applies across the whole result set. | Page 1 showed 12–04; page 2 showed 03–01. All criteria were retained. | Pass |
| 4 | Select Newest, then Next. | Newest publication first, continuing across pages. | Page 1 showed 12–04; page 2 showed 03–01. All criteria were retained. | Pass |
| 5 | Select Title, then Next. | Title order applies before paging; cached responses may be reused. | Page 1 showed 01–09; page 2 showed 10–12. No filter or page was lost when cached page 2 was reused. | Pass |
| 6 | Focus the sort control before each sort change. | It stays focused while the query changes and results arrive. | Focus remained on the same sort control after all four selections. | Pass |
| 7 | Choose Clear from the sorted, filtered second page. | Reset terms, filters, sorting, and pagination; show default listings. | URL became `/`; every form field emptied; Newest was selected; nine default listings appeared; focus returned to Location. | Pass |
| 8 | Browse default listings to page 2, then Clear. | Clear is available even when pagination is the only non-default state. | Clear appeared on page 2 and returned to page 1, then disappeared. | Pass |
| 9 | Apply Bird and minimum capacity 4 with Title sorting. Enter a backwards date range and submit. Choose Clear search in the empty state. | Show filtered no-results copy and a date error without applying invalid dates; reset everything from the empty state. | The filtered no-results state appeared; invalid dates produced the end-after-start error; Clear search cleared the dates/error, filters, sort, and URL and restored default results. | Pass |
| 10 | Inspect the populated form/results at all three widths. | No horizontal overflow; controls remain visible and usable. | Document width stayed within viewport width at 1440, 768, and 390 pixels. No browser JavaScript errors occurred. | Pass |

Screenshots: [desktop](evidence/search-sort-reset-desktop.png),
[mobile width](evidence/search-sort-reset-mobile.png).

## Automated regression evidence

- `SearchScreen.integration.test.tsx` exercises the real query hook, cache, and
  API adapter with the Supabase boundary mocked: server result order across pages,
  retained criteria, reset to defaults, browser Back, unsent filters, filtered
  no-results states, and date-error reset.
- `SearchScreen.test.tsx` covers the pagination-only Clear regression.
- Existing SQL sort checks and `listing_search_filters.test.sql` cover global
  ordering, deterministic ties, filter combinations, availability, and privacy.
- Final web suite: 52 suites and 880 tests passed. Lint, typecheck, and build passed.

## Defects / follow-up

No product defect remained after these checks. The temporary local fixtures were
removed after verification. Apply the database migration before deploying the
filter-enabled screen. Hosted deployment and non-Chrome browser checks were not performed.
