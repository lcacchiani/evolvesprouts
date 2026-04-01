# Public WWW Structure Consistency — Implementation Plan

This plan addresses six validated structural inconsistencies in
`apps/public_www`. Each section describes the current state, the proposed
change, exact files to modify or create, edge cases, and open questions.

Sections are ordered by implementation priority (highest practical risk first).

---

## 1. Meta Pixel `content_name` centralization

**Priority: High** — no automated governance; silent renames require repo-wide
grep; docs already incomplete.

### Current state

`trackMetaPixelEvent` accepts a typed first argument (union of five standard
event names in `src/lib/meta-pixel.ts`), but the `content_name` parameter
values are **decentralized string literals** across 12+ component files.

Complete inventory of `content_name` values in production code:

| Value | File(s) | Standard event |
|---|---|---|
| `'contact_form'` | `contact-us-form.tsx` | `Lead` |
| `'media_download'` | `media-form.tsx` | `Lead` |
| `'community_signup'` | `sprouts-squad-community.tsx` | `Lead` |
| `'event_notification'` | `event-notification.tsx` | `Lead` |
| `'whatsapp'` | `whatsapp-contact-button.tsx`, `contact-us-form.tsx`, `thank-you-modal.tsx`, `links-hub.tsx` | `Contact` |
| `'my_best_auntie'` | `my-best-auntie-booking.tsx`, `events.tsx`, `reservation-form.tsx` (default) | `InitiateCheckout`, `Schedule` |
| `'event_booking'` | `events.tsx`, event-booking-modal via `reservation-form.tsx` | `InitiateCheckout`, `Schedule` |
| `'my_best_auntie_course'` | `links-hub.tsx` | `ViewContent` |
| `'contact_us'` | `links-hub.tsx` | `ViewContent` |
| `'events'` | `links-hub.tsx` | `ViewContent` |
| `'instagram'` | `links-hub.tsx` | `ViewContent` |
| *(dynamic slug)* | `landing-page-booking-cta-action.tsx` | `InitiateCheckout` |

GA4 has `analytics-taxonomy.json` + `validate-analytics-contract.mjs` +
`validate-analytics-governance.mjs`, all wired into `npm run lint`. Meta Pixel
has **no equivalent**.

The human catalog in `docs/architecture/marketing-stack.md` (Meta Pixel table)
is **missing** links-hub, events, landing-page-cta, and thank-you-modal call
sites.

### Proposed change

1. **Create** `src/lib/meta-pixel-taxonomy.ts` exporting a
   `META_PIXEL_CONTENT_NAMES` constant (a `Record` mapping each known
   `content_name` to its allowed standard events and a brief label).
2. **Narrow** the `content_name` field in `MetaPixelEventParams` from `string`
   to a union derived from `META_PIXEL_CONTENT_NAMES` keys, plus a
   `LandingPageSlug` escape hatch for the dynamic slug case.
3. **Replace** every string literal `content_name` in call sites with a
   reference to the taxonomy constant.
4. **Create** `scripts/validate-meta-pixel-contract.mjs` mirroring the GA4
   validator pattern (AST scan of `trackMetaPixelEvent` calls, check that
   `content_name` values appear in the taxonomy).
5. **Wire** the new validator into `package.json` `lint` script as
   `validate:meta-pixel-contract`.
6. **Update** the Meta Pixel conversion events table in
   `docs/architecture/marketing-stack.md` to match the full inventory above.

### Files to modify

| File | Action |
|---|---|
| `src/lib/meta-pixel-taxonomy.ts` | **Create** — taxonomy constant and derived type |
| `src/lib/meta-pixel.ts` | Modify — import `MetaPixelContentName` type, narrow `content_name` |
| `src/components/sections/contact-us-form.tsx` | Replace literal with taxonomy ref |
| `src/components/sections/media-form.tsx` | Replace literal with taxonomy ref |
| `src/components/sections/sprouts-squad-community.tsx` | Replace literal with taxonomy ref |
| `src/components/sections/event-notification.tsx` | Replace literal with taxonomy ref |
| `src/components/shared/whatsapp-contact-button.tsx` | Replace literal with taxonomy ref |
| `src/components/sections/links-hub.tsx` | Replace literals with taxonomy ref |
| `src/components/sections/my-best-auntie/my-best-auntie-booking.tsx` | Replace literal with taxonomy ref |
| `src/components/sections/events.tsx` | Replace literal with taxonomy ref |
| `src/components/sections/booking-modal/reservation-form.tsx` | Replace default param value with taxonomy ref |
| `src/components/sections/booking-modal/thank-you-modal.tsx` | Replace literal with taxonomy ref |
| `src/components/sections/landing-pages/shared/landing-page-booking-cta-action.tsx` | Keep dynamic `slug`; add type assertion |
| `scripts/validate-meta-pixel-contract.mjs` | **Create** — AST-based validator |
| `package.json` | Add `validate:meta-pixel-contract` script and wire into `lint` |
| `docs/architecture/marketing-stack.md` | Update Meta Pixel table to full inventory |

