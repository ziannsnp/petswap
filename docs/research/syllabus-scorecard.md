# Syllabus scorecard: PetSwap against the course requirements

Scores this repository against what the 2110423 Software Engineering syllabus (last changed 6 November 2026) and the course announcements actually require, shows the state before and after the work on this branch, and lists what the repository cannot prove. Written 14 November 2026.

## What the syllabus requires (read from myCourseVille)

**Grading:** letter grades, norm-referenced. Midterm 20, attendance and participation 5, **project 50**, final exam 25.

The project (50) is assessed against four course learning outcomes (CLOs), at Bloom's "Apply" level:

| CLO | Outcome | Project artefacts that prove it |
| --- | --- | --- |
| 2 | Manage a software project: planning, scheduling, cost estimation (risk, change, cost and resource management) | Project management plan, schedule, estimate, risk register, change process |
| 3 | Develop software requirements artefacts, and analysis and design models | Requirements, use case, activity, sequence, state, ER and class diagrams, component and deployment diagrams, UI design |
| 4 | Develop a software project and test plan | Working software, test plan, test evidence |
| 5 | Demonstrate team collaboration in a software project | Burndown, daily-meeting evidence, git contribution spread, reviews |

The final exam (25) covers CLOs 1, 3 and 4 (methodologies and quality concepts, models, test plan); the midterm also covers CLO 2. CLO 6 (impacts on society, economy, environment; professional responsibility) is listed in the syllabus but not in the weighted assessments, so it is covered lightly.

**Presentation checklist** the teacher announced for the 20 October review, and the 17 November final: software built in the sprint, next sprint backlog, quality assurance activities, burndown chart, evidence of daily meetings, git contribution graph; and for 17 November also the **design document**, the **test plan**, and a **project demonstration**. The syllabus gives no finer rubric points (for example a mark scheme per artefact), so the scoring below is per requirement, not per mark.

Scale: **Full** means evidence in the repository that a reader can open. **Partial** means it exists but is thin or unlinked. **None** means absent. "Outside" means the proof lives outside the repository and must be shown by a person.

## Scorecard

