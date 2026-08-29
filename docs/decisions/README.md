# Architecture Decision Records

ADRs record why a durable technical or product decision was made. They exist to prevent future contributors from re-litigating a non-obvious choice or accidentally undoing a load-bearing constraint.

## Should this be an ADR?

Think about an ADR before every non-trivial feature. Do not automatically write one.

Does this establish or reverse a long-lived direction?

- No: no ADR.
- Yes: is there a real, non-obvious trade-off or alternative?
  - No: no ADR; document current implementation normally.
  - Yes: will future contributors need the rationale to avoid inconsistency, a costly reversal, or scope drift?
    - No: no ADR.
    - Yes: write an ADR before or with the change.

Usually deserves an ADR:

- A new architectural boundary, ownership/auth model, data/API contract, or cross-feature convention.
- A database, deployment, security, privacy, or irreversible data decision.
- A deliberate product scope or policy decision that affects future work.

Usually does not deserve an ADR:

- A normal feature implementation already required by the functional requirements.
- Naming, component extraction, styling detail, routine dependency update, or obvious bug fix.
- A local, reversible implementation choice without meaningful alternatives.

## How ADRs work

- Use **Context / Decision / Consequences**. State the important alternatives rejected.
- ADRs are immutable history. Living docs describe today’s state and link here rather than repeating decision rationale.
- Status is one of: **Accepted**, **Superseded by NNNN**, or **Accepted, amended by NNNN**.
- A new ADR that changes an older one updates the old ADR’s status and this index in the same pull request.
- Keep ADRs rare, short, and worth rereading. An ADR is not a meeting note or an implementation diary.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-web-spa-feature-architecture.md) | React Vite SPA and feature-based workspace | Accepted |
| [0002](0002-supabase-placeholder-first.md) | Document Supabase before committing schema | Accepted |
| [0003](0003-booking-rules-and-scope.md) | Booking rules and ratings-free scope | Accepted |
| [0004](0004-supabase-mvp-foundation.md) | Commit the Supabase MVP foundation | Accepted |
| [0005](0005-cloudflare-workers-hosting.md) | Cloudflare Workers static assets for web hosting | Accepted |
