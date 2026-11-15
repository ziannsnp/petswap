# CI/CD

## Continuous integration

The `Quality` workflow runs on every pull request to `main`, whatever it changes, and on pushes to `main` that change the React app, Supabase configuration, docs, or the workflow itself. Its `web-quality` job runs:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build
```

Its `docs-links` job verifies that Markdown links under docs resolve, and its `repo-checks` job runs the repository checks listed under [Security and static analysis](#security-and-static-analysis). No pull request should merge into `main` while this gate is failing. Tonpai owns investigating CI/environment failures; the feature author owns failures introduced by their change.

## Database contract workflow

`.github/workflows/db-contract.yml` is a second workflow that boots a local Supabase stack, runs `supabase db reset`, and executes the SQL checks in `supabase/tests/` (schema contract plus the confirmed-booking overlap behaviour). It starts on every pull request to `main`, weekly on a schedule, and on demand. On a pull request its first steps check whether `supabase/migrations/**`, `supabase/seed.sql`, `supabase/config.toml`, `supabase/tests/**`, or the workflow file changed. If none did, every later step is skipped and the job finishes green in under a minute, so the check still reports.

It stays a separate workflow from `Quality` because it starts containers and is slower. Since US-D.5 (Sprint 3) its job, `Reset local database and run contract checks`, is one of the [required checks](#required-checks): a red run blocks the merge, and the person changing the schema owns fixing it.

### Supabase CLI version

Every workflow that installs the Supabase CLI (this one and `Supabase DB Push` in `Quality`) reads the version from `web/package-lock.json`, the same CLI that `npx supabase` runs locally. CI never picks up a new release on its own. They used `latest` until Supabase CLI v3.0.0 shipped on 2 November 2026: v3 cannot load a `config.toml` with an `[inbucket]` section, so every Database contract run failed before any check ran. The section is now `[local_smtp]`, which v2.108.0 and later also read.

To upgrade the CLI, bump `supabase` in `web/package.json` and let CI pick it up from the lockfile. Read the release notes before a major upgrade. In v3, `supabase db push` targets the local stack unless given `--remote`, and every change to a hosted project needs `--yes`. The `Supabase DB Push` job would need both before it could run on v3.

## E2E smoke workflow

`.github/workflows/e2e-smoke.yml` runs the Playwright smoke suite (`web/e2e/smoke.spec.ts`) on desktop and mobile Chromium, and desktop Firefox. It starts on every pull request to `main` and on demand; on a pull request that changes nothing under `web/**` (or the workflow file) its first steps skip the browser install and test run and the job finishes green. It installs a browser and starts the dev server, so it is a separate workflow rather than part of `Quality`. Since US-D.5 its job, `Public route smoke (desktop + mobile)`, is one of the [required checks](#required-checks). A red run means the app shell or router regressed and the change author owns the fix. The full Playwright journey (`booking-flow.spec.ts`) stays skipped until its screens exist; see [testing.md](testing.md).

## E2E booking workflow

`.github/workflows/e2e-booking.yml` runs the Playwright booking journeys (`booking-flow.spec.ts`, `booking-lifecycle.spec.ts`, `booking-conflict-and-capacity.spec.ts`, and `booking-detail-journey.spec.ts`) against a local Supabase stack that it starts, resets, and seeds on the runner, so nobody needs Docker locally and the shared hosted project is never touched. It runs on pull requests that touch bookings, auth, `web/e2e/**`, the Playwright config, or `supabase/` migrations/seed/config, and on demand. Like E2E smoke it is not a required check; a red run means a booking journey regressed and the change author owns the fix. Download the `playwright-booking-report` artifact from the run for screenshots and traces of any failure.
## Compose health workflow

`.github/workflows/compose-health.yml` builds and starts the self-contained `docker-compose.yml` stack ([Docker Compose stack](environments.md#docker-compose-stack)) and runs `scripts/stack-health.sh` against it. It runs on pull requests that touch `docker-compose.yml`, `docker/**`, `.env.example`, or either `scripts/stack-*.sh` script, weekly on a schedule, and on demand.

It is not a required check, and keeps its `paths` filter on the trigger: it builds images and starts containers, and it is sometimes red for reasons outside the change (see [Required checks](#required-checks)). E2E booking is likewise informational and path-filtered. Its purpose is narrower than Database contract and E2E smoke — it exists so the documented Compose setup path cannot silently rot between the times someone actually runs it by hand. A red run means a service, image, or `.env.example` change broke the stack; the change author owns the fix.

## Security and static analysis

These checks apply the DevSecOps and design-for-security topics from the course. All are free for this public repository. CodeQL's `Analyze (javascript-typescript)` and `dependency-review` are [required checks](#required-checks) since US-D.5: both run on every pull request and were green on each of their last 40 runs (checked 15 November 2026).

| Check | Workflow | Catches | Runs |
| --- | --- | --- | --- |
| CodeQL (`javascript-typescript`, `security-extended`) | `codeql.yml` | XSS sinks, unsafe redirects, injection, hard-coded credentials, regex denial of service in the app and the Edge Function. Results are under Security, Code scanning. | Pull requests, `main`, weekly |
| Dependency review | `dependency-review.yml` | A pull request that adds a dependency with a known high-severity vulnerability | Pull requests |
| Dependabot | `.github/dependabot.yml` | Outdated or vulnerable npm packages and GitHub Actions, as weekly grouped pull requests. The Supabase CLI major version is excluded because it is upgraded deliberately. | Weekly |
| Database lint | `db-contract.yml` (`supabase db lint --level error`) | Errors in database functions such as bad references and unsafe constructs. Warnings are not failing yet. | Supabase changes, weekly |
| Type-aware ESLint | `quality.yml` (`web-quality`) | `no-floating-promises` and `no-misused-promises` (dropped or swallowed async errors), cross-feature imports that skip `index.ts` | Every pull request |
| Repository checks | `quality.yml` (`repo-checks`) | Acceptance scenarios without a test, e2e specs no workflow runs, an invalid OpenAPI file | Every pull request |

Settings a repository admin must switch on, which cannot be done from a workflow file: **secret scanning** and **push protection** (Settings, Code security), and, when the team agrees, **code scanning as a required check** and **Require review from Code Owners** in the `main` ruleset.

What these do not catch, and what does: access-control bugs such as a host keeping pet access after a booking is declined are business-logic bugs that scanners cannot see. They are caught by the actor-based SQL tests in `supabase/tests/`, which `db-contract.yml` now runs for every `*.test.sql` file by glob, so a new test file can no longer be forgotten. For the same reason, `scripts/check-test-wiring.sh` fails the build when a Playwright spec exists that no workflow runs. Coverage is printed to each `web-quality` job summary as a report, not a gate: see [testing.md](testing.md).

## Main branch protection

The protected `main` branch is the only shared integration branch. The [`main` branch ruleset](https://github.com/ziannsnp/petswap/rules/21811058) requires a pull request, one approving review, and resolution of review conversations before merge. Pushing new commits to an approved pull request can dismiss the approval; GitHub's **Update branch** button has kept approvals in practice. The ruleset has no bypass list, so administrators follow the same rules. Direct pushes, force pushes, and branch deletion are blocked.

Until the repository admin applies the change below, the ruleset requires **no status checks** (read back through the API on 15 November 2026). A pull request with a red or still-running workflow can be merged once it is approved, so "the checks are the gate" is a team rule that reviewers enforce, not something GitHub enforces. Changing the ruleset needs repository admin. This is risk R5 in the [project management plan](project-management-plan.md).

### Required checks

US-D.5 (Sprint 3) agreed this set. The names are the exact check names GitHub reports, which are the job `name:` (or the job id when there is no `name:`). Renaming one of these jobs silently breaks the ruleset, so treat the names as an interface.

| Required check | Workflow | Runs |
| --- | --- | --- |
| `web-quality` | Quality | Every pull request, in full |
| `docs-links` | Quality | Every pull request, in full |
| `repo-checks` | Quality | Every pull request, in full |
| `Reset local database and run contract checks` | Database contract | Every pull request; skips its steps (green) unless database files changed |
| `Public route smoke (desktop + mobile)` | E2E smoke | Every pull request; skips its steps (green) unless `web/**` changed |
| `Analyze (javascript-typescript)` | CodeQL | Every pull request, in full |
| `dependency-review` | Dependency review | Every pull request, in full |

The rule also sets **Require branches to be up to date before merging** (`strict_required_status_checks_policy: true`), so the checks ran against the code that actually lands on `main`. With required checks, **Update branch** re-runs every check before merge.

Left out on purpose: `E2E booking` and `Compose health` keep their `paths` filters and stay informational. Both start full stacks, and Compose health is sometimes red because `public.ecr.aws` limits anonymous image pulls (`toomanyrequests`), not because of the change. The Cloudflare `Workers Builds: petswap-web` check reports a deploy, not a test. The CodeQL code-scanning check named `CodeQL` (from GitHub Advanced Security) is also not in the set; `Analyze (javascript-typescript)` already fails when the analysis fails.

Why the two path-filtered workflows changed: GitHub waits forever for a required check whose workflow never starts, and a pull request stuck like that can only be merged by changing the ruleset. Database contract and E2E smoke used to filter on `paths` at the trigger, so a pull request that touched only `docs/**` would have been stuck on "Expected". They now start on every pull request and run [`dorny/paths-filter`](https://github.com/dorny/paths-filter) (pinned by commit SHA) as their first step. When nothing relevant changed, every later step is skipped and the job ends green. The filtering is per step, not a separate job: if the filter itself errors, the required job fails instead of being skipped and counted as passing. Quality is cheap enough to run unfiltered. Its `push` trigger keeps its filter, and `Supabase DB Push` still runs only when `supabase/**` changed.

### Applying the ruleset (repository admin)

The full proposed ruleset is in [`.github/rulesets/main-branch-ruleset.json`](../.github/rulesets/main-branch-ruleset.json). It keeps every rule the ruleset has today and adds the `required_status_checks` rule (`integration_id` 15368 is GitHub Actions, so only an Actions job can satisfy a check). The [release gate](#release-gate) reads its required-check names from the same file, so update the file in a pull request first whenever the set changes, then re-apply it.

After the pull request that adds this file is merged, run from the repository root:

```bash
gh api --method PUT repos/ziannsnp/petswap/rulesets/21811058 --input .github/rulesets/main-branch-ruleset.json
```

Check that it applied (the list should include `required_status_checks` and the seven names above):

```bash
gh api repos/ziannsnp/petswap/rules/branches/main --jq '.[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context'
```

The same change through the web UI: Settings, Rules, Rulesets, `main branch ruleset`, tick **Require status checks to pass** and **Require branches to be up to date before merging**, then add the seven checks with source GitHub Actions.

### Proving the gate blocks a merge

Run this once after the ruleset is applied, and again whenever the required set changes. It shows that a red required check stops a merge and that the reason is visible on the pull request.

1. Branch from `main` as `test/us-d5-gate-proof`. Add one Jest test under `web/src/` that fails on purpose, for example `expect(1).toBe(2)`, so `web-quality` goes red.
2. Open a normal (not draft) pull request titled `test: prove the required-check gate (do not merge)`. A draft cannot be merged anyway, which would hide what is blocking it.
3. Ask a reviewer to approve it, so the failing check is the only thing in the way.
4. When the checks finish, take a screenshot of the merge box. Expected: `web-quality` failing, the other required checks green, and **Merging is blocked** with the failing required check named. From the CLI, `gh pr merge <number> --merge` should be refused for the same reason; keep its output.
5. Close the pull request without merging and delete the branch. Paste the screenshot, the pull request link, and the CLI output below.

Evidence (fill in after the drill; nothing has been recorded yet):

| Date | Pull request | Failing required check | Merge box showed "Merging is blocked"? | Recorded by |
| --- | --- | --- | --- | --- |
| | | | | |

Before the ruleset change, the [release gate](#release-gate) was checked against the last twelve merges into `main` (15 November 2026, `python scripts/release_gate.py --sha <commit>`). Six were released and six would have been blocked, every one because `Reset local database and run contract checks` or `Public route smoke (desktop + mobile)` was `missing` from the pull request: the path filters had stopped them from running. That is the gap the workflow change above closes. It shows the gate script's blocking path, not the ruleset; the drill above is still needed.

## Deployment

The web app deploys to Cloudflare Workers static assets through Cloudflare's Git integration. Cloudflare watches this repository directly. There is no GitHub Actions deploy workflow for the web app, and one must not be added while the Git integration owns deployment; see [ADR 0005](decisions/0005-cloudflare-workers-hosting.md). Supabase migration and Edge Function release stays with GitHub Actions, so the two systems never deploy the same thing. The `supabase-migration` job pushes database migrations, then deploys every function under `supabase/functions/` in a separate step — a new function needs only its folder, not a second place in CI to remember it — gated on `supabase/**` actually changing in the push.

A push to any branch other than `main` uploads a new Worker version and produces a preview URL. A push to protected `main` deploys that build to production. Cloudflare posts build status and both preview URLs as a pull-request comment. The Cloudflare check is informational and deliberately not a required check; the [required checks](#required-checks) are the gate.

### Release gate

There are two publishes, and each has its gate:

| What is published | Published by | What blocks a bad publish |
| --- | --- | --- |
| Web app (production Worker) | Cloudflare Git integration, on every push to `main` ([ADR 0005](decisions/0005-cloudflare-workers-hosting.md)) | The required checks on the pull request. Nothing reaches protected `main` except through a pull request whose required checks passed, so Cloudflare only ever builds commits that passed. Cloudflare does not wait for GitHub checks, and no GitHub Actions deploy is added for the web app. |
| Database migrations and Edge Functions (hosted Supabase) | `Supabase DB Push` in `quality.yml` | The `Release gate` job, which `Supabase DB Push` needs. |

`Release gate` runs on every push to `main` that triggers `Quality`. It runs [`scripts/release_gate.py`](../scripts/release_gate.py), which finds the pull request that produced the pushed commit, reads the latest conclusion of each [required check](#required-checks) on that pull request's head commit, and then:

- writes a **release record** to the job summary (version `main-<short sha>`, full commit, pull request, and every required check with its conclusion and link) and uploads it as the `release-record-<sha>` artifact (JSON, kept 90 days);
- fails when any required check is missing or did not pass (`success`, `skipped` and `neutral` count as passing), or when no merged pull request produced the commit;
- also fails when `web-quality`, `docs-links` or `repo-checks` failed on the pushed commit itself.

When the gate fails, `Supabase DB Push` is skipped and nothing reaches the hosted database. The red `Release gate` job on the `main` commit and the `::error::` annotation that names the failing checks make the block visible in the Actions tab and on the commit. The required-check names come from [`.github/rulesets/main-branch-ruleset.json`](../.github/rulesets/main-branch-ruleset.json), so the gate and branch protection use one list.

To dry-run the gate against any commit on `main` (read-only; needs a GitHub token in `GH_TOKEN`, for example `GH_TOKEN=$(gh auth token)`):

```bash
python scripts/release_gate.py --repo ziannsnp/petswap --sha <commit>
```

### Release procedure

1. Merge the pull request into `main` once its required checks pass and it is approved. Cloudflare builds and deploys the web app; `Quality` runs on the push.
2. Open the `Quality` run for the merge commit and read the `Release gate` summary. It is the release record: version, pull request, and the required-check results.
3. If the push changed `supabase/**`, confirm `Supabase DB Push` succeeded after the gate. If the gate failed, the database was not changed; fix forward in a new pull request.
4. Open the production URL and check the change. Confirm the Cloudflare `Workers Builds: petswap-web` check on the merge commit is green.
5. If production is broken, follow [Rollback](#rollback).

### Cloudflare project configuration

These settings live in the Cloudflare dashboard rather than in the repository.

| Setting | Value |
| --- | --- |
| Worker | `petswap-web` |
| Root directory | `web` |
| Build command | `npm run build` |
| Deploy command on `main` | `npx wrangler deploy` |
| Deploy command on other branches | `npx wrangler versions upload` |
| Build watch paths | `web/*` |
| Build variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Build token | `petswap-web-builds` |

Two of these are easy to get wrong. The Worker name must match `name` in `web/wrangler.toml`, because `wrangler` reads the name from the file rather than from the dashboard and a mismatch quietly deploys to a second Worker. The non-production deploy command must be `versions upload`: setting it to `deploy` removes preview URLs entirely and makes every branch overwrite production.

Both build variables are public values that Vite inlines into the browser bundle at build time. They must be set as build variables; runtime Variables and Secrets are invisible to Vite, and putting them there produces a site that loads but cannot reach Supabase. No secret belongs in a `VITE_`-prefixed variable, and the security boundary is the row-level security described in [Environments](environments.md), not key secrecy.

Node is pinned by `web/.nvmrc` so the Cloudflare build uses the same runtime the team develops against.

Build watch paths are set to `web/*`, intended to stop a change confined to `docs/` or `supabase/` from rebuilding the web app. As of 22 August 2026 this does not take effect: documentation-only pushes still trigger a build. The setting is left in place, but assume every push builds until someone establishes why. The only cost is wasted build minutes, and no deployment behaviour depends on it.

### Ownership and access

The Platform Account Owner holds the Cloudflare account, the build API token, and the build variables, and is the person to ask for hosting configuration changes. Recovery codes and tokens live in the team password manager and never in this repository.

### Rollback

**Web app.** Open the Worker's Deployments tab, then Version History, find the last known-good version and choose **Promote version**. Traffic moves immediately and no rebuild is required. Then open a pull request that reverts or fixes the bad change, so the next push to `main` does not redeploy it. The `Release gate` summaries list which `main-<short sha>` went out with which pull request, which helps pick the last good version.

**Database.** Supabase migrations are forward-only: there is no down migration and no rollback of `supabase db push`. A bad migration is fixed by a new migration in a new pull request, which goes through the same required checks and release gate. A promoted older Worker still talks to the migrated database, so any change touching both code and schema must be expand/contract: ship additive, backward-compatible migrations first and remove the old shape in a later release. This applies to everyone writing migrations, not only to the Cloudflare owner. Edge Functions are redeployed from `main` on the next push that changes `supabase/**`; to roll one back, revert it in a pull request.

#### Rollback drill

Only the Platform Account Owner can run this, because it needs the Cloudflare dashboard. Run it once per sprint, and after any change to the Cloudflare project configuration.

1. In Version History, note the current production version ID and the previous one.
2. **Promote version** on the previous one. Record the time.
3. Open the production URL in a private window and confirm the previous build is serving (a visible difference, or the version ID in the Deployments tab).
4. Promote the current version back and confirm production shows it again. Record the time.
5. Add a row below with screenshots of the two promotions, or tell Team D, who will record it.

| Date | Run by | Rolled back from → to (version IDs) | Restored? | Minutes to roll back | Evidence |
| --- | --- | --- | --- | --- | --- |
| 22 Aug 2026 | Platform Account Owner | Previous version promoted, then current promoted back | Yes | Not recorded | Sprint 1 record; no screenshots in the repository |
| 15 Nov 2026 | Zian (`ziannsnp`), Platform Account Owner | Previous version promoted, checked, then current promoted back (version IDs not recorded) | Yes | Not recorded | Reported to Team D by the owner; no screenshots provided |

### Failure handling

A red Quality check is the author's to fix, following the ownership rule above. A red Cloudflare build is the Cloudflare owner's; the build log names the stage that failed and the directory it ran in, which is usually enough to separate a configuration problem from a code problem. Retry build re-runs the same commit without a new push.

See [Environments](environments.md) for the deployed URLs and the Supabase redirect configuration they require.
