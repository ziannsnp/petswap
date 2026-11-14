# SE course alignment and CI security analysis

Research note for Team D (QA / Infra), written 14 November 2026. It answers two questions: does PetSwap show what the Software Engineering course (2110423, 2026/1) has taught, and which static-analysis and security checks are worth adding to CI. It changes no code or workflow.

**How it was researched.** The course page on myCourseVille was read in the user's browser, read-only: lecture titles, the Schedule tab, and announcements. The slide PDFs were **not** opened or downloaded, so the topic list comes from titles and the schedule, not slide bodies. The Assignments tab says "not yet included". The repo was read at `main` (`AGENTS.md`, `docs/`, `.github/workflows/`, ADRs, `supabase/tests/`). `ziannsnp/petswap` is **public**, which matters for pricing below.

## Heads-up: the course deadline is Tuesday 17 Nov, not Monday 16 Nov

Schedule row 20 (17 Nov, 08:00–11:00) is the final project presentation: **"Software for Sprint 3, Design document and Test plan, and project demonstration."** Two of those four items are documents we do not have as named artifacts yet (see item 1 below). The earlier presentation announcement (20 Oct) also asked for quality-assurance activities, a burndown chart, daily-meeting evidence and GitHub contributor graphs; expect the same list again.

## Top 5: do next

Ranked by visible course alignment per hour of effort. "Owner" is the squad that should do it; Team D reviews and wires CI.

| # | Do this | Course hook | Effort | Owner |
| --- | --- | --- | --- | --- |
| 1 | **Write the Design document and the Test plan** as two named files: `docs/design-document.md` (Mermaid: use-case diagram, ER diagram of the schema, sequence diagram for request → confirm booking, component/deployment diagram of SPA → Supabase → Cloudflare, plus the booking state machine from ADR 0003) and `docs/test-plan.md` (a thin plan that links `testing.md`: scope, levels, entry/exit criteria, environments, schedule, risks, evidence links). | 17 Nov submission asks for exactly these; lectures on use case, activity, sequence, component and deployment diagrams, testing levels | 3–4 h total; each squad draws its own feature's sequence diagram (about 30 min each), Team D assembles and writes the test plan | All squads draw; Team D assembles |
| 2 | **Add a DevSecOps baseline**: CodeQL workflow (`javascript-typescript`), `.github/dependabot.yml` (npm + github-actions), `actions/dependency-review-action` on PRs, and switch on secret scanning with push protection in repo settings. | Lecture 3 Nov: "CI/CD, DevOps, DevSecOps; Design for security (OWASP)" | 1–1.5 h, no code changes | Team D |
| 3 | **Make database security checks first-class**: add `supabase db lint --level warning` (and the splinter advisors if the CLI version supports it), replace the 15 hand-listed `psql -f` steps in `db-contract.yml` with a glob loop so a new `*.test.sql` can never be left out, and add an RLS test for the host-keeps-pet-access-after-decline bug. | OWASP broken access control; testing levels; QA activities | 2–3 h | Squad C (booking) writes the RLS test; Team D does lint + glob |
| 4 | **Show quality metrics and architecture rules as automated checks**: `jest --coverage` printed in the job summary (report only, no threshold yet), and enforce the existing "cross-feature imports only via `index.ts`" rule with `no-restricted-imports` (or `eslint-plugin-boundaries`). Add `complexity`/`max-lines-per-function` as warnings to give refactoring a number. | Lecture 29 Sep: coupling and cohesion; Lecture 20 Oct: bad smells and refactoring; 10 Nov: SQA and Measurement | 2 h | Team D |
| 5 | **SCM / SQA one-pager and enforcement**: a short `docs/sqa-scm-plan.md` mapping what we already do (branch rules, PR template, one approval, ADRs, CI gates, regression checklists) to the SCM and SQA lecture vocabulary and ISO 29110 work products; add `.github/CODEOWNERS`; ask the repo admin to make `web-quality` and `docs-links` required checks (already proposed in `ci-cd.md`). | Lectures 10 and 12 Nov: SCM, SQA, Measurement, ISO 29110 (1% of the final) | 1–2 h; the required-checks change needs the repo admin | Team D, with the repo owner for the ruleset |

Everything below supports this list. Items 2–5 can be shipped as small separate PRs, each with its own doc note in `ci-cd.md`, so the teacher sees a visible CI change per lecture topic.

## Part 1: course alignment

### What the course has taught (from the Schedule tab and materials folder)

