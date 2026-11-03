# Design reference app

Team A owns the final VibeCode React web app used as the visual and interaction reference for the whole project. It lives in a separate repository and is an input to feature work, not a blocker for this repository foundation. The same prototype is also available on the `petswap-frontend-prototype` branch of this repository, which can be read without a checkout using `git show origin/petswap-frontend-prototype:<path>`.

## Handoff contract

Record the approved reference repository URL, commit/tag, and approval date in the team Google Sheet and feature PRs. The reference repository must include:

1. Desktop and mobile views for login, profile/pets, listing search, listing detail/create, and booking management.
2. Navigation, empty/loading/error states, required form fields, and validation feedback.
3. Reusable visual tokens: colour, typography, spacing, controls, and responsive breakpoints.

Features should follow the approved reference. Any material deviation is raised in the squad DSM and recorded in an ADR if it changes product or architecture direction.

Ratings must not appear in the reference app: ratings are out of scope.

## Interface copy language

User-facing copy is written in English. The prototype's screens are in Thai; Squad A agreed on English-only copy on 31 August 2026. Follow the prototype for layout, spacing, and visual treatment, and treat its Thai wording as a translation source rather than the text to ship.
