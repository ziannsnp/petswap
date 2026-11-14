# Acceptance scenarios (BDD, Gherkin)

Behaviour-driven development scenarios for the requirements that matter most, in Gherkin (`Given`, `When`, `Then`) as taught in the BDD and TDD lecture. They are the readable acceptance criteria that sit between [requirements.md](../requirements.md) and the tests.

They are **living documentation, not executed by a Cucumber runner**: the team keeps its executable checks in Jest, SQL, and Playwright because a second test runner would add cost for no new coverage. Each scenario names the executable check that proves it in a `# Verified by:` comment, so a reviewer can trace requirement, scenario, and test. The script `scripts/check-acceptance-traceability.sh` runs in CI and fails when a scenario has no `Verified by` line or names a file that does not exist.

| Feature file | Requirements |
| --- | --- |
| [booking.feature](booking.feature) | FR-5.1 to FR-5.4 |
| [listings-search.feature](listings-search.feature) | FR-3.1, FR-4.1, FR-4.2 |
| [accounts-pets.feature](accounts-pets.feature) | FR-1.1, FR-2.1 |
