# ADR 0006: Tailwind CSS and base design tokens

**Status:** Accepted

## Context

The web foundation styled itself with a single hand-written stylesheet containing raw hex colours and element selectors. [Design reference](../design.md) requires reusable visual tokens for colour, typography, spacing, controls, and responsive breakpoints, taken from the approved VibeCode prototype rather than invented per feature.

Three squads are about to build profile, pet, listing, search, and booking screens in parallel. Without a shared token vocabulary each squad would introduce its own colour values and spacing, and [conventions](../conventions.md) already anticipated this by requiring semantic tokens over repeated raw values. Adopting a token system before feature UI exists is materially cheaper than retrofitting one afterwards.

## Decision

Adopt Tailwind CSS v3.4 with PostCSS and autoprefixer, matching the approved prototype on the `petswap-frontend-prototype` branch.

Tokens are declared in `web/tailwind.config.js` under `theme.extend`: a `brand` colour scale (50–900, `brand-700` = `#0f766e`) and `Prompt` as the `font-sans` family. `theme.extend` is used rather than `theme` so Tailwind's default palette and spacing scale are preserved; that default spacing scale is the project's spacing token system.

Shared control styles — buttons, input fields, badges, page container — live in `@layer components` in `web/src/shared/styles/global.css`.

### Alternatives rejected

**CSS custom properties alone.** Adds no dependency and would satisfy the token requirement literally, but nothing makes tokens the easy path: every component still hand-writes CSS, and it supplies no responsive breakpoint system. Consistency would depend entirely on review discipline across ten contributors.

**CSS Modules.** Solves scoping without a dependency, but still requires per-component stylesheets and provides neither a token vocabulary nor breakpoints.

**Tailwind v4.** The current major, and its CSS-first `@theme` block maps more directly onto a token file. Rejected because the approved prototype is written against v3's config format and `@apply` rules; matching the visual reference exactly was judged more valuable than adopting the newest major during initial feature work. Revisit when the reference migrates.

## Consequences

Feature work styles UI with Tailwind utilities and the `brand-*` scale. A raw hex value or ad-hoc spacing constant in a component is now a review defect; a colour needed more than once belongs in `tailwind.config.js`.

Tailwind's Preflight reset removes browser element defaults, so global element styling must be declared explicitly. The pre-existing placeholder route styles were re-expressed with `@apply` for this reason.

Classes in `@layer components` are purged until referenced by a scanned source file, so unused control styles cost nothing in the bundle but will not appear in build output until a feature uses them. The `content` globs in `web/tailwind.config.js` are load-bearing: a wrong path silently produces an unstyled application with no build error.

The `Prompt` font is loaded from Google Fonts in `web/index.html`. It is required for Thai glyphs in the reference design, and the application depends on that external request at page load.

Remaining on Tailwind v3 means the project is one major version behind. Migrating to v4 changes how tokens are declared and requires its own ADR.
