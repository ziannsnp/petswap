# Sprint 3 release-readiness report

Sprint / date: Sprint 3, 2026-11-15, the day before the Sprint Review. Author: Kasidech (Team D), via Claude Code.

## CI results

All results are on `main` tip `afe55b0` (the merge of [PR #130](https://github.com/ziannsnp/petswap/pull/130)) unless noted. Since 15 November the [`main branch ruleset`](https://github.com/ziannsnp/petswap/rules/21811058) requires seven checks to pass on an up-to-date branch: `web-quality`, `docs-links`, `repo-checks`, `Reset local database and run contract checks`, `Public route smoke (desktop + mobile)`, `Analyze (javascript-typescript)` and `dependency-review` ([ci-cd.md](../ci-cd.md#required-checks)).

| Workflow | Status | Notes |
| --- | --- | --- |
| Quality | Green on `afe55b0` | [Run](https://github.com/ziannsnp/petswap/actions/runs/43724064981). On `main` it includes the new `Release gate` job in front of `Supabase DB Push` |
| CodeQL | Green on `afe55b0` | [Run](https://github.com/ziannsnp/petswap/actions/runs/43724065010) |
| Database contract | Green | Last scheduled run on `main` [green](https://github.com/ziannsnp/petswap/actions/runs/42654524291). Since US-D.5 it runs on every pull request as a required check |
| E2E smoke | Green | Runs on every pull request as a required check; last run [green](https://github.com/ziannsnp/petswap/actions/runs/43724893528) |
| E2E booking | Green on its last pull requests | Informational (keeps its `paths` filter). Booking journeys run first; the navbar logout spec runs after them with one worker ([#113](https://github.com/ziannsnp/petswap/pull/113)) |
| Compose health | Green | Last scheduled run on `main` [green](https://github.com/ziannsnp/petswap/actions/runs/42840920836). Informational because public ECR throttles anonymous pulls |
| Dependency review | Green | Blocking since the dependency graph was turned on ([#116](https://github.com/ziannsnp/petswap/pull/116)) |

**Gate proof.** [#131](https://github.com/ziannsnp/petswap/pull/131) added a test that fails on purpose. `web-quality` went red, and GitHub reported the pull request as `BLOCKED`, with the check marked **Required**. The six other required checks passed. The pull request was closed without merging. Details are in [ci-cd.md](../ci-cd.md#proving-the-gate-blocks-a-merge).

## Regression evidence

The run is recorded in [regression-sprint3-2026-11-14.md](regression-sprint3-2026-11-14.md). Every Sprint 1 and Sprint 2 row was re-run, including the Sprint 2 "Blocked (environment)" rows, on the Docker Compose stack. Signed-out rows were also run against production.

The run found one fail and four observations. Each has since been fixed:

| Item | Fixed by |
| --- | --- |
| F1: privacy and terms placeholder note | [#113](https://github.com/ziannsnp/petswap/pull/113) |
| O1: wrong nav highlight | [#114](https://github.com/ziannsnp/petswap/pull/114) |
| O2: stale listing error | [#114](https://github.com/ziannsnp/petswap/pull/114) |
| O4: stale pending requests | Expiry rules in [#108](https://github.com/ziannsnp/petswap/pull/108) |

Also fixed during the bug hunt:

- Data security: cached data was cleared on user change ([#105](https://github.com/ziannsnp/petswap/pull/105)), and host access to pets was limited by booking status ([#109](https://github.com/ziannsnp/petswap/pull/109)).
- Input limits ([#106](https://github.com/ziannsnp/petswap/pull/106)).
- Avatar replacement ([#107](https://github.com/ziannsnp/petswap/pull/107)).

O3 (cancel without a confirmation dialog) was not re-checked for this report.

## Sprint 3 Team D backlog, final status

| # | Task | Status |
| --- | --- | --- |
| 1 | Get the compose-health CI workflow green | **Done** on 3 Nov (first green run on `main`) |
| 2 | Agree the required-check set and promote db-contract and e2e-smoke to required | **Done** on 15 Nov. The set was agreed and the workflows changed in [#130](https://github.com/ziannsnp/petswap/pull/130), and the ruleset was applied by the repo owner |
| 3 | Release step that records the version and check results and blocks publishing on a failed required check | **Done** on 15 Nov: the `Release gate` job and `scripts/release_gate.py` ([#130](https://github.com/ziannsnp/petswap/pull/130)) |
| 4 | Release and rollback procedure in `docs/ci-cd.md` with a fresh rollback drill | **Done** on 15 Nov. The procedure is in [#130](https://github.com/ziannsnp/petswap/pull/130), and Zian ran the drill on 15 Nov ([ci-cd.md](../ci-cd.md#rollback-drill)) |
| 5 | Prove the gate works with a failing required check | **Done** on 15 Nov ([#131](https://github.com/ziannsnp/petswap/pull/131)) |
| 6 | Re-run the Sprint 2 regression checklist's Blocked (environment) rows with Docker | **Done** on 14 Nov ([#110](https://github.com/ziannsnp/petswap/pull/110)) |
| 7 | Close or redirect the duplicate booking-cancellation PR | **Done**. [#74](https://github.com/ziannsnp/petswap/pull/74) was redirected on 5 Nov and closed on 14 Nov |

Team D also did unplanned work this sprint:

- [#96](https://github.com/ziannsnp/petswap/pull/96): fixed the Database contract CI after Supabase CLI v3.
- [#97](https://github.com/ziannsnp/petswap/pull/97): `npm run typecheck` now checks the whole app.
- [#105](https://github.com/ziannsnp/petswap/pull/105)–[#114](https://github.com/ziannsnp/petswap/pull/114): bug-hunt fixes.
- [#115](https://github.com/ziannsnp/petswap/pull/115): course deliverables.
- [#116](https://github.com/ziannsnp/petswap/pull/116): CodeQL, dependency review, Dependabot, database lint and a coverage report.
- [#123](https://github.com/ziannsnp/petswap/pull/123): Dependabot ignores for major upgrades that break CI.

## Known defects and open items

- [Issue #24](https://github.com/ziannsnp/petswap/issues/24) asks for hook-level tests for `useAuth`. It is about coverage, not a product defect.
- Dependabot ignores four majors on purpose: TypeScript 7, Vite 8 with plugin-react 6, and react-hooks 7. Each needs its own upgrade pull request ([#123](https://github.com/ziannsnp/petswap/pull/123)).
- Email confirmation only runs on hosted Supabase, because the local stack auto-confirms. Re-check it on the deployed site before the demo.

## Known blockers

There are none for Team D. The two Sprint 2 blockers are resolved: required checks needed repository admin, and the rollback drill needed the Cloudflare dashboard. Zian did both on 15 Nov.

## Ready for release / demo?

Yes. Every Team D card for Sprint 3 is done. `main` is green, and since 15 Nov no pull request can merge with a red required check. The full regression passed, and its fail and the observations re-checked here are fixed.
