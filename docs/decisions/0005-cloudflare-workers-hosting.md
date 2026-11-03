# ADR 0005: Cloudflare Workers static assets for web hosting

**Status:** Accepted

## Context

CI/CD documentation deliberately left deployment undecided until the VibeCode reference and the Supabase project were agreed, in the same spirit as [ADR 0002](0002-supabase-placeholder-first.md). The shared Supabase project now exists under [ADR 0004](0004-supabase-mvp-foundation.md), so the deferral is resolved and the team needs a hosted demo with preview builds for feature branches and automatic production deployment from `main`.

The web app is a static single-page application. It has no server rendering and no backend of its own; the browser talks to Supabase directly. Cloudflare Pages, Cloudflare Workers static assets, Vercel, and Netlify were all viable. A GitHub Actions workflow deploying through `wrangler-action` was considered as an alternative to Cloudflare's own Git integration.

## Decision

Host the SPA on Cloudflare Workers static assets, connected to this repository through Cloudflare's Git integration. Hosting configuration lives in `web/wrangler.toml` and is reviewed like any other change; only account-level settings live in the Cloudflare dashboard.

Cloudflare owns web deployment. The Quality workflow owns quality gating and, later, Supabase migration release. Neither system deploys what the other owns.

Cloudflare Pages was rejected because Cloudflare now directs new static projects to Workers. A GitHub Actions deploy workflow was rejected because it would duplicate a deployment path the Git integration already owns, and two systems deploying the same build is a failure mode worth avoiding outright rather than managing.

## Consequences

Every branch gets a preview URL with no extra workflow, and the branch alias URL is stable enough to paste into a pull request. Assets are content-addressed, so an unchanged build is not re-uploaded and the version reviewers approved on a preview is byte-identical to the one promoted to production.

Cloudflare builds on push and does not wait for GitHub checks. A push to protected `main` has already passed the gate, so this is acceptable, but the Cloudflare check is not a substitute for the Quality check and is deliberately not marked required.

Rolling back promotes a previous Worker version and affects the web only. Supabase migrations are forward-only, so any change touching both code and schema must be expand/contract: additive and backward compatible in one release, removal in a later one. Without that discipline a web rollback leaves old code running against a migrated database.

Preview deployments read the same Supabase project as production, so reviewing a preview writes real data. This is accepted while the app is a demo and must be revisited before real users exist.
