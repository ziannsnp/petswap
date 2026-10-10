# Environments

## Current model

PetSwap begins with one shared hosted Supabase project for demo/production:

```text
SUPABASE_PROJECT_REF=gqtdnckwubfdghynavwg
VITE_SUPABASE_URL=https://gqtdnckwubfdghynavwg.supabase.co
```

A separate dev or staging project can be added later only when the team documents why it is needed, who owns it, and how migrations move through the environments.

Local development uses the committed `supabase/config.toml`, timestamped migrations, and `supabase/seed.sql`.

## Deployed web environments

The Vite SPA is hosted on Cloudflare Workers static assets. See [CI/CD](ci-cd.md) for the pipeline, project configuration, and rollback procedure.

| Environment | URL | Deployed from |
| --- | --- | --- |
| Production | `https://petswap-web.zianporrutai.workers.dev` | every push to protected `main` |
| Branch preview | `https://<branch>-petswap-web.zianporrutai.workers.dev` | every push to that branch |
| Version preview | `https://<version-id>-petswap-web.zianporrutai.workers.dev` | one specific build |

Branch names are slugified, so `chore/cloudflare-setup` becomes `chore-cloudflare-setup`. The branch alias is stable for the life of the branch and is the URL to share for review; the version URL changes with every build and is useful for pointing at one exact version. Deleting a branch removes its preview.

Because the team runs one shared Supabase project, preview deployments read and write the same data as production. Anything created while reviewing a preview is real. This is accepted while the app is a demo and should be revisited alongside any decision to add a separate dev or staging project.

## Auth redirect configuration

Supabase must allow every deployed host to receive an auth redirect, or Google sign-in fails on previews while still working in production. Authentication then URL Configuration carries:

```text
Site URL
https://petswap-web.zianporrutai.workers.dev

Redirect URLs
https://petswap-web.zianporrutai.workers.dev/**
https://*-petswap-web.zianporrutai.workers.dev/**
http://localhost:5173/**
```

Supabase treats only `.` and `/` as separators, so the single `*` matches both a version id and a slugified branch name without reaching another host. Google Cloud Console needs no per-preview change, because its only authorised redirect URI is the Supabase callback.

Attaching a custom domain later means updating the Site URL, the production entry in Redirect URLs, and the Google OAuth authorised domains to match. The workers.dev URL keeps working alongside a custom domain.

## Local setup

Prerequisites:

- Node.js 20.19+ or 22.12+
- Docker Desktop or another Docker-compatible runtime
- Supabase CLI through `npx`

From the repository root:

```bash
npx supabase start
npx supabase db reset
```

For the shared hosted project, first ask a project owner to add you to the Supabase organization/project. Then copy the committed example into the Vite app and fill in the URL and publishable key from Supabase Project Settings:

```bash
cp .env.local.example web/.env.local
```

For a fully local stack, copy the web example instead and paste the local anon key printed by `supabase start`:

```bash
cp web/.env.example web/.env.local
```

Use only the local anon/publishable key. Service-role keys are for trusted server processes only and must not appear in browser env vars, committed docs, screenshots, or client code.

The `sign-in` Edge Function resolves usernames without exposing Auth email addresses. Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the function runtime; do not copy the service-role value into `web/.env.local`. Serve it locally with:

```bash
cp supabase/functions/.env.example supabase/functions/.env.local
npx supabase functions serve sign-in --no-verify-jwt --env-file supabase/functions/.env.local
```

The function's CORS configuration belongs to the Edge Function environment, not
`web/.env.local` or `VITE_*` variables:

- `SIGN_IN_ALLOWED_ORIGINS`: comma-separated exact origins without trailing slashes.
  Include production and any localhost origins that this environment should accept.
- `SIGN_IN_PREVIEW_HOSTNAME_SUFFIX`: optional hostname suffix, including the leading
  hyphen (for example, `-petswap-web.zianporrutai.workers.dev`). Only HTTPS preview
  origins with an alphanumeric/hyphen prefix and the default port are accepted.
  Leave it empty to disable previews.

Configure these values in the hosted Edge Function environment before releasing this
change. The example preserves the existing production, preview, and localhost access;
omit localhost entries where local browser access is unnecessary. Without either
setting, browser origins are denied. Requests without an Origin header remain accepted
and receive no `Access-Control-Allow-Origin` header.

Do not deploy the `sign-in` Edge Function to the shared hosted project yourself. Hosted releases belong to the team's CI/CD process; see [CI/CD](ci-cd.md). The checked-in workflow currently deploys database migrations only. Edge Function deployment still needs to be added to that workflow before function releases are automated.

