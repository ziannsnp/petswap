# Testing strategy

Testing is required evidence, not a final-week activity. A test is an executable record of
product behavior: a failing test means the behavior changed, and either the implementation
regressed or the product changed on purpose and the test must be updated in the same change.

## What earns a test

Choose tests by user and operational risk, not by file count or a coverage percentage.

- Every bug fix adds the smallest stable regression test that would have prevented it.
- Use unit tests for dense, deterministic rules — booking conflict detection, status
  transitions, validation, parsing — where the rule itself is the behavior worth protecting.
- Prefer component/integration tests at public boundaries: user input, observable result, and
  the API adapter calls that cross into Supabase. Mock Supabase, routers, and clocks at that
  boundary; do not mock the code under test into a copy of its own implementation.
- Keep end-to-end tests for the few critical journeys that cannot be verified below the real
  platform boundary — currently just login → booking request → confirmation → status
  verification.
- Do not add snapshot tests for behavioral logic, or a test whose only assertion is that a
  private helper was called.

The result should be integration-heavy, with fewer focused unit tests and very few end-to-end
tests. "Fewer" never means leaving a high-risk contract — like the booking overlap rule —
unprotected.

## Test layers

| Layer | Tool | Owner and expectation |
| --- | --- | --- |
| Pure business rules | Jest | Unit-test booking conflict and status-transition rules; add tests for validation and transformations. |
| React components | Jest + React Testing Library | Cover form validation, empty/error states, and protected UI behaviour. |
| End-to-end flow | Playwright | Cover login → booking request → confirmation → status verification once Supabase test data is available. |
| Manual UI checks | Markdown evidence | Squad B records listing/search cases; QA records regressions using the template. |

[`RegisterForm.test.tsx`](../web/src/features/auth/components/RegisterForm.test.tsx) and
[`ProtectedRoute.test.tsx`](../web/src/features/auth/components/ProtectedRoute.test.tsx) are the
starter convention for the component layer: mock the hook the component directly imports
(`useSignUp`, `useAuth`) rather than the Supabase client underneath it, and assert on
user-visible roles and text (`alert`, `status`, disabled state) rather than internals. New
component tests use the `.test.tsx` suffix and opt into `jsdom` per file with a
`/** @jest-environment jsdom */` docblock; pure-logic `.test.ts` files stay on the faster `node`
environment. Both run under the existing `npm test -- --runInBand` required check — no separate
CI job is needed for this layer.

## Test quality contract

A test in the required PR gate must be:

- **Behavioral:** its name states the user-visible rule or failure mode, not an implementation
  step. Arrange/act/assert details may change without rewriting the test when the behavior is
  unchanged.
- **Deterministic and hermetic:** no live network, shared Supabase project, wall-clock
  dependence, or order dependence. Reset local Supabase state (`npx supabase db reset`) rather
  than relying on data left over from a previous run.
- **Diagnostic:** one failed assertion should identify the broken contract and the relevant
  inputs.
- **Independent:** it can run alone, in parallel, or repeatedly with the same result, and cleans
  up any state it creates.
- **Proportionate:** prefer the lowest layer that exercises the whole risk. Do not duplicate the
  same assertion at every layer — a component test that exercises the booking form should not
  re-verify `hasBookingConflict()`'s own logic.

Flaky tests are defects, not background noise. Do not hide them behind automatic retries. If an
emergency quarantine is unavoidable, link an owner and a repair issue, set a removal date, and
keep the gap visible in CI rather than silently deleting or skipping the test.

If the required PR suite's runtime grows meaningfully as automated checks are added — for
example, a Supabase database-contract job that spins up a local stack — move genuinely slow or
live-service checks to a scheduled or pre-release workflow rather than growing the required gate
unbounded. Do not weaken high-risk coverage merely to keep the gate fast.

## Required checks

Run from `web/` before opening a PR:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build
```

Run Playwright when the changed journey is testable against the configured environment. Record expected result, actual result, pass/fail, environment, and evidence in the relevant PR or [`templates/manual-test.md`](templates/manual-test.md). Durable automated tests live with the app in `web/`; this repository does not use a separate model-evals workspace.

The CI gate runs lint, typecheck, Jest, and production build for every relevant pull request; see [ci-cd.md](ci-cd.md).

## Booking minimum coverage

`hasBookingConflict()` must cover overlap, non-overlap, back-to-back bookings, a different listing, and non-confirmed existing bookings.

`isValidBookingTransition()` must cover every allowed transition and reject invalid transitions.

## Database and RLS verification

For schema or policy changes, run from the repository root:

```bash
npx supabase db reset
```

Then inspect the local database in Studio at `http://127.0.0.1:54323` and verify the actor cases listed in [environments](environments.md). The baseline SQL contract checks live in `supabase/tests/database_contract.sql`; use them as review prompts until automated authenticated database tests are added.

The booking overlap rule must be verified at both levels:

- Jest covers the TypeScript end-exclusive conflict helper.
- Postgres enforces `bookings_no_confirmed_overlap` for confirmed bookings on the same listing.

Playwright booking flow remains skipped until auth-backed screens and deterministic Supabase test users exist. When those arrive, unskip `web/e2e/booking-flow.spec.ts` and run it against the local Supabase stack.
