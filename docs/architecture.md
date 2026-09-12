# Architecture

## Principles

**Feature-based, not layer-based.** Code that changes together lives together. The `web/` workspace is isolated from shared backend infrastructure so the repository root remains clean.

```
petswap/
├── web/                         # Vite React SPA
│   ├── src/
│   │   ├── app/                 # Route composition only
│   │   ├── features/            # Product features
│   │   │   ├── auth/
│   │   │   ├── profiles/
│   │   │   ├── pets/
│   │   │   ├── listings/
│   │   │   ├── search/
│   │   │   └── bookings/
│   │   └── shared/              # Code used by two or more features
│   └── e2e/                     # Playwright flows
├── supabase/                    # Config, migrations, Edge Functions
├── docs/                        # Project documentation and ADRs
└── scripts/                     # Repeatable maintenance tasks
```

## Feature contract

Each feature owns its UI, hooks, pure functions, types, and public API.

```
features/bookings/
├── components/                  # UI only; no direct Supabase calls
├── hooks/                       # Queries and mutations
├── lib/                         # Pure rules and API adapters
├── types.ts
└── index.ts                     # Only supported cross-feature import surface
```

Route files import features through `index.ts`; one feature must not reach into another feature's internal folders. `shared/` is only for code with at least two feature consumers.

## Data flow

```
Screen → feature hook → TanStack Query → feature API adapter → Supabase
```

Supabase authorization belongs in Row Level Security (RLS), not in hidden UI controls. Browser checks improve user experience; database rules protect the data.

UI components must not call `getSupabaseClient()` directly. Add feature-specific hooks and API adapters under `features/<feature>/hooks` and `features/<feature>/lib`, then export the supported surface from `features/<feature>/index.ts`.

## Scope boundaries

- One account can own pets, host listings, and request bookings.
- There are no fixed user roles, payments, messaging, identity verification, availability toggles, or ratings.
- A confirmed booking blocks only overlapping confirmed bookings for the same listing. Back-to-back bookings are valid.

See [ADR 0001](decisions/0001-web-spa-feature-architecture.md), [ADR 0003](decisions/0003-booking-rules-and-scope.md), [ADR 0004](decisions/0004-supabase-mvp-foundation.md).

## Listing creation consistency

Listing creation is a client-orchestrated sequence: insert a private draft, upload no more than ten photos, insert image metadata, and optionally publish. Expected promise failures trigger best-effort removal of uploaded objects and the new draft. The photo bucket is private, and the app requests short-lived signed URLs only after RLS confirms the viewer can read the listing.

This sequence is not a database transaction across Postgres and Storage. Closing the browser, losing power, or terminating the process between steps can bypass client cleanup and leave an incomplete private draft or an unreferenced private object. Those records are not publicly readable, but they still need operational cleanup. A production follow-up should move orchestration to a trusted server operation or schedule cleanup for abandoned drafts and unreferenced objects; until then, monitor these states and include browser-interruption recovery in manual release testing.

## Listing edit consistency

Listing edits retain the same client/server boundary as creation. The database validates required listing fields and ownership, limits image metadata to ten rows per listing, requires every storage path to live under that listing's UUID folder, and gives each image one non-negative position. Position zero is the main photo. Clients must use `reorder_listing_images` with the complete image-id list so main-photo and ordering changes are atomic and owner-authorized.

Storage and Postgres still cannot share one transaction. An edit adapter must validate the complete intended result before mutation, upload new objects first, commit listing fields and image metadata second, and remove replaced objects last. If the database step fails, it must best-effort remove only objects uploaded by that attempt; it must never delete an existing object before its metadata replacement commits. A failed final object removal leaves an inaccessible orphan to clean up, rather than a broken listing. The server constraints remain authoritative if browser validation is bypassed.