In the hosted Supabase Dashboard, configure Auth password security with a minimum length of 8 and require lowercase letters, uppercase letters, digits, and symbols. The browser additionally limits passwords to printable ASCII without spaces. Browser validation is user feedback only; enforce every policy supported by hosted Auth in the Supabase Dashboard.

## Docker Compose stack

`docker-compose.yml` runs the whole app from Docker alone: the production build of the web app plus the Supabase services it calls, with migrations and seed applied. Use it to get a known-good PetSwap on a machine without Node or the Supabase CLI, or to recover one. Keep using `supabase start` for writing migrations, regenerating types, and Studio; see [ADR 0008](decisions/0008-docker-compose-stack.md).

From the repository root:

```bash
sh scripts/stack-env.sh                  # once: writes .env with generated secrets
docker compose up -d --build
sh scripts/stack-health.sh --wait 180    # exits non-zero and names what is wrong
```

Then open `http://127.0.0.1:5173` and sign in with a [seeded test account](../supabase/README.md). The stack uses the same ports as `supabase start`, so stop that first with `npx supabase stop`.

| To | Run |
| --- | --- |
| Stop, keeping data | `docker compose down` |
| Start again, or pick up a new migration | `docker compose up -d --build` |
| Rebuild from nothing (same seeded state every time) | `docker compose down -v`, then `docker compose up -d --build` |
| Start over with new secrets | `docker compose down -v`, delete `.env`, then the three commands above |

Every setting lives in `.env`, and `.env.example` documents each one. `docker compose` refuses to start when one is missing, and `scripts/stack-health.sh` checks the rest: the keys are signed with `JWT_SECRET`, `SIGN_IN_ALLOWED_ORIGINS` covers the web origin, every service is up, and the web bundle was built from the current `.env`. `API_EXTERNAL_URL` and `ANON_KEY` are compiled into the web bundle, so changing either needs `--build`. Changing `POSTGRES_PASSWORD` or `JWT_SECRET` after the first start needs the volumes removed, because the database keeps the values it was created with.

Service settings in `docker-compose.yml` mirror `supabase/config.toml`; change both in the same pull request. Realtime, Studio, the mail catcher, and image transforms are not part of this stack.

The defaults are for one machine: ports bind to `127.0.0.1` and `SEED_DEMO_DATA=true` creates accounts with a published password. Do not expose the stack to a network without setting `SEED_DEMO_DATA=false` on a new database and putting TLS in front of it.

## Daily commands

Create a migration:

```bash
npx supabase migration new short_description
```

Rebuild and seed the local database:

```bash
npx supabase db reset
```

The seed creates local-only test accounts (`alex@petswap.test`, `blair@petswap.test`, `casey@petswap.test`, password `petswap-local-dev`) plus deterministic pets, listings, and bookings in every status. See [`supabase/README.md`](../supabase/README.md).

Inspect local Studio:

```text
http://127.0.0.1:54323
```

Regenerate web database types:

```bash
cd web
npm run supabase:types
```

## Verifying migrations

Before review, run:

```bash
npx supabase db reset
cd web
npm run typecheck
npm test -- --runInBand
```

For database review, inspect:

- RLS is enabled on `profiles`, `pets`, `listings`, `listing_images`, and `bookings`.
- Public listing reads return only `status = 'published'` rows with no `deleted_at`.
- Owners can modify only their own profiles, pets, listings, and listing images.
- Booking requesters can create and cancel only their own bookings.
- Listing owners can confirm, decline, or complete incoming bookings through valid transitions.
- Confirmed bookings cannot overlap for the same listing, and back-to-back dates are allowed.

The SQL checks in `supabase/tests/` (`database_contract.sql`, `booking_rules.test.sql`, `listing_rules.test.sql`, `listing_facility_migration.test.sql`, `listing_photo_access.test.sql`, `listing_edit_rules.test.sql`, and `avatar_storage_access.test.sql`) run these as an automated gate — locally after a reset, or in CI via [ci-cd.md](ci-cd.md#database-contract-workflow). The listing edit suite impersonates an owner and a non-owner to cover its actor-specific RLS contract; use Supabase Studio, SQL editor JWT impersonation, or API-level tests for remaining actor cases until end-to-end auth flows are automated.

## Hosted push workflow

After a reviewer accepts a migration:

```bash
npx supabase login
npx supabase link --project-ref gqtdnckwubfdghynavwg
npx supabase db diff --linked
npx supabase db push --dry-run
npx supabase db push
```

`db diff --linked` and `db push --dry-run` are safety checks. If they show unexpected remote drift, stop and resolve the migration history before pushing.
