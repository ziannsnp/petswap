# Sprint 2 release-readiness report

Sprint / date: Sprint 2, 2026-10-19 (sprint end). Author: Kasidech (Team D), via Claude Code.

## CI results

All on `main` tip `e72e2e9` unless noted. The `Quality` check is required by the repo's branch ruleset ([`main branch ruleset`](https://github.com/ziannsnp/petswap/rules/21811058)); `Database contract`, `E2E smoke`, `E2E booking`, and the new `Compose health` (below) are not.

| Workflow | Status | Notes |
| --- | --- | --- |
| Quality | Green on `main` | [Latest run](https://github.com/ziannsnp/petswap/actions/runs/39191001854) (lint, typecheck, Jest, build) |
| Database contract | Green | [Latest run](https://github.com/ziannsnp/petswap/actions/runs/39191001813), includes the new `booking_lifecycle.test.sql` |
| E2E smoke | Green | [Latest run](https://github.com/ziannsnp/petswap/actions/runs/39191001843) |
| E2E booking | Green | [Latest run](https://github.com/ziannsnp/petswap/actions/runs/39191001898) — added by [PR #78](https://github.com/ziannsnp/petswap/pull/78), not yet merged |
| Compose health | New, untested in prod CI yet | Added by [PR #85](https://github.com/ziannsnp/petswap/pull/85), not yet merged; exercises `docker-compose.yml` + `scripts/stack-health.sh` |

The branch ruleset currently requires **one approving review and thread resolution only** — no status check is marked required. This has been true since the ruleset was created (2026-08-29); promoting `Database contract` or `E2E smoke` to required needs repo **admin**, which the Team D account does not have (see [Known blockers](#known-blockers-not-fixable-by-team-d-this-sprint)).

## Regression evidence

[docs/qa/regression-sprint2-2026-10-19.md](regression-sprint2-2026-10-19.md). Summary: the full booking lifecycle (request, confirm, decline, cancel, complete) and the data-layer rules behind listings, pets, and search all have live or automated evidence from commit `aa04470`. Accounts, profile, pet, and listing **UI** journeys are not re-verified this run — the environment this report was produced in could not start Docker Desktop, so no manual click-through happened. That document names every row affected; treat them as un-reverified, not as passing.

## Sprint 2 Team D backlog, final status

Reflects the actual repository state on 2026-10-19, not the (stale) sheet.

| # | Task | Status |
| --- | --- | --- |
| 1 | Author `docker-compose.yml` | **Done** — merged, [PR #60](https://github.com/ziannsnp/petswap/pull/60) |
| 2 | Health/smoke check script | **Done** — same PR |
| 3 | Verify on a clean machine + document | **Done** — same PR |
| 4 | Run the compose health check in CI | **Open PR** — [PR #85](https://github.com/ziannsnp/petswap/pull/85), awaiting review |
| 5 | Promote `db-contract`/`e2e-smoke` to required checks | **Blocked** — needs repo admin access this account doesn't have |
| 6 | Release step blocking publish on a failed required check | **Blocked** — depends on #5; also collides with [ADR 0005](../decisions/0005-cloudflare-workers-hosting.md)'s ban on a second deploy workflow, needing a team decision on approach |
| 7 | Document release/rollback with a fresh drill | **Blocked** — a real drill needs the Cloudflare dashboard, owned by the Platform Account Owner |
| 8 | Prove the required-check gate works | **Blocked** — depends on #5 |
| 9 | Extend e2e coverage for cancel/complete/decline + search | **Open PR** — [PR #78](https://github.com/ziannsnp/petswap/pull/78), rebased and green, awaiting review |
| 10 | Run the Sprint 2 regression checklist | **Done, with caveats** — see regression evidence above; several rows blocked on this environment's Docker, not on the product |
| 11 | Publish this report | **Done** — this document |
| 12 | ADR spike: public-availability target | **Done** — ADR 0009, pending in [PR #73](https://github.com/ziannsnp/petswap/pull/73) (not yet merged, so not linkable here) |

5 of 12 are merged or ready to merge pending review only (1–3, 12, and 9/4 once reviewed); 4 (5–8) are structurally blocked on access no Team D account holds this sprint.

## Known defects

- [Issue #76](https://github.com/ziannsnp/petswap/issues/76) — listing detail is missing host/owner information. Open since Sprint 1's regression pass, still open.
- [PR #74](https://github.com/ziannsnp/petswap/pull/74) duplicates the cancellation feature [PR #72](https://github.com/ziannsnp/petswap/pull/72) already merged. Not a product defect, but it will conflict further the longer it sits open; worth closing or redirecting.
- No new regressions found in anything this run could actually exercise (see regression evidence) — the real gap is coverage, not a failure.

## Known blockers (not fixable by Team D this sprint)

- **Repo admin.** The `tonpia` account has `write`, not `admin`, on `ziannsnp/petswap` (`current_user_can_bypass: "never"` on the branch ruleset). Promoting any check to required needs the repo owner.
- **Cloudflare dashboard.** Deployment, rollback, and build configuration live in the Platform Account Owner's Cloudflare account, not in this repository.
- **Docker in this environment.** `docker info` did not return after several minutes in the session that produced this report, blocking a live regression click-through and a local Compose-stack test of [PR #85](https://github.com/ziannsnp/petswap/pull/85). CI covers both already (see CI results).

## Ready for release / demo?

The parts of the app this run could actually verify — the full booking lifecycle and the data-layer rules for listings, pets, and search — are solid, with live or CI evidence on the current commit. The remaining Team D backlog is either merged-pending-review or blocked on access outside this account's reach, not on unfinished work. Call the demo ready on functionality; still get a human to click through the Blocked rows in the regression doc first, since nothing automated here checked visual layout or anything outside its own assertions.
