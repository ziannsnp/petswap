# ADR 0009: Public availability through the existing Cloudflare Workers deployment

**Status:** Accepted

## Context

US-D.4 asks that PetSwap be reachable at a public address during its planned availability, so reviewers and teammates can use it without local setup. The Sprint 2 backlog framed this as a spike between two options: a course-provided VM, or the Cloudflare Workers deployment already in place.

The Cloudflare deployment is not a new option to evaluate — it was decided in [ADR 0005](0005-cloudflare-workers-hosting.md) and has been live in production since then. [Environments](../environments.md) documents its production URL, per-branch preview URLs, and the Supabase redirect configuration that makes it work end to end. A course VM would need to be provisioned, kept patched and running, given its own deploy path, and reconciled with the shared hosted Supabase project's auth redirect allow-list — all to reproduce availability the team already has.

## Decision

Satisfy US-D.4 with the existing Cloudflare Workers deployment. No course VM is provisioned for PetSwap.

## Consequences

No new infrastructure, deploy path, or redirect configuration is needed; [ADR 0005](0005-cloudflare-workers-hosting.md) and [Environments](../environments.md) already describe the one availability path the team maintains. If a course requirement later makes a VM target mandatory regardless of an existing working deployment, that constraint should be brought back to the team and recorded in a new ADR rather than assumed here.
