# Supabase

This directory is the committed Supabase contract for the MVP foundation.

## Local stack

From the repository root:

```bash
npx supabase start
npx supabase db reset
```

`db reset` rebuilds Postgres from `supabase/migrations/` and then runs `supabase/seed.sql`. The seed is for the local stack only. It creates three throwaway test accounts (`alex@petswap.test`, `blair@petswap.test`, `casey@petswap.test`, password `petswap-local-dev` for all) plus deterministic pets, listings, and bookings covering every booking status. Nothing in it is a real credential or hosted data; never run it against the shared project.

Inspect the local project in Studio:

```text
http://127.0.0.1:54323
```

## Contract tests

`supabase/tests/` holds SQL checks that the schema keeps its promises (RLS on, booking policies present, confirmed bookings cannot overlap). Run them after a reset; see [`supabase/tests/README.md`](tests/README.md). They also run in CI via [`.github/workflows/db-contract.yml`](../.github/workflows/db-contract.yml).

## Migrations

Create a migration:

```bash
npx supabase migration new short_description
```

Verify migrations locally before review:

```bash
npx supabase db reset
```

The first MVP migration creates auth-backed profiles, pets, listings, listing images, bookings, listing photo storage, RLS policies, and booking overlap enforcement. Confirmed booking dates are end-exclusive, so a booking ending on 2026-09-05 does not conflict with another starting on 2026-09-05.

## Generated types

After changing migrations, regenerate web database types:

```bash
cd web
npm run supabase:types
```

Commit `web/src/shared/types/database.types.ts` with the migration that changed the schema.

## Hosted project

Start with one shared demo/production Supabase project. Do not invent dev/staging projects until the team has operational need and documents the split.

Shared hosted project:

```text
SUPABASE_PROJECT_REF=gqtdnckwubfdghynavwg
VITE_SUPABASE_URL=https://gqtdnckwubfdghynavwg.supabase.co
```

The browser-safe publishable key is intentionally not committed. Contributors who need the shared hosted app should be added to the Supabase project, then copy `.env.local.example` to `web/.env.local` and fill in the URL and publishable key from Supabase Project Settings. Never commit or screenshot a service-role key.

To let a teammate make hosted Supabase changes, invite them to the Supabase organization/project with an appropriate developer role. GitHub access alone lets them edit migrations, but Supabase project access is required to link the CLI and push reviewed migrations.

Before pushing pending local migrations to the hosted project:

```bash
npx supabase login
npx supabase link --project-ref gqtdnckwubfdghynavwg
npx supabase db diff --linked
npx supabase db push --dry-run
npx supabase db push
```

Use `db push` only for reviewed, committed migrations. Do not edit remote schema by hand in Studio except for emergency triage that is immediately captured in a migration.
