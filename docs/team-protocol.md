# Team protocol

## Squad ownership

| Squad | Members | Responsibilities |
| --- | --- | --- |
| A — Accounts & Pets | Pinn, Liger, Search | Auth/profiles; pet database/API and care information; profile/pet UI, validation, squad testing. Owns FR-1.1, FR-1.2, FR-2.1, FR-2.2. |
| B — Listings & Search | Zian, Ice, Ooh | Listing database/API and permissions; creation/detail UI; search/filter UI and manual evidence. Owns FR-3.1, FR-3.2, FR-4.1, FR-4.2. |
| C — Booking Management | Boeing, Tham, Pipe | Booking schema/API/lifecycle; booking UI; conflict logic, Jest, and Playwright integration. Owns FR-5.1–FR-5.4. |
| QA / Scrum / Infra (Quality, Testing & Release) | Tonpai | Docker/local setup, deployment readiness, and burndown support; the test standard (strategy, harnesses, seed data, CI gates, QA templates) and cross-feature regression testing. Helps squads with feature tests on request without taking them over. |

Every squad tests what it builds — unit, component, database, end-to-end, and manual evidence alike. QA sets the standard those tests are held to; see [Who writes the tests](testing.md#who-writes-the-tests).

Each squad appoints a mini Scrum Master, rotating if the squad prefers. The mini Scrum Master keeps the squad's Google Sheet cards current and escalates blockers.

## Working philosophy

- Keep work small enough to understand, test, review, and demonstrate.
- Optimise for the next teammate changing the code safely, not for the fastest one-time shortcut.
- Make progress visible: raise uncertainty early, record blockers, and attach evidence rather than saying a task is “done”.
- Treat review as shared design work. Challenge unclear boundaries and scope drift respectfully before they become expensive.
- Keep a fact in one authoritative place: the Google Sheet for delivery tracking, repository Markdown for durable technical and product truth, and the VibeCode repository for visual reference.

## Source of truth

Discord is for fast conversation, questions, and coordination. It is not the final home for a requirement, decision, operating rule, setup step, or test result that someone will need again.

If an important conclusion is reached in Discord, the responsible person records it in the appropriate repository document before relying on it for implementation or merge. Link to that document from Discord rather than maintaining two versions of the same information.

Document facts that affect future work: agreed requirements, boundaries, trade-offs, setup instructions, known limitations, test results, and durable decisions. Do not document every conversation. If it is not in this repository or the agreed Google Sheet, treat it as unconfirmed.

## Cadence

- Each member commits at least three hours per week.
- Squad DSMs run Monday and Thursday: yesterday/last work, next work, blocker, and evidence link.
- Sunday is the shared delivery/work session.
- All ten members join the big demo once every two weeks.
- The Google Sheet is the source of truth for backlog, sprint planning, burndown, and DSM notes.
- Markdown is the source of truth for technical decisions, setup, test strategy, and evidence templates.

## Working agreement

1. Take one small, testable backlog card at a time and assign it in the Google Sheet.
2. Create a branch from `main`; do not share a feature branch between members.
3. Before coding, read the relevant requirement, architecture section, and ADRs.
4. Open a PR early when integration or design feedback is useful.
5. Before merge to `main`, attach command output or manual-test evidence and obtain one reviewer approval.
6. If work changes scope, create an ADR or explicitly return it to the backlog—do not silently expand a feature.

## Definition of done

A card is done only when its acceptance criteria pass, TypeScript/lint/Jest checks pass, affected documentation is updated, and the PR has evidence plus review. UI cards additionally need desktop/mobile verification against the VibeCode reference app.