| Date | Topic (instructor in schedule) | PetSwap status |
| --- | --- | --- |
| 4 Aug | Course overview; class project. SDLC models and management (slides: 1. Intro to SDLC) | **Partly.** `team-protocol.md` and `getting-started.md` describe the process, but no document names the SDLC model we follow or why. |
| 11 Aug | Scrum terminology, agile development (2. Intro to Agile + Scrum) | **Yes.** Squads, mini Scrum Masters, Monday/Thursday DSMs, sprint backlog and burndown in the Google Sheet, `team-protocol.md`, definition of done. Evidence lives in Drive, not the repo. |
| 18 Aug (+ 20 Aug lab) | Project management: feasibility, scope, schedule, effort/cost (COCOMO II), resources, risk (3. SW Project Mgt) | **Partly.** Burndown and sprint plan exist in the Sheet. No risk register or effort estimate in the repo. |
| 25 Aug | BDD and TDD; Gherkin and Cucumber (4.) | **Partly.** `testing.md` states a test-first-ish contract ("every bug fix adds a regression test") and tests are behaviour-named. No Gherkin acceptance scenarios, and no BDD tooling. |
| 25 Aug, 15 Sep, 20 Oct | Project presentations: product backlog, sprints 1–3 | **Yes** (done; Sheet). |
| 1 and 8 Sep | Requirements gathering; functional modelling (use case), business process and structural modelling (activity diagram), behavioural modelling (sequence diagram), UI prototyping (5-1, 5-2, 6-1, 6-2) | **Partly.** `requirements.md` has user stories and acceptance criteria, and `design.md` points to the VibeCode UI reference. There are **no diagrams** anywhere in `docs/` (no use case, activity, sequence or ER diagram). |
| 15 Sep | API design, OpenAPI/Swagger, UML profile for REST (7-1, 7-2) | **Doesn't, by design.** PetSwap has no REST layer of its own; the browser calls Supabase's generated API plus one Edge Function (`sign-in`). The DB contract tests and `database.types.ts` play the role of the interface spec. Worth one paragraph in the design document explaining this. |
| 21 Sep | Midterm exam | n/a |
| 29 Sep | Software design concepts: architecture, component/subsystem, deployment diagrams; coupling and cohesion (8. SW Design) | **Partly.** `architecture.md` and ADR 0001 describe feature-based architecture, which is a coupling/cohesion argument in practice, and the `index.ts` public-API rule limits coupling. No component or deployment diagram, no metric, and the boundary rule is a convention, not an enforced lint. |
| 6 Oct | Software testing: black-box and white-box techniques, levels of testing (9.) | **Yes, strongest area.** Unit (Jest), component (RTL), integration, SQL contract tests (15 files), Playwright E2E smoke, booking and lifecycle journeys, manual evidence in `docs/qa/`, regression checklists per sprint. Missing: stated use of equivalence classes/boundary-value language, and a coverage number. |
| 13/15 Oct | User interface design; Figma assignment (10.) | **Yes.** `design.md`, Team A's VibeCode reference app, desktop and mobile verification in the definition of done. |
| 20 Oct | Bad smells and refactoring | **Partly.** Refactors happen in PRs, but nothing records smells found or metrics before and after. |
| 27 Oct | System design from non-functional requirements; web services and microservices; Docker (12., 13.) | **Yes.** Docker Compose stack (ADR 0008), Compose health workflow, ADR 0005 (Cloudflare Workers), ADR 0009. NFRs are scattered, not listed in one place. |
| 3 Nov | AI in SDLC and responsible AI use (11., plus AI extension slides); CI/CD, DevOps, DevSecOps (15.); Design for security / OWASP (14.) | **Partly.** `conventions.md` covers AI assistance. CI/CD is strong (Quality gate, DB contract, E2E, Compose health, Cloudflare deploy, rollback drill). Security is applied by design (RLS, private buckets, signed URLs, no secret in `VITE_` vars) but **no security automation** exists in CI. This is the gap the course just taught. |
| 10 Nov | Invited talk (enterprise SDLC and AI transformation) | n/a |
| 12 Nov (video) | Software maintenance (16.), SCM (17.), SQA and Measurement (18.), SE standards ISO 29110 (19.; 1% of final) | **Partly.** SCM is practised well (protected `main`, branch-per-card, PR template, ADRs, Git history). SQA is practised (checklists, evidence templates) but not named. Measurement and ISO 29110 work products are absent. |
| 17 Nov | Final presentation: Sprint 3 software, **Design document**, **Test plan**, demo | See item 1. |
| 27 Nov | Final exam | n/a |

### Summary of the gaps that a teacher would notice

1. No diagrams or named design document (UML is a third of the lecture list).
2. No named test plan, although the strategy exists.
3. No security automation after the DevSecOps/OWASP lecture.
4. No metrics at all (coverage, complexity, coupling), after the Measurement lecture.
5. No Gherkin-style acceptance scenarios (cheap to add for the two or three critical journeys; optional).

The things the project already does very well, and should lead the presentation with: layered testing with Postgres-level RLS tests, an ADR trail (10 ADRs), protected `main` with PR review, a real CI/CD pipeline including a DB deploy and a documented rollback, and the deterministic seed data.

