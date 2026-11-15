# Test plan

Test plan for **PetSwap** (Don't Like My Pets), prepared for the Software Engineering final presentation. It is the plan-level view of the strategy in [testing.md](testing.md): what is tested, at which level, by whom, with what entry and exit criteria, and what the known risks are. Evidence lives in [qa/](qa/) and in CI runs.

## 1. Objectives

- Show that every functional requirement in [requirements.md](requirements.md) has at least one automated check at the lowest layer that exercises the whole risk.
- Protect the two rules that, if broken, break the product: confirmed stays never exceed a listing's capacity and no pet is confirmed in two places at once, and a user may only read or change what they own or are party to.
- Make the result visible: every pull request shows green or red checks, and every release candidate gets a recorded regression pass.

## 2. Scope

**In scope:** FR-1.1 to FR-5.4 (accounts, profiles, pets, listings, search and filters, bookings), database policies and constraints, Storage access rules, the `sign-in` Edge Function, desktop and mobile layouts of the main journeys.

**Out of scope:** payments, messaging, identity verification, availability calendars, ratings (see requirements), load and performance testing, penetration testing beyond the static checks listed in [ci-cd.md](ci-cd.md).

## 3. Test levels and techniques

| Level | Tool | What it tests | Technique | Count (14 Nov 2026) | Where it runs |
| --- | --- | --- | --- | --- | --- |
| Unit | Jest | Pure rules: booking conflict, transitions, form validation, error mapping | White-box, equivalence classes and boundary values (end-exclusive dates, age 0 to 100, capacity above 0) | 56 Jest test files with 1,008 tests, unit and component together | `Quality` / `web-quality` |
| Component | Jest + React Testing Library | Forms, empty and error states, protected routes | Black-box on user-visible roles and text | (included above) | `Quality` / `web-quality` |
| Integration | Jest + TanStack Query with mocked client | Query, cache, and adapter paths, for example the search screen | Black-box | (included above) | `Quality` / `web-quality` |
| Database contract | SQL on local Supabase, impersonating owner, requester, stranger, anonymous | RLS, triggers, constraints, RPCs, Storage policies | Black-box on actors and state transitions; negative tests for each denied actor | 15 SQL files in `supabase/tests/` | `Database contract` workflow |
| End to end | Playwright (desktop and mobile Chromium, desktop Firefox) | Public shell; login, request, confirm, decline, cancel, complete | Scenario-based | 4 spec files in `web/e2e/` | `E2E smoke`, `E2E booking` |
| Manual | Markdown evidence | Cross-feature regression, UI on desktop and mobile, offline and failure cases | Exploratory plus scripted checklist | 3 regression and release passes in `docs/qa/` | Before each sprint review |

## 4. Traceability: requirement to test

| Requirement | Main automated checks | Manual evidence |
| --- | --- | --- |
| FR-1.1 Register, log in, confirm email | `RegisterScreen.test.tsx`, `ProtectedRoute.test.tsx`, sign-in Edge Function checks, `booking-flow.spec.ts` (login) | `qa/email-confirmation-2026-11-10.md`, `qa/email-confirm-redirect-2026-11-12.md` |
| FR-1.2 Profile | `profile_rules.test.sql`, profile component tests | regression checklists |
| FR-2.1 and FR-2.2 Pets and care | `pet_rules.test.sql`, `pet_photo_access.test.sql`, pet component tests | `qa/pet-edit-delete-2026-10-17.md`, `qa/pet-delete-inactive-bookings-2026-10-19.md` |
| FR-3.1 and FR-3.2 Listings | `listing_rules`, `listing_edit_rules`, `listing_deletion`, `listing_photo_access`, `listing_host_access`, `listing_facility_migration` SQL tests, listing component tests | regression checklists |
| FR-4.1 and FR-4.2 Search and filters | `listing_search.test.sql`, `listing_search_filters.test.sql`, `SearchScreen.integration.test.tsx` | `qa/search-sort-reset-2026-11-07.md` |
| FR-5.1 to FR-5.4 Bookings | `bookingRules.test.ts`, `bookingApi.test.ts`, `RequestBookingForm.test.tsx`, `BookingsScreen.test.tsx`, `booking_rules.test.sql`, `booking_lifecycle.test.sql`, `booking-flow.spec.ts`, `booking-lifecycle.spec.ts` | `qa/regression-sprint2-2026-10-19.md` |

## 5. Entry and exit criteria

**Entry (a change may be tested for merge):** the branch is up to date with `main`; the PR template is filled in with the requirement and card; the squad has added the tests for its own change ([who writes the tests](testing.md#who-writes-the-tests)).

**Exit for a pull request:** lint, typecheck, Jest and build pass; `docs-links` passes; the relevant database, E2E, and security workflows are green or the failure is explained in the PR; one reviewer approved; the PR links evidence for UI changes.

**Exit for a release candidate (sprint review or demo):** all CI workflows green on `main`; regression checklist run on desktop and mobile and linked from the release-readiness note; no open defect that blocks a user journey; known issues listed.

## 6. Test environments and data

| Environment | Purpose | Notes |
| --- | --- | --- |
| Local Supabase (`supabase start`, `db reset`) | Database contract and E2E | Deterministic seed in `supabase/seed.sql` with named users (for example `alex@petswap.test`) |
| GitHub Actions runner | Required and optional workflows | Starts its own local stack; never touches the hosted project |
| Docker Compose stack | Whole system on one machine | Verified weekly by `Compose health` |
| Cloudflare preview URL | Manual check of a branch build | Informational |

Tests are hermetic and independent; the database is reset instead of relying on leftovers ([quality contract](testing.md#test-quality-contract)).

## 7. Defect handling

1. A defect found by a test or a reviewer becomes a card in the Google Sheet and, if it is a security or data-access problem, is fixed first.
2. Every fix adds the smallest regression test that would have caught it, at the lowest suitable layer. Example from the 14 November bug hunt: an access gap after a booking is declined belongs in a SQL actor test, not a browser test.
3. Flaky tests are defects, not background noise; they are not hidden behind retries.

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A test file exists but no workflow runs it | False confidence | `db-contract.yml` loops over every `*.test.sql`; a CI check lists every `web/e2e/*.spec.ts` and fails on one that no workflow runs |
| Authorization bug only visible to a specific actor | Data exposure | Actor-based SQL tests for each state change; `supabase db lint` on every database change |
| Cache shared between users in the browser | Data shown to the wrong user | Regression test on sign-out and sign-in as a different user |
| Missing input bounds | Bad data, abuse | Database `CHECK` constraints plus boundary tests |
| Vulnerable dependency or committed secret | Security | Dependabot, dependency review, CodeQL, secret scanning with push protection |
| Only some workflows are required checks | A red change can merge | Proposal to the repository owner to require `web-quality` and `docs-links` ([ci-cd.md](ci-cd.md#proposed-required-checks)) |
| Slow gate if every workflow becomes required | Developers bypass it | Job-level `if:` skips instead of trigger-level path filters |

## 9. Schedule

| Date | Activity |
| --- | --- |
| Each pull request | Required checks plus the relevant optional workflows |
| Monday, weekly | Scheduled `Database contract`, `Compose health`, and code scanning runs |
| Sprint review | Manual regression pass, evidence in `docs/qa/` |
| 17 Nov 2026 | Final presentation with the demo, design document, and this plan |

## 10. Roles

| Who | Responsibility |
| --- | --- |
| Feature squads A, B, C | Tests for their own features at every level |
| QA / Infra (Team D) | Standard, harnesses, seed data, CI gates, security checks, evidence templates, cross-feature regression pass |
| Reviewers | Confirm evidence matches the claim before approving |