### Edge cases and risks

- The `landing-page-booking-cta-action.tsx` call uses the dynamic landing page
  `slug` as `content_name`. The type must allow `LandingPageSlug` alongside
  the static catalog, or the validator must whitelist dynamic expressions in
  that file.
- `reservation-form.tsx` receives `metaPixelContentName` as a **prop**
  (defaulting to `'my_best_auntie'`). The prop type must be
  `MetaPixelContentName` and callers must pass taxonomy-typed values.
- The links-hub WhatsApp button fires **both** `ViewContent` (via
  `trackLinkClick`) and `Contact` with `content_name: 'whatsapp'`. The
  taxonomy must allow `'whatsapp'` for both standard events.

### Questions

- Should the dynamic landing-page slug be validated against `getAllLandingPageSlugs()` at build time, or is the runtime check sufficient?
- Should the validator also enforce the `content_category` and `currency` fields, or focus only on `content_name` for this iteration?

---

## 2. Landing page paths — single source of truth

**Priority: Medium** — collision check is incomplete; redirect string is
duplicated.

### Current state

Two independent path catalogs exist:

1. **`ROUTES`** in `src/lib/routes.ts` — 12 first-class site paths (home,
   about, contact, services, etc.).
2. **`LANDING_PAGES`** in `src/lib/landing-pages.ts` — marketing slugs
   (currently only `easter-2026-montessori-play-coaching-workshop`).

`assertNoLandingPageRouteCollisions()` only checks landing slugs against
`Object.values(ROUTES)`. Filesystem routes not in `ROUTES` (e.g.
`/resources`, `/book`) are **not** checked, so a future landing slug like
`resources` would pass the assertion yet shadow the static route at runtime.

The Easter root redirect in
`src/app/easter-2026-montessori-play-coaching-workshop/page.tsx` hardcodes the
path string `'/easter-2026-montessori-play-coaching-workshop'` instead of
deriving it from `buildLandingPagePath(...)`.

### Proposed change

1. **Extend** `routes.ts` with a `RESERVED_PATH_SEGMENTS` set that includes
   all first segments from `ROUTES` values **plus** any filesystem-only routes
   not in `ROUTES` (e.g. `resources`, `book`). This set becomes the collision
   check target.
2. **Update** `assertNoLandingPageRouteCollisions()` in `landing-pages.ts` to
   check against `RESERVED_PATH_SEGMENTS` instead of only `ROUTES` values.
3. **Export** `LANDING_PAGE_SLUGS` (or a `getAllLandingPageSlugs` result) from
   `landing-pages.ts` (already exported as a function; no change needed).
4. **Update** the Easter root redirect page to derive the path from
   `buildLandingPagePath` and `getAllLandingPageSlugs` instead of a hardcoded
   string. Since root redirect pages for landing pages follow a mechanical
   pattern, consider a **generator function** in `landing-pages.ts` that
   creates root redirect pages for all registered slugs.
5. **Add a unit test** asserting that every entry in `LANDING_PAGES` has a
   corresponding root redirect page file, and vice versa.

### Files to modify

| File | Action |
|---|---|
| `src/lib/routes.ts` | Add `RESERVED_PATH_SEGMENTS` constant |
| `src/lib/landing-pages.ts` | Update collision check to use `RESERVED_PATH_SEGMENTS`; optionally export `createLandingPageRootRedirect` |
| `src/app/easter-2026-montessori-play-coaching-workshop/page.tsx` | Use `buildLandingPagePath` or shared redirect factory |
| `tests/lib/landing-pages.test.ts` | Add test for collision check against reserved segments; add test for root redirect coverage |

### Edge cases and risks

- `RESERVED_PATH_SEGMENTS` must be maintained manually alongside filesystem
  routes. An alternative is a build-time script that scans `src/app/*/` for
  static segments, but that adds build complexity.