## Part 2: static analysis and security in CI

### Current state

- `quality.yml`: `npm run lint` (ESLint with `typescript-eslint` **recommended**, react-hooks, react-refresh), `tsc`, Jest with `--runInBand`, `vite build`, and the docs-links check; plus the `Supabase DB Push` job on pushes to `main`.
- `db-contract.yml`: boots local Supabase and runs the SQL tests, one `psql -f` step per file. Currently every file in `supabase/tests/` is listed (checked 14 Nov), but the list is hand-maintained.
- `e2e-smoke.yml` runs only `smoke.spec.ts`. `e2e-booking.yml` runs only `booking-flow.spec.ts` and `booking-lifecycle.spec.ts`. **`navbar-account-menu.spec.ts` is run by no workflow** (`testing.md` says so explicitly). This is the "spec that never ran in CI" class.
- None of the workflows is a required check; the `main` ruleset requires no status checks (see `ci-cd.md`).
- No Dependabot, no CodeQL, no secret scanning config in the repo. `npm audit` run on the lockfile today reported **0 vulnerabilities**.
- There is no Jest coverage collection and the repo has no `.github/CODEOWNERS`.

### Mapping today's bug-hunt findings to tool classes

| Finding | What would actually catch it |
| --- | --- |
| RLS gap: a host keeps pet access after declining the booking | **An actor-based SQL test** (a host, before and after decline, reads the pet photo or pet row). Linters and SAST do not understand booking-state business logic. `db lint` will not flag it. A good fit for Squad C extending `booking_lifecycle.test.sql` / `pet_photo_access.test.sql`. |
| React Query cache leaks between users | **A regression test**: sign out then sign in as another user and assert the cache is empty (RTL, mocked client). A custom Semgrep rule ("`signOut` must be followed by `queryClient.clear()`") is possible but is more effort than the test. Generic SAST does not catch it. |
| Missing input bounds | Partly **DB `CHECK` constraints plus a SQL boundary test** (insert max+1, expect failure). Semgrep/CodeQL cannot know our intended bounds. `typescript-eslint` strict will not help either. |
| Spec never ran in CI | **A CI structure fix**, not a scanner: run `npx playwright test` with no file list (or a `--grep`/project split), and loop over `supabase/tests/*.test.sql`. Cheap and removes the whole class. |

Takeaway: none of the real bugs would have been caught by the standard scanners. They are access-control and test-coverage bugs. The scanners are still worth adding for the course (and they catch a different class: injection, XSS, secrets, vulnerable dependencies), but the highest-value engineering work is the SQL RLS test and the glob fix.

### Candidates

All of these are free for this repo because it is **public**: GitHub Actions minutes for public repositories are free and unmetered, and CodeQL, Dependabot, dependency review and secret scanning with push protection are free on public repositories. (Whether secret scanning is already switched on in Settings could not be read with the available permissions; it needs a repo admin to check.) "Minutes" are rough runner time per run.

