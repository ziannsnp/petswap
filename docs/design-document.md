# Design document

<!-- cover-page -->
**Project:** Don't Like My Pets (PetSwap), a pet-sitting marketplace
**Course:** 2110423 Software Engineering, first semester 2026
**Document date:** 16 November 2026
**Repository:** [github.com/ziannsnp/petswap](https://github.com/ziannsnp/petswap)

| Author | Student ID | Squad | Contribution to this document |
| --- | --- | --- | --- |
CONTRIBUTION_TABLE_DESIGN

Contribution is measured from git: lines added or removed by each author in this document, the API specification (`docs/api/`), `docs/architecture.md`, and the ADRs, up to the commit that produced this PDF. Leader: LEADER_PLACEHOLDER.
<!-- /cover-page -->

Software design document for **Don't Like My Pets (PetSwap)**, prepared for the Software Engineering final presentation (2110423). It is the single place that collects the diagrams the course taught: use case, activity, structural (ER), behavioural (sequence, state), component, and deployment diagrams, plus the quality metrics for coupling and cohesion.

Every diagram is [Mermaid](https://mermaid.js.org/), so GitHub renders it and a change to the code can change the diagram in the same pull request. Requirements are in [requirements.md](requirements.md), the module rules in [architecture.md](architecture.md), and the reasons behind the big choices in the [ADRs](decisions/README.md). This document does not repeat them; it draws them.

## 1. Context and scope

PetSwap is a pet-sitting marketplace. One account may own pets, host listings, and request bookings: there are **no fixed roles**. Payments, messaging, identity verification, availability calendars, and ratings are out of scope ([ADR 0003](decisions/0003-booking-rules-and-scope.md)).

Architecture style: a single-page web app (React, Vite, TypeScript) that talks directly to Supabase (Postgres with Row Level Security, Auth, Storage, one Edge Function). There is no application server of our own; **authorization lives in the database**, which is why the SQL contract tests matter as much as the Jest tests ([ADR 0004](decisions/0004-supabase-mvp-foundation.md)).

## 2. Use case diagram (functional model)

Actors are not roles in the data model; they are the stances one signed-in user takes. A visitor is anyone not signed in.

```mermaid
flowchart LR
    V([Visitor])
    U([Signed-in user])
    H([Same user as listing host])
    R([Same user as requester])

    subgraph PetSwap
        UC1((Search and filter<br/>published listings))
        UC2((View listing detail))
        UC3((Register / log in / log out))
        UC4((Manage own profile))
        UC5((Manage own pets<br/>and care information))
        UC6((Manage own listings<br/>draft, publish, edit, delete))
        UC7((Request a booking))
        UC8((Cancel a booking))
        UC9((Confirm or decline<br/>a request))
        UC10((Complete a stay))
        UC11((View my bookings))
    end

    V --> UC1
    V --> UC2
    V --> UC3
    U --> UC4
    U --> UC5
    U --> UC6
    U --> UC11
    R --> UC7
    R --> UC8
    H --> UC9
    H --> UC10
```

Requirement mapping: UC1 FR-4.1/4.2, UC2 FR-3.2, UC3 FR-1.1, UC4 FR-1.2, UC5 FR-2.1/2.2, UC6 FR-3.1, UC7 FR-5.1, UC8-UC10 FR-5.4, UC11 FR-5.3, and FR-5.2 (no double bookings) is a rule inside UC9.

## 3. Activity diagram: from search to completed stay

The main business process, with the system's decision points.

```mermaid
flowchart TD
    A([Start]) --> B[Search published listings<br/>by place, keyword, pet type, capacity, dates]
    B --> C[Open a listing]
    C --> D{Signed in?}
    D -- no --> E[Log in or register] --> F
    D -- yes --> F[Choose own pet and dates]
    F --> G{End date after start date,<br/>not in the past, own pet,<br/>not own listing?}
    G -- no --> F
    G -- yes --> H[Booking is Pending]
    H --> I{Host decides}
    I -- decline --> J[Declined]
    I -- confirm --> K{Pet already confirmed elsewhere<br/>for these nights, or any night<br/>above listing capacity?}
    K -- yes --> L[Database refuses confirm<br/>PBP01 pet booked / PBC01 listing full<br/>request stays Pending]
    K -- no --> M[Confirmed]
    H --> N{Requester cancels?}
    M --> N
    N -- yes --> O[Cancelled]
    M --> P{End date reached<br/>and host marks complete?}
    P -- yes --> Q[Completed]
    J --> Z([End])
    O --> Z
    Q --> Z
```

## 4. Structural model: data (ER diagram)

Derived from `supabase/migrations/`. Storage buckets (`avatars`, `pet-photos`, `listing-photos`) hold files; the tables hold only paths.

```mermaid
erDiagram
    PROFILES ||--o{ PETS : owns
    PROFILES ||--o{ LISTINGS : hosts
    PROFILES ||--o{ BOOKINGS : requests
    LISTINGS ||--o{ LISTING_IMAGES : has
    LISTINGS ||--o{ BOOKINGS : receives
    PETS ||--o{ BOOKINGS : "is booked in"

    PROFILES {
        uuid id PK "same as auth.users id"
        text username "unique, used to sign in"
        text display_name
        text photo_url
        text phone_number
        text location
        text consent_version
        timestamptz consent_given_at
    }
    PETS {
        uuid id PK
        uuid owner_id FK
        text name
        pet_species species "enum"
        text breed
        int age_year "0 to 100"
        text description
        text photo_url
        text feeding_instruction "care info"
        text medical_note "care info"
        text behavior_note "care info"
        text allergies "care info"
        text vaccination_info "care info"
        text special_requirement "care info"
        timestamptz deleted_at "soft delete"
    }
    LISTINGS {
        uuid id PK
        uuid owner_id FK
        text title
        text location
        text description
        int capacity "greater than 0"
        pet_species_array accepted_pet_types
        text facilities
        enum status "draft, published, deleted"
        timestamptz published_at
        timestamptz deleted_at
    }
    LISTING_IMAGES {
        uuid id PK
        uuid listing_id FK
        text storage_path
        text alt_text
        int sort_order
    }
    BOOKINGS {
        uuid id PK
        uuid listing_id FK
        uuid pet_id FK
        uuid requester_id FK
        enum status "pending, confirmed, declined, cancelled, completed"
        date start_date
        date end_date "end exclusive"
        timestamptz confirmed_at
        timestamptz declined_at
        timestamptz cancelled_at
        timestamptz completed_at
    }
```

### 4.1 Class diagram: domain model and the booking rules

The domain objects mirror the tables. The two pure rule functions are shown as a utility class because they hold the business logic that is tested without a database.

```mermaid
classDiagram
    class Profile {
        +uuid id
        +string displayName
        +string username
        +string location
    }
    class Pet {
        +uuid id
        +string name
        +Species species
        +int ageYears
        +softDelete()
    }
    class Listing {
        +uuid id
        +string title
        +int capacity
        +Species[] acceptedPetTypes
        +ListingStatus status
        +publish()
        +unpublish()
        +softDelete()
    }
    class Booking {
        +uuid id
        +date startDate
        +date endDate
        +BookingStatus status
        +confirm()
        +decline()
        +cancel()
        +complete()
    }
    class BookingRules {
        <<utility>>
        +getBookingConflict(candidate, existing, capacity) listing_full | pet_booked | null
        +hasBookingConflict(candidate, existing, capacity) bool
        +isValidBookingTransition(from, to) bool
        +canCompleteBooking(booking, today) bool
        +canConfirmBooking(booking, today) bool
        +canCancelBooking(booking, today) bool
        +assertValidWindow(window)
    }
    Profile "1" --> "*" Pet : owns
    Profile "1" --> "*" Listing : hosts
    Profile "1" --> "*" Booking : requests
    Listing "1" --> "*" Booking : receives
    Pet "1" --> "*" Booking : is booked in
    Booking ..> BookingRules : checked by
```

Design patterns in use: the **adapter** (each feature's `lib/*Api.ts` hides Supabase behind plain functions), **facade** (each feature's `index.ts` is the only public surface), **observer** (TanStack Query hooks and `onAuthStateChange` notify screens of data and session changes), **state machine** (booking and listing status, enforced in the database), and **guard / policy** (RLS policies and the `guard_booking_change` trigger).

Key constraints that are part of the design, not implementation detail:

- `bookings_valid_window_check`: `start_date < end_date`.
- Capacity by peak nightly occupancy ([ADR 0011](decisions/0011-capacity-based-booking-availability.md)): the `hold_booking_availability` trigger (`guard_booking_availability()`) locks the listing and pet rows, then refuses a confirmation when the pet already has an overlapping confirmed stay on any listing (`PBP01`) or when any night of the window would exceed the listing's capacity (`PBC01`, counted by `confirmed_booking_peak()`). `guard_listing_capacity` refuses lowering a capacity below a current or future peak. This replaced the Sprint 2 listing-wide `bookings_no_confirmed_overlap` exclusion constraint; a per-pet exclusion constraint remains as a backstop. Enforced even if the browser is bypassed.
- `booking_today()` pins "today" to the UTC day, so the browser and the database agree on which day a stay starts and ends.
- `pets.id` is referenced with `on delete restrict`, and pets are soft-deleted so past bookings still show them.

## 5. Behavioural model

### 5.1 Booking state machine

```mermaid
stateDiagram-v2
    [*] --> Pending: requester creates
    Pending --> Confirmed: host confirms (start date not passed)
    Pending --> Declined: host declines
    Pending --> Cancelled: requester cancels
    Confirmed --> Cancelled: requester cancels before the end date
    Confirmed --> Completed: host completes on or after end date
    Declined --> [*]
    Cancelled --> [*]
    Completed --> [*]
```

Implemented twice on purpose: `isValidBookingTransition()` in `web/src/features/bookings/lib/bookingRules.ts` (fast feedback, Jest tested) and the `guard_booking_change` trigger in Postgres (authoritative, SQL tested in `booking_lifecycle.test.sql` and `booking_transition_rules.test.sql`). Who may make each transition is decided in the trigger, not the UI. The date guards (confirm only before the start date, cancel a confirmed stay only before its end date) and the species and duplicate-request checks on creation were added in `20261114000000_tighten_booking_transitions.sql`; the UI mirrors them with `canConfirmBooking()` and `canCancelBooking()`.

### 5.2 Listing lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: owner creates
    Draft --> Published: owner publishes
    Published --> Draft: owner unpublishes
    Draft --> Deleted: owner deletes
    Published --> Deleted: owner deletes<br/>(blocked while a pending or confirmed booking exists)
    Deleted --> [*]
```

### 5.3 Sequence diagram: request a booking

```mermaid
sequenceDiagram
    actor Req as Requester
    participant UI as RequestBookingForm
    participant Hook as useBookings hook
    participant API as bookingApi
    participant SB as Supabase API
    participant DB as Postgres (RLS and triggers)

    Req->>UI: pick pet and dates, submit
    UI->>UI: validate form (bookingRequestForm)
    UI->>Hook: mutate(request)
    Hook->>API: createBookingRequest(values)
    API->>SB: insert into bookings (JWT)
    SB->>DB: INSERT as authenticated user
    DB->>DB: RLS check, guard_booking_change trigger
    alt valid
        DB-->>SB: row with status Pending
        SB-->>API: booking
        API-->>Hook: booking
        Hook-->>UI: success, invalidate bookings query
        UI-->>Req: "request sent"
    else invalid (own listing, not own pet, past date, unpublished)
        DB-->>SB: error
        SB-->>API: error
        API-->>UI: mapped, safe message (bookingErrors)
        UI-->>Req: error shown, form kept
    end
```

### 5.4 Sequence diagram: host confirms (capacity and pet-overlap protection)

This is the use case presented in the final review. It shows the API call from the UML API diagram (section 6.3) end to end, and why the browser's check is only advisory.

```mermaid
sequenceDiagram
    actor Host
    participant UI as BookingsScreen / BookingDetailScreen
    participant Hook as useUpdateBookingStatus
    participant API as bookingApi.updateBookingStatus
    participant REST as Supabase PostgREST<br/>PATCH /rest/v1/bookings
    participant DB as Postgres

    Host->>UI: Confirm a pending request
    UI->>UI: canConfirmBooking(booking, utcToday)
    UI->>Hook: mutate(id, confirmed)
    Hook->>API: updateBookingStatus(id, confirmed)
    API->>REST: PATCH status=confirmed (user JWT)
    REST->>DB: UPDATE bookings as authenticated
    DB->>DB: RLS: caller is a participant
    DB->>DB: guard_booking_change: caller owns the listing,<br/>pending to confirmed, start date not passed
    DB->>DB: hold_booking_availability: lock listing and pet rows
    alt pet confirmed elsewhere on an overlapping night
        DB-->>REST: error PBP01
        REST-->>API: error
        API-->>Hook: BookingPetUnavailableError
        Hook->>Hook: refetch incoming, outgoing, detail, search
        Hook-->>UI: error
        UI-->>Host: "This pet already has a confirmed booking<br/>for some of these dates"
    else some night would exceed listing capacity
        DB-->>REST: error PBC01
        REST-->>API: error
        API-->>Hook: BookingListingFullError
        Hook->>Hook: refetch the same queries
        Hook-->>UI: error
        UI-->>Host: "This listing is full for some of these dates"
    else fits
        DB-->>REST: row, status confirmed, confirmed_at set
        REST-->>API: booking
        API-->>Hook: booking
        Hook->>Hook: invalidate bookings and search caches
        Hook-->>UI: success
        UI-->>Host: shown as Confirmed
    end
```

Two hosts confirming at the same moment cannot both win: the row locks serialize them, so the second sees the first's confirmed stay when it counts the peak (tested in `supabase/tests/booking_concurrency.test.py`).

### 5.5 Sequence diagram: sign in with username

```mermaid
sequenceDiagram
    actor User
    participant UI as AuthScreen
    participant Edge as sign-in Edge Function
    participant Auth as Supabase Auth

    User->>UI: username (or email) and password
    alt email entered
        UI->>Auth: signInWithPassword(email, password)
    else username entered
        UI->>Edge: POST username, password
        Edge->>Edge: check origin allowlist
        Edge->>Auth: resolve username, sign in
    end
    Auth-->>UI: session or safe error
    UI-->>User: signed in, or generic error
```

## 6. Component model

### 6.1 Runtime components

```mermaid
flowchart LR
    subgraph Browser
        SPA[React SPA<br/>web/src]
        RQ[TanStack Query cache]
        SPA --- RQ
    end
    subgraph Supabase
        AUTH[Auth]
        REST[PostgREST API]
        STO[Storage<br/>avatars, pet-photos, listing-photos]
        EDGE[Edge Function<br/>sign-in]
        PG[(Postgres<br/>RLS, triggers, RPC)]
    end
    SPA --> AUTH
    SPA --> REST
    SPA --> STO
    SPA --> EDGE
    EDGE --> AUTH
    REST --> PG
    STO --> PG
    AUTH --> PG
```

### 6.2 Front-end modules and their dependencies

Each box is a feature folder under `web/src/features/`. Arrows are real cross-feature imports counted from the source on 14 November 2026; every one goes through the other feature's `index.ts`.

```mermaid
flowchart LR
    auth --> consent
    bookings --> auth
    bookings --> pets
    bookings --> listings
    listings --> auth
    listings --> bookings
    pets --> auth
    profiles --> auth
    search --> listings
    search --> bookings
    app[app/router.tsx] --> auth & bookings & consent & listings & pets & profiles & search
```

### 6.3 UML API diagram

PetSwap has no application server of its own, so its API is the Supabase API the browser calls: REST resources over the tables, RPC functions for operations that need more than one table or must hide private rows, and one Edge Function. The diagram models each endpoint group as an interface (its operations are the HTTP calls, named by `operationId` from [api/openapi.yaml](api/openapi.yaml)), the web adapters that are the only callers, and the database rules each call passes through. Parameters and responses are abbreviated; the OpenAPI file is the full contract.

```mermaid
classDiagram
    direction LR

    class SignInFunction {
        <<interface>>
        POST /functions/v1/sign-in
        +signInWithUsername(username, password) Session
    }
    class BookingsResource {
        <<interface>>
        /rest/v1/bookings
        +listBookings(filter) Booking[]
        +createBookingRequest(listing_id, pet_id, start_date, end_date) Booking
        +updateBookingStatus(id, status) Booking
    }
    class ListingsResource {
        <<interface>>
        /rest/v1/listings
        +listListings(owner_id) Listing[]
        +createListing(title, location, capacity, accepted_pet_types, ...) Listing
    }
    class PetsResource {
        <<interface>>
        /rest/v1/pets
        +listPets() Pet[]
        +createPet(name, species, care fields) Pet
        +updatePet(id, fields) Pet
    }
    class ProfilesResource {
        <<interface>>
        /rest/v1/profiles
        +getProfile(id) Profile
        +updateProfile(id, fields) Profile
    }
    class SearchRpc {
        <<interface>>
        /rest/v1/rpc
        +searchPublishedListings(location, keyword, pet_type, min_capacity, start_date, end_date, sort, page) ListingPage
        +getListingHost(listing_id) HostSummary
        +isUsernameAvailable(username) bool
    }
    class BookingDetailRpc {
        <<interface>>
        /rest/v1/rpc
        +getBookingDetail(booking_id) BookingDetail
    }
    class ListingWriteRpc {
        <<interface>>
        /rest/v1/rpc
        +updateListingWithImages(listing_id, fields, images) Listing
        +deleteListing(listing_id) void
        +deletePet(pet_id) void
    }

    class authApi {
        <<adapter: features/auth>>
    }
    class bookingApi {
        <<adapter: features/bookings>>
        +createBookingRequest()
        +updateBookingStatus()
        +getBookingDetail()
        +listIncomingBookings()
        +listOutgoingBookings()
    }
    class listingApi {
        <<adapter: features/listings>>
        +searchPublishedListings()
        +createListing()
        +updateListing()
        +deleteListing()
    }
    class petApi {
        <<adapter: features/pets>>
    }
    class profileApi {
        <<adapter: features/profiles>>
    }

    class DatabaseRules {
        <<Postgres>>
        RLS policies per table
        guard_booking_change()
        hold_booking_availability()
        guard_listing_capacity()
        booking_today() UTC
    }
    class BookingErrors {
        <<mapping>>
        PBC01 to BookingListingFullError
        PBP01 to BookingPetUnavailableError
        P0001 to date, status and duplicate errors
    }

    authApi ..> SignInFunction : calls
    authApi ..> SearchRpc : isUsernameAvailable
    bookingApi ..> BookingsResource : calls
    bookingApi ..> BookingDetailRpc : calls
    bookingApi ..> BookingErrors : maps errors
    listingApi ..> ListingsResource : calls
    listingApi ..> SearchRpc : calls
    listingApi ..> ListingWriteRpc : calls
    petApi ..> PetsResource : calls
    petApi ..> ListingWriteRpc : deletePet
    profileApi ..> ProfilesResource : calls
    BookingsResource ..> DatabaseRules : enforced by
    ListingsResource ..> DatabaseRules : enforced by
    PetsResource ..> DatabaseRules : enforced by
    ProfilesResource ..> DatabaseRules : enforced by
    SearchRpc ..> DatabaseRules : security definer, empty search_path
    BookingDetailRpc ..> DatabaseRules : participants only
    ListingWriteRpc ..> DatabaseRules : owner only
```

Access rule per endpoint group (who the database lets through, not what the UI shows):

| Endpoint group | Caller | Rule |
| --- | --- | --- |
| `sign-in` Edge Function | anyone, from an allowed origin | resolves a username to its account and signs in; errors are generic so it cannot be used to discover accounts |
| `bookings` | signed-in user | RLS: only the requester and the listing owner see a booking; the triggers decide who may change it and to what |
| `listings`, `pets`, `profiles` | owner (published listings are public) | RLS: write only your own rows |
| `search_published_listings`, `get_listing_host` | anyone | `security definer`; returns published listings and aggregate availability only, never other people's bookings ([ADR 0010](decisions/0010-listing-search-availability-privacy.md)) |
| `get_booking_detail` | signed-in participant | `security definer`; zero rows for anyone else; returns the peer's display name, photo and location, never email or phone |
| `update_listing_with_images`, delete RPCs | owner | one transaction; delete is refused while a pending or confirmed booking exists |

### 6.4 Design quality of the API

**Reusability.** Each endpoint is reached through exactly one adapter function (`bookingApi.updateBookingStatus`, `listingApi.searchPublishedListings`, and so on), so screens, hooks, and Playwright fixtures reuse the same call instead of building requests. The booking rules exist once as pure functions (`getBookingConflict`, `isValidBookingTransition`, `canConfirmBooking`) used by the list screen, the detail screen, and the tests; the database repeats them as the authority. `search_published_listings` serves both the plain search and the date-filtered search with optional parameters rather than a second endpoint. Error mapping (`bookingErrors.ts`) turns database codes into typed errors once, for every caller.

**Maintainability.** The contract is written down in OpenAPI 3.0 and validated in CI (`openapi-spec-validator` in the Quality workflow), and AGENTS.md requires a change to an RPC, policy, or column to update `openapi.yaml` in the same pull request. Business rules live behind stable names (`PBC01`, `PBP01`, typed error classes), so the capacity rule changed in Sprint 3 (ADR 0011) without changing any screen's call. Features only see each other through `index.ts`, which ESLint enforces. Every rule has a test at the level that owns it: Jest for the pure functions, SQL contract tests for policies and triggers, Playwright for the journeys.

**Scalability.** The browser talks straight to PostgREST, so there is no application server to scale; the static app is served from Cloudflare's edge and Supabase scales the database tier. Search is paginated (9 per page) and filters, counts, and sorts in one SQL query before paging, so a page costs the same however many listings exist; an index on confirmed bookings by listing and window (`bookings_confirmed_listing_window_idx`) keeps the availability check from scanning all bookings. Concurrency is handled where it scales correctly: row locks on the listing and pet serialize only the confirmations that compete for the same place or pet, not the whole table. Known limit: availability is computed per request rather than cached, which is fine at course scale and would be the first thing to revisit with real traffic.

**Security.** Authorization is in the database, not the API surface: Row Level Security on every table, triggers that check the actor for every status change, and `security definer` functions with `set search_path = ''` and explicit `grant execute` (for example `get_booking_detail` only to `authenticated`). The browser holds only the publishable key and the user's JWT; the service role key is used only inside the Edge Function. Private data is minimized in responses (no other users' bookings in search, no email or phone in booking detail), errors are generic where detail would leak information (sign-in), and consent is recorded at sign-up (`consent_version`, `consent_given_at`). CI adds CodeQL, dependency review, and Dependabot.

### 6.5 API documentation (Swagger)

The API is documented in OpenAPI 3.0 at [`docs/api/openapi.yaml`](api/openapi.yaml): every endpoint in the diagram above, its parameters, responses, error codes (`PBC01`, `PBP01`), and the access rule. It is viewed in Swagger UI, either by opening the file in [editor.swagger.io](https://editor.swagger.io) or locally:

```bash
docker run --rm -p 8081:8080 -e SWAGGER_JSON=/spec/openapi.yaml -v "$PWD/docs/api:/spec" swaggerapi/swagger-ui
# then open http://localhost:8081
```

Swagger UI's "Try it out" works against a local stack: set the server to `http://127.0.0.1:54321` (or the Docker Compose port) and authorize with the publishable key and a user's access token.

## 7. Deployment model

```mermaid
flowchart TB
    Dev[Developer] -->|pull request| GH[GitHub<br/>ziannsnp/petswap]
    GH -->|Quality workflow:<br/>lint, typecheck, Jest, build| CI[GitHub Actions]
    GH -->|Git integration| CF[Cloudflare Workers<br/>static assets: petswap-web]
    CI -->|on merge to main, supabase/** changed:<br/>db push and functions deploy| SBP[(Supabase project<br/>hosted)]
    User[Browser] -->|HTTPS| CF
    User -->|HTTPS, publishable key + user JWT| SBP
    subgraph Local["Local and CI test environments"]
        DC[docker-compose stack<br/>web build + Supabase services]
        SBL[(supabase start<br/>local stack)]
    end
    CI -.->|db-contract, e2e-booking| SBL
    Dev -.->|docker compose up| DC
```

Decisions: Cloudflare Git integration deploys the web app and GitHub Actions deploys only Supabase ([ADR 0005](decisions/0005-cloudflare-workers-hosting.md)); the full stack runs locally in Docker ([ADR 0008](decisions/0008-docker-compose-stack.md)); rollback is a Cloudflare version promotion, which is why migrations must be expand/contract ([ci-cd.md](ci-cd.md#rollback)).

## 8. Design principles applied

| Principle | How PetSwap applies it | Evidence |
| --- | --- | --- |
| High cohesion | Everything a feature needs (UI, hooks, pure rules, API adapter, types) sits in one folder | `web/src/features/*`, [ADR 0001](decisions/0001-web-spa-feature-architecture.md) |
| Low coupling | Cross-feature imports only via `index.ts`; Supabase calls only in adapters, never in components | [architecture.md](architecture.md), lint-enforced (see section 9) |
| Information hiding | Pure business rules (`hasBookingConflict`, `isValidBookingTransition`) are tiny, dependency-free functions | `bookingRules.ts` |
| Defence in depth | Browser validation gives feedback; the database enforces ownership, capacity, and pet overlap | RLS, `guard_booking_change` and `hold_booking_availability` triggers (ADR 0011) |
| Least privilege | `security definer` search RPC with an empty search path, no booking details returned | [ADR 0010](decisions/0010-listing-search-availability-privacy.md) |
| Expand/contract changes | Forward-only migrations so a Worker rollback still works | [ci-cd.md](ci-cd.md#rollback) |

## 9. Quality metrics: coupling and cohesion

Measured on 14 November 2026 from the source (feature folders only).

| Feature | Imports from other features (efferent) | Imported by (afferent) | Reading |
| --- | --- | --- | --- |
| auth | 1 (consent) | 4 | Stable foundation: many dependants, few dependencies |
| consent | 0 | 1 | Leaf, fully self-contained |
| pets | 1 (auth) | 1 | Low coupling |
| profiles | 1 (auth) | 0 | Low coupling |
| listings | 2 (auth, bookings) | 2 | Moderate |
| bookings | 3 (auth, pets, listings) | 2 | Highest efferent coupling; expected for the domain's centre |
| search | 2 (listings, bookings) | 0 | Pure consumer |

Findings worth stating honestly:

- **Boundary rule holds.** No file reaches into another feature's internals; every cross-feature import uses `index.ts`. This is now checked automatically by ESLint rather than by convention alone.
- **One cycle: `listings` and `bookings` import each other.** This is a mild design smell (a dependency cycle between two modules), and a candidate refactor: move the shared listing-summary type or the "request booking" entry point so only one direction remains. It is recorded rather than fixed because it works and touches two squads' code; see [sqa-scm-plan.md](sqa-scm-plan.md#measurement).
- `bookings` has the most outgoing dependencies, which matches its role as the aggregate of listing, pet, and requester.

## 10. User interface design

The UI was prototyped first (course topic: prototyping and UI design) as a separate reference app, "VibeCode", owned by Team A. Feature work follows it for layout, navigation, empty/loading/error states, and visual tokens; the contract and the language decision (English copy) are in [design.md](design.md).

Navigation structure, from the router (`web/src/app/router.tsx`):

```mermaid
flowchart TD
    subgraph Public
        S["/ (search)"] --> D["/listings/:id (detail)"]
        T["/terms"] --- P["/privacy"]
        L["/login"] --- R["/register"] --- C["/check-email"]
    end
    subgraph Protected["Signed-in only"]
        PR["/profile"]
        PE["/pets"] --> PN["/pets/new"]
        PE --> PD["/pets/:id/edit"]
        LI["/listings"] --> LN["/listings/new"]
        LI --> LD["/listings/:id/edit"]
        B["/bookings"] --> BD["/bookings/:bookingId (detail)"]
    end
    D -->|request booking| B
```

Usability and quality rules applied: every form keeps the user's input on error, destructive actions use a confirmation dialog with focus returned to the trigger, layouts are verified on desktop and mobile, and failures show safe messages that do not expose private data. Evidence: [qa/](qa/).

## 11. Known limitations of the design


- Listing creation is a client-orchestrated sequence across Postgres and Storage, not a transaction; see [architecture.md](architecture.md#listing-creation-consistency).
- The app has no REST layer of its own, so the API is the generated Supabase API plus one Edge Function. It is described in OpenAPI 3.0 in [api/openapi.yaml](api/README.md) (viewable in Swagger UI), with each operation's access rule noted.
- The ER diagram is hand-maintained; regenerate it from the migrations when the schema changes.
