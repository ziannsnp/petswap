# CI/CD

## Continuous integration

GitHub Actions runs for pull requests that change the React app, Supabase configuration, or workflow itself. The gate runs:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build
```

The same workflow also verifies that Markdown links under docs resolve. No pull request should merge into `main` while this gate is failing. Tonpai owns investigating CI/environment failures; the feature author owns failures introduced by their change.

## E2E smoke workflow

`.github/workflows/e2e-smoke.yml` runs the Playwright smoke suite (`web/e2e/smoke.spec.ts`) on desktop and mobile Chromium for every `web/**` change and on demand. It builds a browser and starts the dev server, so it is a separate, non-required workflow rather than part of `Quality`. A red run means the app shell or router regressed and the change author owns the fix. The full Playwright journey (`booking-flow.spec.ts`) stays skipped until its screens exist; see [testing.md](testing.md).

## Main branch protection

The protected `main` branch is the only shared integration branch. GitHub requires a pull request, one approving review, current Quality checks, and resolution of review conversations before merge. New commits dismiss earlier approvals; administrators follow the same rules. Direct pushes, force pushes, and branch deletion are blocked.

## Deployment

The web app deploys to Cloudflare Workers static assets through Cloudflare's Git integration. Cloudflare watches this repository directly. There is no GitHub Actions deploy workflow for the web app, and one must not be added while the Git integration owns deployment; see [ADR 0005](decisions/0005-cloudflare-workers-hosting.md). Supabase migration release stays with GitHub Actions, so the two systems never deploy the same thing.

A push to any branch other than `main` uploads a new Worker version and produces a preview URL. A push to protected `main` deploys that build to production. Cloudflare posts build status and both preview URLs as a pull-request comment. The Cloudflare check is informational and deliberately not a required check; Quality is the gate.

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

Open the Worker's Deployments tab, then Version History, find the last known-good version and choose **Promote version**. Traffic moves immediately and no rebuild is required. A rollback drill was carried out on 22 August 2026 by promoting the previous version, confirming the change was visible in the browser, and promoting the current version back.

Rollback affects the web app only. Supabase migrations are forward-only, so a promoted older Worker still talks to the migrated database. Any change touching both code and schema must therefore be expand/contract: ship additive, backward-compatible migrations first and remove the old shape in a later release. This applies to everyone writing migrations, not only to the Cloudflare owner.

### Failure handling

A red Quality check is the author's to fix, following the ownership rule above. A red Cloudflare build is the Cloudflare owner's; the build log names the stage that failed and the directory it ran in, which is usually enough to separate a configuration problem from a code problem. Retry build re-runs the same commit without a new push.

See [Environments](environments.md) for the deployed URLs and the Supabase redirect configuration they require.