| # | Requirement | Before | After | Evidence in the repository |
| --- | --- | --- | --- | --- |
| **CLO 2: manage a project** | | | | |
| 1 | Life-cycle model chosen and justified (CLO 1, Scrum) | Partial | Full | [project-management-plan.md](../project-management-plan.md) section 1 |
| 2 | Scope and work breakdown | Partial | Full | requirements, plan section 2 |
| 3 | Schedule with milestones | Partial | Full | plan section 3, commit activity chart |
| 4 | Effort and cost estimation | None | Full | plan section 4: COCOMO II from measured size, compared with actual committed hours |
| 5 | Resource plan | None | Full | plan section 5 |
| 6 | Risk management | None | Full | plan section 6 (12 risks with owners and status) |
| 7 | Change management | Partial | Full | plan section 8, ADR process |
| **CLO 3: requirements, analysis and design models** | | | | |
| 8 | Requirements with acceptance criteria | Full | Full | [requirements.md](../requirements.md) |
| 9 | Acceptance scenarios (BDD/Gherkin) | None | Full | [acceptance/](../acceptance/README.md), 18 scenarios traced to tests and checked in CI |
| 10 | Use case diagram | None | Full | [design-document.md](../design-document.md) section 2 |
| 11 | Activity (business process) diagram | None | Full | design document section 3 |
| 12 | Structural models: ER and class diagram | None | Full | design document section 4 |
| 13 | Behavioural models: sequence and state diagrams | None | Full | design document section 5 (3 sequence diagrams, 2 state diagrams) |
| 14 | Software architecture: component and deployment diagrams | Partial | Full | design document sections 6 and 7, [architecture.md](../architecture.md), ADRs |
| 15 | Coupling and cohesion (quality metrics) | None | Full | design document section 9, enforced by ESLint |
| 16 | UI design and prototype | Partial | Full | [design.md](../design.md), design document section 10 |
| 17 | API design (OpenAPI, Swagger) | None | Full | [api/openapi.yaml](../api/openapi.yaml), validated in CI |
| 18 | Design principles and patterns | Partial | Full | design document sections 4.1 and 8 |
| **CLO 4: software and test plan** | | | | |
| 19 | Working software for the sprint | Outside | Outside | Demo; CI green on `main`. Not provable from documents. |
| 20 | Test plan | Partial | Full | [test-plan.md](../test-plan.md), [testing.md](../testing.md) |
| 21 | Test levels, techniques and traceability | Partial | Full | test plan sections 3 and 4 |
| 22 | Test evidence | Full | Full | [qa/](../qa/) reports, CI runs |
| 23 | Quality assurance activities | Partial | Full | [sqa-scm-plan.md](../sqa-scm-plan.md), CI gates |
| 24 | Static analysis and security (DevSecOps, OWASP) | None | Full once merged | CodeQL, dependency review, Dependabot, database lint, type-aware ESLint; [ci-cd.md](../ci-cd.md#security-and-static-analysis) |
| 25 | CI/CD, deployment, DevOps | Full | Full | workflows, [ci-cd.md](../ci-cd.md), Docker Compose |
| 26 | Maintenance, SCM, SQA, measurement | Partial | Full | sqa-scm-plan: SCM, SQA, maintenance types, measurement table |
| 27 | ISO/IEC 29110 | None | Full | sqa-scm-plan ISO mapping table |
| **CLO 5: team collaboration** | | | | |
| 28 | Contribution spread across the team | Outside | Full for repository data | [team-collaboration.md](../team-collaboration.md) (453 commits, 91 merged PRs, all ten people) |
| 29 | Review and branch process | Full | Full | branch ruleset, PR template, CODEOWNERS |
| 30 | Burndown chart | Outside | Outside | Google Sheet |
| 31 | Daily-meeting evidence | Outside | Outside | Chat captures or photos |
| **CLO 6: impacts and responsibility** | | | | |
| 32 | Societal, economic, environmental impact; professional responsibility | None | Full | [impact-assessment.md](../impact-assessment.md) |
| **CLO 1: methodologies and quality concepts (exam)** | | | | |
| 33 | AI in the SDLC and responsible AI use | Partial | Partial | [conventions.md](../conventions.md); an explicit AI-use statement for the final could be added |

**Local verification:** Jest 56 suites, 1008 tests pass; coverage 91.3% statements, 88.3% branches, 75.0% functions, 92.4% lines; ESLint 0 errors (new rules found no violations, 31 warnings: 21 complexity, 9 function-length, and 1 component-imports-Supabase, the pre-existing `AuthProvider`); typecheck and the docs-link check pass; both repository scripts pass; the OpenAPI file parses as YAML (full validation runs in CI).

**Result:** 31 of 33 repository-provable requirements are now Full (one of them, item 24, once the branch is merged and the workflows have run), 1 is Partial (item 33), and 4 are "Outside" the repository because they are demonstrations or live records (items 19, 30, 31, and the live GitHub graph for item 28). Before this branch the count was 6 Full, 13 Partial, 14 None.

## Second pass: what is still imperfect, and why

A repeat review after the first build found these, in order of importance:

1. **Nothing here has run in GitHub Actions yet.** The workflows are valid YAML and the local checks pass, but CodeQL, dependency review, the new database loop, and `supabase db lint` first run when the branch is pushed. `db lint --level error` and the navbar spec in `e2e-booking.yml` are the likeliest to need a tweak. They are non-required, so a red run does not block merging.
2. **Secret scanning and push protection are repository settings.** An admin must switch them on; no file can.
3. **Known security bug in the design.** Hosts keep read access to a pet after a booking is declined or cancelled. It is documented honestly in the OpenAPI file, the risk register, and the impact assessment, and its fix and SQL regression test are in a separate pull request. Merge that before presenting, or present it as a found-and-fixed example.
4. **The `listings` and `bookings` import cycle** is recorded as a smell, not refactored. Fixing it touches two squads' code and is out of scope for a documentation and CI branch.
5. **Mermaid diagrams** all 16 parse and render with Mermaid 11.4.1 (checked in a browser on 14 November). GitHub's renderer version may differ slightly, so glance at each document once on GitHub.
6. **Estimate calibration.** COCOMO II nominal drivers give 42 person-months against about 2.5 person-months of committed time; the plan explains why and does not claim accuracy. If the teacher expects a number matching the Sheet's task hours, replace the "actual" row with the Sheet's total.
7. **Money cost** is described by item, not by amount, because the platform plan tiers are held by the account owner.
8. **The Sprint 3 numbers** (burndown, backlog status) live in the Google Sheet, which this work did not edit, by the project rule on Drive access.

## What to bring to the 17 November presentation

From the repository: the design document, test plan, project plan with risks, collaboration page, and the green `Quality` run. From outside it: the live demo of Sprint 3, the burndown chart, the Sprint 4 (closing) backlog or retrospective, daily-meeting captures, and a screenshot of the GitHub Insights contributors graph.
