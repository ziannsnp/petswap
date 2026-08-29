# Code conventions

These rules minimise the complexity that makes software expensive to change. They adapt the general engineering principles used by Quickal to this React web application. When a rule conflicts with a principle in a genuinely new situation, the principle wins; update this document if the new practice should become standard.

## APoSD design principles

The project follows John Ousterhout's A Philosophy of Software Design (APoSD).

- **Fight complexity continuously.** Complexity grows through dependencies and obscurity. Optimise for the next change being cheap, not merely for code working today.
- **Program strategically, not tactically.** Do not accept a small shortcut that spreads a design decision across the codebase. Spend enough time to find the clean boundary.
- **Make modules deep.** A module should present a small, clear interface over substantial hidden implementation. Prefer fewer cohesive modules over many shallow wrappers.
- **Hide information.** A feature index.ts is its public interface. Its components, hooks, API adapters, and internal types are implementation details unless explicitly re-exported.
- **Pull complexity downward.** Hooks and API adapters absorb Supabase, caching, retries, and error translation so screens render data, isPending, and isError rather than backend mechanics.
- **Define errors out of existence.** Prefer interfaces that prevent invalid states and remove caller special cases. Validate at boundaries, use precise types, and make impossible transitions impossible.
- **Use different abstractions at different layers.** A component, hook, and API adapter must each add a useful abstraction. Do not add pass-through layers that merely repeat another function's signature.
- **Comments explain why.** Code shows what happens; comments preserve invariants, trade-offs, and context that cannot be inferred from the code alone. Do not narrate obvious syntax.
- **Consistency is cognitive leverage.** A contributor should learn a pattern once and recognise it everywhere. Follow the established feature shape before inventing a new one.
- **Design it twice.** For non-trivial work, compare at least two approaches before committing. Record the result in an ADR only if it passes [the ADR guide](decisions/README.md).

## Documentation discipline

Documentation and code obey the same information-hiding rule: every fact has one authoritative home; other documents link to it rather than copy it.

- The docs/decisions directory contains immutable historical ADRs. Every other file under docs describes current state and must be updated when that state changes.
- Do not restate ADR reasoning in a living document. Link to the ADR instead.
- Prefer checkable facts: name the route, feature, migration, workflow, or test that proves a claim.
- Date status claims such as “deployed”, “approved”, or “complete”. Undated status silently becomes misleading.
- CI verifies Markdown links in docs; a broken link is a stale document and must be fixed in the same PR.

### Documenting a contribution

Not every implementation change belongs in documentation. Document the durable context someone needs to make the next change safely: a requirement, interface/architecture boundary, setup or deployment step, test strategy, known limitation, or accepted decision.

Before adding a new document:

1. Check the existing documentation lookup in AGENTS.md.
2. If an existing document owns the topic, update it there first; do not create a second source of truth.
3. Create a new living document only when a new durable topic has no clear home and more than one contributor will need to revisit it.
4. Put local implementation detail in code, tests, or a concise code comment when it does not change the project-wide contract.

Normal feature work that follows the requirements and existing architecture usually needs no new documentation. Update a living document only when the current truth it owns has changed.

### Architecture decisions

Before non-trivial work, ask: “Will this establish a durable, non-obvious direction that future contributors need to understand?” If so, read [the ADR guide](decisions/README.md) before making the change. Most normal feature work does not need an ADR.

## Modules, files, and imports

- Organise by cohesive feature, not technical layer or arbitrary file count.
- Create one file per substantial, independently useful component. Group trivial private helpers that change together in one intention-named file; do not create shallow one-helper files.
- A primitive used by two or more features belongs in shared; otherwise it remains owned by its feature.
- Put a component's props interface at the top of the file.
- Use named exports in feature folders and re-export only the feature's supported surface from index.ts.
- The src/app directory composes routes only. Route composition is the only sanctioned thin layer.
- Use the project alias for imports. Relative imports are fine within a feature; cross-feature imports must go through the feature public API.
- Components use PascalCase, hooks use the use prefix, pure utilities use camelCase, and types use PascalCase.

## React, data, and UI

- UI components do not call Supabase directly. Feature hooks or API adapters own server interaction.
- Use TanStack Query for server state. Do not rebuild caching, loading, retry, and invalidation with scattered useEffect calls.
- Keep query keys in a per-feature factory, scoped by user when applicable. Mutations invalidate or safely update the affected query data.
- A browser permission check is user experience, not security. The later Supabase implementation must enforce ownership through RLS and database constraints.
- Keep user-visible states explicit: loading, empty, error, and success. The VibeCode reference is the source of visual and interaction truth.
- Style with Tailwind utilities and the design tokens in `web/tailwind.config.js`. Use the `brand-*` scale and Tailwind's default spacing and typography scales instead of raw colours, arbitrary values such as `bg-[#0f766e]`, or ad-hoc component variants. A colour needed more than once belongs in the token config; shared control styles belong in `@layer components` in `web/src/shared/styles/global.css`. See [ADR 0006](decisions/0006-tailwind-and-design-tokens.md).

## Testing

- Place deterministic unit tests beside pure code as .test.ts files.
- Keep business decisions pure where possible, especially booking conflicts and status transitions; test them without a browser or database.
- Test behaviour, not private implementation details. Cover normal cases, boundaries, invalid input, and the acceptance criteria that can regress.
- Add browser coverage for completed critical journeys. Until the corresponding product flow and test data exist, keep its Playwright test registered and explicitly skipped with the enablement condition.
- Run the required quality checks in [testing.md](testing.md) before every PR.

## Git and pull requests

- main is the protected shared branch. Never push directly to it.
- Create short-lived branches from main: feature/name, fix/name, docs/name, test/name, or chore/name.
- Use conventional commits: feat:, fix:, docs:, test:, or chore:.
- Rebase or merge the current main before requesting review when the branch has been open long enough to drift.
- Every PR targets main, names the relevant requirement, includes test/evidence details, and needs one approval before merge.

## Environment variables and secrets

- Never commit .env files. Keep placeholders in .env.example.
- VITE-prefixed values are embedded into the browser bundle. They may contain only public configuration such as the Supabase URL and publishable key.
- Service-role keys, API secrets, and production credentials never belong in Vite variables, source code, screenshots, or prompts.
- Document a new environment variable in [environments.md](environments.md) in the same PR that introduces it.

## AI-assisted work

- AI can draft, implement, test, and review; the author remains responsible for correctness and scope.
- In the PR, state the requirement, files changed, checks run, and known gaps. Do not present unverified AI output as evidence.
- Never place secrets, private data, or production exports in an AI prompt.
