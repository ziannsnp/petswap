# Software quality assurance and configuration management plan

A short plan that names what the team already does for **Software Configuration Management (SCM)**, **Software Quality Assurance (SQA)**, and **measurement**, using the vocabulary of the course's umbrella-activities lectures, and maps it to the ISO/IEC 29110 work products for very small entities. It is a map to existing practice, not new process.

## SCM: configuration management

| SCM activity | What PetSwap does | Where |
| --- | --- | --- |
| Identify configuration items | Source in `web/`, `supabase/`, `docs/`, `scripts/`, `docker/`; migrations are ordered, immutable history; dependencies pinned by `package-lock.json`; Supabase CLI version read from the lockfile | [architecture.md](architecture.md), [ci-cd.md](ci-cd.md#supabase-cli-version) |
| Version control | Git on GitHub; short-lived branch per card, named by convention; squash and merge commits follow [conventions.md](conventions.md) | [conventions.md](conventions.md) |
| Change control | Pull request to `main`, one approving review, resolved conversations, no direct or force push; PR template asks for requirement, card, evidence and ADR decision; `.github/CODEOWNERS` routes review to the owning squad | [ci-cd.md](ci-cd.md#main-branch-protection), `.github/pull_request_template.md` |
| Decision records | Architecture decision records, one per durable choice, never rewritten | [decisions/](decisions/README.md) |
| Build and release management | CI builds on every pull request; Cloudflare deploys `main`; Supabase migrations deploy from CI when `supabase/**` changes; rollback by promoting a previous Worker version, drilled on 22 August 2026 | [ci-cd.md](ci-cd.md#deployment) |
| Status accounting | Backlog, sprint backlog, burndown, and DSM notes in the team Google Sheet; GitHub Insights contributor graph | Google Drive folder in [AGENTS.md](../AGENTS.md) |
| Audits | Weekly scheduled database-contract and Compose-health runs catch configuration drift between releases | [ci-cd.md](ci-cd.md) |

## SQA: quality assurance activities

| SQA activity | What PetSwap does | Evidence |
| --- | --- | --- |
| Standards and conventions | Coding, naming, commit, and PR conventions; test quality contract | [conventions.md](conventions.md), [testing.md](testing.md#test-quality-contract) |
| Reviews | Peer review on every PR with a reviewer-focus section; reviewers confirm evidence matches claims | pull requests |
| Testing | Unit, component, integration, database contract, end to end, and manual regression | [test-plan.md](test-plan.md) |
| Static analysis | ESLint with typescript-eslint, TypeScript strict compile, CodeQL, `supabase db lint` | [ci-cd.md](ci-cd.md#security-and-static-analysis) |
| Security checks | Row Level Security by design, private Storage buckets with signed URLs, Dependabot, dependency review, secret scanning | [design-document.md](design-document.md#8-design-principles-applied) |
| Defect tracking | Cards in the Google Sheet; every fix adds a regression test | [test-plan.md](test-plan.md#7-defect-handling) |
| Process and product audits | Regression checklists per sprint and release-readiness notes | [qa/](qa/) |
| Definition of done | Acceptance criteria, lint, typecheck, Jest, docs updated, evidence plus review | [team-protocol.md](team-protocol.md#definition-of-done) |

## Measurement

Measures the team can show, how they are collected, and what they are used for. A number is only useful if it triggers a decision, so each has one.

| Measure | How collected | Used to decide |
| --- | --- | --- |
| Burndown per sprint | Google Sheet | Whether scope must be cut |
| Contribution per member | GitHub Insights, Contributors | Whether work is spread (course presentation asks for it) |
| Tests per level and test files | Jest, SQL, and Playwright counts in [test-plan.md](test-plan.md) | Whether a layer is thin |
| Statement and branch coverage | `npm run test:coverage` (report in the `Quality` job summary; no gate yet) | Which feature to test next; a gate is added only after a baseline week |
| Cross-feature coupling | Table in [design-document.md](design-document.md#9-quality-metrics-coupling-and-cohesion), boundary rule enforced by ESLint | Whether a refactor is needed; one cycle (`listings` and `bookings`) is currently recorded |
| Complexity and function length | ESLint `complexity` and `max-lines-per-function` as warnings | Bad-smell candidates for refactoring |
| CI health | Workflow run history; weekly scheduled runs | Whether a check is flaky or rotting |

Refactoring log: smells are recorded in the PR that removes them, with the measure before and after when one exists. Known open smell: the `listings` and `bookings` import cycle.

## Software maintenance

The maintenance lecture's four types, and how each is handled:

| Type | Meaning | PetSwap practice |
| --- | --- | --- |
| Corrective | Fix defects | Every fix adds a regression test; defects become cards; the 14 November bug hunt produced fixes with tests ([test-plan.md](test-plan.md#7-defect-handling)) |
| Adaptive | Keep up with a changing environment | Dependabot and pinned tool versions (the Supabase CLI v3 break is the example); expand/contract migrations so a rollback still works |
| Perfective | Improve or extend | Backlog cards per sprint; ADRs for large changes |
| Preventive | Reduce future risk | Refactoring guided by the coupling and complexity numbers; security scanning; the weekly scheduled database and stack checks; documentation kept next to the code |

Maintainability aids: feature-based modules with one public entry each, small pure rule functions, an ADR trail, a getting-started guide, and CODEOWNERS routing review.

## ISO/IEC 29110 mapping (very small entities)

The course's standards lecture covers the Basic profile, with two processes: project management (PM) and software implementation (SI). This is how existing artefacts correspond; names of ISO work products are paraphrased.

| ISO 29110 process and activity | PetSwap artefact |
| --- | --- |
| PM: project planning | Product backlog and sprint plans (Google Sheet), cadence in [team-protocol.md](team-protocol.md) |
| PM: project plan execution, progress status record | Burndown, DSM notes, sprint review |
| PM: change request handling | Cards, ADRs, scope-change rule in the working agreement |
| PM: project closure | Release-readiness note, final presentation |
| SI: requirements analysis, requirements specification | [requirements.md](requirements.md) with acceptance criteria |
| SI: software architecture and detailed design | [design-document.md](design-document.md), [architecture.md](architecture.md), ADRs |
| SI: construction and unit testing | Feature code with tests in the same PR |
| SI: integration and tests; test cases and procedures | [test-plan.md](test-plan.md), [testing.md](testing.md), SQL and Playwright suites |
| SI: test report | `docs/qa/` evidence and CI runs |
| SI: product operation and user documentation | [getting-started.md](getting-started.md), [environments.md](environments.md) |
| Configuration management | SCM table above |
| Verification and validation | PR review (verification), sprint review and demo (validation) |