| Candidate | What it catches | Setup effort | CI minutes | False-positive risk | Free here? | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **CodeQL** (`javascript-typescript`) | XSS sinks (`dangerouslySetInnerHTML`, `innerHTML`), unsafe URL/redirect handling, prototype pollution, regex DoS, hard-coded credentials, insecure randomness in the SPA and Edge Function | Low: one workflow from GitHub's template (about 15 lines) | 3–6 per run on a PR; can also run weekly | Low to medium. A small React SPA usually yields zero to a few alerts, mostly informational | Yes (public repo) | **Do (item 2).** Strongest course match for DevSecOps/OWASP. Would not have found any of today's four bugs. |
| **Dependabot + `npm audit` + dependency review** | Known-vulnerable or outdated dependencies and Actions versions. Dependency review blocks a PR that adds a vulnerable package | Very low: a 15-line `dependabot.yml` and a 5-line workflow. `npm audit --omit=dev --audit-level=high` as a step is optional | Under 1 per run | `npm audit` can flag dev-only or unreachable issues; limit it to `--omit=dev` and `high`. Dependabot PR noise: group updates and set a weekly schedule | Yes | **Do (item 2).** Today's audit is clean, so adding it now shows a green baseline. |
| **gitleaks / GitHub secret scanning** | Committed API keys and tokens. Note `VITE_SUPABASE_PUBLISHABLE_KEY` is intentionally public, so a generic scanner may flag it | Low: native secret scanning + push protection is a Settings toggle. gitleaks is a 10-line workflow | 1 per run | Medium for gitleaks (anon/publishable keys, JWT-shaped test fixtures); needs a small allowlist. Native scanning has few false positives | Yes. Native scanning and push protection are free on public repos | **Do the native toggle; skip gitleaks** unless the allowlist is cheap. Needs repo admin for the toggle. |
| **`typescript-eslint` strict / stylistic** | `no-floating-promises`, `no-misused-promises`, `no-unnecessary-condition`, unsafe `any` uses. Floating promises are a real bug class in async Supabase code | Medium: `strictTypeChecked` needs type-aware linting; expect a few dozen warnings to triage | +1 to lint time | Medium at first; fixes are mostly mechanical | Yes | **Do selectively:** turn on `no-floating-promises` and `no-misused-promises` only, as errors; leave the rest as warnings. |
| **`eslint-plugin-security`** | Node-oriented heuristics (`detect-object-injection`, non-literal `RegExp`, `eval`). Little relevance to a browser SPA | Low | Negligible | **High**: `detect-object-injection` is famously noisy on normal `obj[key]` code | Yes | **Skip.** CodeQL covers the useful part with far fewer false positives. |
| **Jest coverage thresholds** | Untested code growth. A number is a "Measurement" artifact for the teacher | Low to measure (`--coverage`), medium to set sensible per-folder thresholds | +0.5 to 1 | Low, but a global threshold invites gaming; `testing.md` deliberately says not to chase a percentage | Yes | **Report only (item 4):** print coverage in the job summary, set a low floor (for example 60%) only after seeing the baseline. Do not gate on it yet. |
| **Semgrep** (OSS rules, `p/typescript`, `p/react`, `p/owasp-top-ten`) | Overlaps CodeQL; its advantage is quick custom rules, such as "no `supabase` import in components" or "`signOut` needs `queryClient.clear()`" | Medium: workflow plus rule tuning; custom rules need learning the syntax | 1–2 | Medium with community rulesets | Free for OSS CLI on any repo; the cloud app has its own limits | **Defer.** Not worth it beside CodeQL for a student team. The one thing it could do, the architecture rule, is cheaper as an ESLint rule (item 4). |
| **Supabase `db lint` / splinter advisors** | Plpgsql errors, shadowed variables, `SECURITY DEFINER` functions without a fixed `search_path`, and (via splinter on the hosted project) tables with RLS disabled, policies calling `auth.uid()` without a `select` wrapper, unindexed foreign keys | Low: `npx supabase db lint --level warning` after `db reset`, so it can go into the existing `db-contract.yml` | +0.5 (stack already running) | Low to medium. Advisor warnings on seeded or intentionally public tables will need a documented exception | Yes | **Do (item 3).** Directly about RLS, which is where today's worst bug lived, even though lint itself would not have caught the decline-leak. |
| **SQL tests for RLS** (extend the existing actor-based files, or add pgTAP) | The class of today's headline bug: who can read or write what after a state change | Medium: the repo already impersonates owner/stranger/anon in `booking_lifecycle.test.sql`, so extend it rather than adopt pgTAP | Already in `db-contract.yml` | Very low | Yes | **Do first for engineering value (item 3).** Add a test per fixed bug (decline, cancel, complete; pet and photo access). Also add a generic test: "every table in `public` has RLS enabled and at least one policy". |
| **Lighthouse CI / axe** | Accessibility (missing labels, contrast, focus), performance, SEO. Course covered UI design, so a green a11y score is a presentable metric | Medium: Lighthouse CI against `vite preview` or `@axe-core/playwright` inside the existing smoke suite | 2–4 | Medium: scores vary run to run on shared runners; axe is deterministic | Yes | **Nice to have, later.** `@axe-core/playwright` on the public routes of the smoke spec is the cheaper variant. Not in the top 5. |

### Suggested rollout order for Team D

1. **One PR, about an hour:** `codeql.yml`, `dependabot.yml`, `dependency-review.yml`, plus ask the admin to enable secret scanning and push protection. Mention in `ci-cd.md` under a new "Security checks" heading, marked non-required until a week of green runs.
2. **One PR:** `db-contract.yml` glob loop plus `supabase db lint`; add the new RLS test cases (squad C). Also change the Playwright steps so no spec is orphaned (for instance, `e2e-booking.yml` and `e2e-smoke.yml` together cover every spec, or add a tiny script that fails if any `web/e2e/*.spec.ts` is not referenced by a workflow).
3. **One PR:** coverage report, `no-restricted-imports` for cross-feature imports, `no-floating-promises`.
4. **Docs only:** `design-document.md`, `test-plan.md`, `sqa-scm-plan.md` (items 1 and 5). Do these first if time is short; they matter most for 17 Nov.

### Caveats

- CI workflows were read at `main` as of 14 Nov; if another branch changed them since, recheck before opening PRs.
- A required check that is stuck "Expected" blocks merging (see `ci-cd.md`), so new security workflows should start as non-required and must run on every PR before they are promoted.
- Adding a new third-party Action means pinning it to a version; prefer GitHub's own (`github/codeql-action`, `actions/dependency-review-action`).