- The root redirect pages live in `src/app/<slug>/page.tsx` — these files must
  exist for the non-locale URL to work in static export. A generator function
  cannot replace the filesystem requirement; it can only ensure the content is
  derived from the registry.
- The `[locale]/[slug]` catch-all renders landing page content. Next.js static
  routes (like `resources`) take precedence over `[slug]`, so the collision is
  silent — no 404, just wrong content.

### Questions

- Should `RESERVED_PATH_SEGMENTS` be auto-generated from a glob of
  `src/app/*/page.tsx` paths at test time, to prevent the set from going
  stale?
- Should we add a lint rule or test that every `src/app/<dir>/page.tsx`
  (non-`[locale]`) either maps to a `ROUTES` entry or a `LANDING_PAGES` slug?

---

## 3. Error boundary deduplication

**Priority: Low-Medium** — identical UI with subtle drift risk; low immediate
impact.

### Current state

| Aspect | `src/app/error.tsx` | `src/app/[locale]/error.tsx` |
|---|---|---|
| Locale resolution | `usePathname` + `getLocaleFromPath` | `useParams` + local `resolveLocaleFromParams` |
| Content | `getContent(locale).whoops.*` | Same |
| Reporting context | `'root-error-boundary'` | `'locale-error-boundary'` |
| Layout JSX + classes | Identical `<main>`, `<h1>`, `<p>`, `<button>` | Identical |

The existing `Whoops` component (used by `not-found.tsx`) shows a code + title
+ description without a retry button, so it cannot be reused directly.

### Proposed change

1. **Create** `src/components/shared/error-page-content.tsx` — a shared
   presentational component accepting `locale` (resolved by caller) and
   `onRetry` callback. It renders the `<main>` / `<h1>` / `<p>` / `<button>`
   markup.
2. **Refactor** both error files to resolve locale in their own way (this
   must stay file-specific) then delegate to `ErrorPageContent`.
3. **Move** `reportInternalError` call into the shared component via a
   `useEffect` that takes `context` and `locale` as dependencies, or keep
   it in the caller with just the context string varying.
4. **Update** existing tests in `tests/app/error.test.tsx` and
   `tests/app/locale-error.test.tsx` to cover the shared component.

### Files to modify

| File | Action |
|---|---|
| `src/components/shared/error-page-content.tsx` | **Create** — shared UI |
| `src/app/error.tsx` | Refactor to use `ErrorPageContent` |
| `src/app/[locale]/error.tsx` | Refactor to use `ErrorPageContent` |
| `tests/app/error.test.tsx` | Update assertions |
| `tests/app/locale-error.test.tsx` | Update assertions |
| `tests/components/shared/error-page-content.test.tsx` | **Create** (optional) — test shared markup |

### Edge cases and risks

- Both error files must remain `'use client'` boundary files; the shared
  component must also be a client component or be imported into one.
- The `context` string for `reportInternalError` must remain different between
  the two files so error reports distinguish root vs locale boundaries. Keep
  this as a prop or caller responsibility.
- Next.js error boundaries receive `error` and `reset` props from the
  framework. The shared component should accept `reset` and pass it to the
  button `onClick`.

### Questions

- Should the shared component also handle the `reportInternalError` call
  (accepting `context` as a prop), or should each error file keep its own
  `useEffect`?
- Is there value in also unifying the `not-found.tsx` / `Whoops` pattern with
  this shared component via a `variant` prop, or should they remain separate?

---

## 4. Stripe appearance design token consolidation

**Priority: Medium** — font stack disconnected from `next/font` config; rgba
literals not backed by tokens.

### Current state

`reservation-form.tsx` defines:

- `STRIPE_APPEARANCE_FALLBACKS` — 8 hex values duplicating `:root` CSS
  custom properties from `src/app/styles/original/base.css`.
- `resolveCssColorToken()` — reads CSS variables at runtime with hex fallbacks
  for SSR. Defined locally (not shared).
- `fontFamily` — hardcoded as
  `'Lato, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'`,
  **not** reading `var(--font-lato)` or `--site-primary-font`.
- Focus `boxShadow` values — `rgba(200, 74, 22, 0.55)` and
  `rgba(180, 35, 24, 0.55)` baked inline, not derived from resolved tokens.

### Proposed change

1. **Extract** `resolveCssColorToken()` to a shared utility in
   `src/lib/css-token-utils.ts` (or similar). This function is useful
   anywhere JS needs a resolved CSS custom property value.
2. **Create** a shared design-token map in `src/lib/design-tokens.ts`
   exporting:
   - Token name → CSS variable name mappings.
   - SSR fallback hex values (single source of truth, replacing
     `STRIPE_APPEARANCE_FALLBACKS`).
   - The site primary font stack string, derived from the same constant used
     by the Lato `next/font` config.
3. **Refactor** `getStripePaymentElementAppearance()` to import from the
   shared token map instead of defining local fallbacks.
4. **Replace** the hardcoded `rgba(...)` values in `boxShadow` rules with
   values derived from the resolved `colorPrimary` and `colorDanger` tokens
   (e.g., append alpha via a utility or use CSS `color-mix()` if Stripe
   supports it, otherwise compute `rgba` from the resolved hex + alpha).
5. **Extract** the font stack string to a shared constant near the `next/font`
   configuration in `layout.tsx` or in `design-tokens.ts`, and reference it
   from both the Stripe config and the CSS variable chain.

### Files to modify

| File | Action |
|---|---|
| `src/lib/css-token-utils.ts` | **Create** — `resolveCssColorToken` + optional hex-to-rgba helper |
| `src/lib/design-tokens.ts` | **Create** — token map, fallback values, font stack constant |
| `src/components/sections/booking-modal/reservation-form.tsx` | Remove local `STRIPE_APPEARANCE_FALLBACKS` and `resolveCssColorToken`; import from shared modules |
| `src/app/layout.tsx` | Optionally export or re-import font stack constant |
| `tests/lib/css-token-utils.test.ts` | **Create** — test `resolveCssColorToken` |
| `tests/lib/design-tokens.test.ts` | **Create** — test token map integrity |

### Edge cases and risks

- Stripe Elements requires JS-provided color strings (hex or rgb); CSS
  variable references like `var(--x)` are **not** supported in the Stripe
  appearance API. The `resolveCssColorToken` runtime resolution pattern must
  stay.
- The `boxShadow` rgba values must resolve to concrete strings at the time
  the Stripe appearance object is built. If using hex-to-rgba conversion, the
  helper must handle 3-digit, 6-digit, and 8-digit hex inputs.
- The `next/font` `Lato` config injects a CSS variable `--font-lato` with a
  generated class name, not the literal `'Lato'`. For Stripe, the literal
  font family name `'Lato'` must be used (Stripe renders in an iframe that
  cannot access host page CSS variables). The shared constant should be the
  human-readable font family string, not the CSS variable.

### Questions

- Should the shared token map also export Tailwind-compatible values (e.g., for
  use in `tailwind.config.ts` `extend.colors`), or keep it focused on
  JS-runtime consumption only?
- Is the `boxShadow` rgba pattern (`0 0 0 1px bg, 0 0 0 3px primary/55%`)
  stable enough to parameterize, or should it remain as template strings with
  interpolated color values?

---

## 5. Root redirect page metadata consistency

**Priority: Low** — only `media/download` adds metadata; low correctness risk.

### Current state

16 non-`[locale]` `page.tsx` files exist:

- **14** use `createDefaultLocaleRedirectPage(ROUTES.xxx)` — no metadata.
- **1** (`resources/page.tsx`) uses `createRootRedirectPage` with a pre-built
  localized hash path — no metadata.
- **1** (`media/download/page.tsx`) exports `metadata` with
  `robots: { index: false, follow: false }` before the redirect — this is the
  **only** non-`[locale]` file with metadata.

The localized counterpart `[locale]/media/download/page.tsx` also sets the same
`robots` metadata via `generateMetadata`.

### Proposed change

1. **Create** `createNoIndexDefaultLocaleRedirectPage` in `src/lib/locale-page.ts`
   that bundles the `metadata` export with the redirect. This documents the
   pattern and makes it reusable.
2. **Refactor** `media/download/page.tsx` to use the new helper.
3. **Add a code comment** in `locale-page.ts` explaining when to use the
   noindex variant (redirect-only routes that should never be indexed at the
   non-locale URL).
4. **Audit** remaining non-`[locale]` redirects: determine if any other routes
   should suppress indexing. Candidates: `/book` (alias for MBA course),
   `/resources` (hash redirect). Add a brief note to the PR explaining the
   audit conclusion.

### Files to modify

| File | Action |
|---|---|
| `src/lib/locale-page.ts` | Add `createNoIndexDefaultLocaleRedirectPage` + metadata export helper |
| `src/app/media/download/page.tsx` | Refactor to use new helper |
| `tests/lib/locale-page.test.ts` | Add test for noindex variant (if test file exists) |

### Edge cases and risks

- Next.js static export requires metadata exports to be module-level `const`
  or `generateMetadata` functions. The helper must return both the component
  and the metadata object in a way that allows the page file to re-export them
  correctly. This may require a tuple return or a two-export pattern.
- If `createNoIndexDefaultLocaleRedirectPage` returns a component but the
  metadata must be a separate named export, the file may still need two lines
  instead of one. The improvement is documentation and DRY, not necessarily
  fewer lines.

### Questions

- Should `/book` (which aliases to the MBA course page) also suppress indexing
  at the non-locale URL to avoid duplicate content signals?
- Is the current approach (metadata only on `media/download`) explicitly
  intentional, or was it an oversight that other redirects were not given the
  same treatment?

---

## 6. Testimonials content normalization documentation

**Priority: Low** — migration compatibility layer works; no runtime risk.

### Current state

`testimonials.tsx` normalizes story objects with `readCandidateText` using
wide key lists:

| Field | Candidate keys |
|---|---|
| Quote | `quote`, `testimonial`, `text`, `description`, `content` |
| Author | `author`, `name`, `parentName` |
| Service | `service`, `subtitle`, `title` |
| Image | `mainImageSrc`, `slideImageSrc`, `imageSrc`, `image` |

`en.json` (and presumably `zh-CN.json`, `zh-HK.json`) already uses **only**
the canonical keys: `quote`, `author`, `service`, `mainImageSrc`.

The normalization helpers (`readCandidateText`, `toRecord`) live in
`src/content/content-field-utils.ts` — already shared. But the **candidate key
lists** are hardcoded inline in `testimonials.tsx` with no documentation
explaining them as a compatibility layer.

### Proposed change

1. **Document** the candidate key lists as a migration compatibility layer by
   adding a descriptive constant name and brief code comment in
   `testimonials.tsx` (e.g., `QUOTE_CANDIDATE_KEYS`).
2. **Add a content-schema test** in `tests/content/testimonials.test.ts` (or
   extend an existing content test) that asserts `en.json` testimonial items
   use only canonical keys (`quote`, `author`, `service`, `mainImageSrc`).
   This prevents re-introducing legacy keys.
3. **Optionally**, if other sections need similar candidate-key normalization in
   the future, extract the candidate key lists into `content-field-utils.ts` as
   named constants. For now, this is premature — only testimonials uses the
   pattern.

### Files to modify

| File | Action |
|---|---|
| `src/components/sections/testimonials.tsx` | Name the candidate key arrays as constants; add brief comment |
| `tests/content/testimonials.test.ts` | **Create** or extend — assert canonical keys in `en.json` |

### Edge cases and risks

- The wide key support is useful if content is ever loaded from an external
  CMS or user-supplied JSON. Removing it prematurely could break future
  integrations. The approach here is to **document and test**, not remove.
- If `zh-CN.json` or `zh-HK.json` use non-canonical keys, the content test
  will flag them. This is a feature, not a bug — those files should be
  migrated to canonical keys as well.

### Questions

- Are there plans to load testimonial content from an external source (CMS,
  API)? If so, the wide normalization should remain indefinitely, and the test
  should only enforce canonical keys in locale JSON files, not in all content
  sources.
- Should the candidate key lists be versioned (e.g., `v1` keys vs `v2` keys)
  to make the migration path explicit?

---

## Implementation sequence

The sections can be implemented independently. Recommended order based on
risk and dependency:

1. **Meta Pixel `content_name` centralization** (Section 1) — highest risk,
   no dependencies on other sections.
2. **Landing page paths** (Section 2) — medium risk, no dependencies.
3. **Stripe design token consolidation** (Section 4) — medium risk, no
   dependencies.
4. **Error boundary deduplication** (Section 3) — low-medium risk, no
   dependencies.
5. **Root redirect metadata** (Section 5) — low risk, no dependencies.
6. **Testimonials normalization docs** (Section 6) — low risk, no
   dependencies.

Each section is a standalone PR. Sections 1 and 2 should be prioritized
together since they both address correctness gaps that could cause silent
production issues.

---

## Testing strategy

All changes will be validated by:

- Existing test suites (`npm test` in `apps/public_www`).
- New focused tests added per section (listed in each section's file table).
- `npm run lint` (which includes existing GA4 analytics validation and,
  after Section 1, the new Meta Pixel validation).
- `npm run build` to verify static export succeeds.
- `bash scripts/validate-cursorrules.sh` to maintain repo rule contract.
