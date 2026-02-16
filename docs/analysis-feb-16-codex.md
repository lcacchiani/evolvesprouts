# Public WWW optimization and refactoring analysis (Feb 16, 2026)

## Scope

- Repository area reviewed: `apps/public_www/**`
- Goal: identify optimization and refactoring opportunities and recommend best practice improvements.
- Mode: read-only analysis (no application behavior changes were implemented in this review).

## Method

- Reviewed app/runtime config, route structure, major sections/components, shared utilities, and scripts.
- Prioritized opportunities by expected impact on performance, maintainability, and delivery risk.
- Checked current asset health with:
  - `npm run audit:assets` (passed)

---

## Highest-impact opportunities

### 1) Split very large client components into smaller islands/modules

- Files:
  - `apps/public_www/src/components/sections/navbar.tsx` (large client component)
  - `apps/public_www/src/components/sections/my-best-auntie-booking-modal.tsx` (very large client component)
- Opportunity:
  - Large `"use client"` modules increase JS parse/hydration cost and make ongoing edits risky.
- Best practice:
  - Extract bounded subcomponents and hooks (for example, language selector, mobile drawer, booking form, QR section, print receipt).
  - Keep static layout/content in server components where possible.

### 2) Defer heavy booking dependencies until explicit user intent

- Files:
  - `apps/public_www/src/components/sections/my-best-auntie-booking.tsx`
  - `apps/public_www/src/components/sections/my-best-auntie-booking-modal.tsx`
- Opportunity:
  - Booking modal code and QR/payment dependencies are likely loaded before users open the modal.
- Best practice:
  - Lazy-load modal stack with `next/dynamic` or on-demand `import()` at open time.
  - Keep expensive payment helpers in a separate lazy chunk.

### 3) Unify body scroll-lock behavior

- Files:
  - `apps/public_www/src/components/sections/navbar.tsx`
  - `apps/public_www/src/lib/hooks/use-modal-lock-body.ts`
- Opportunity:
  - Multiple areas directly mutate `document.body.style.overflow`, which can conflict when overlays overlap.
- Best practice:
  - Centralize in one shared lock manager hook using reference counting (or token ownership) so unlocks are safe and deterministic.

### 4) Consolidate repeated CRM API client + fetch flow

- Files:
  - `apps/public_www/src/components/sections/events.tsx`
  - `apps/public_www/src/components/sections/my-best-auntie-booking-modal.tsx`
- Opportunity:
  - Similar env/client/abort/error/loading logic appears in multiple components.
- Best practice:
  - Introduce a shared data access layer (`useCrmApiClient`, `useCrmGet`, or equivalent service abstraction).
  - Standardize cancellation, empty/error states, and telemetry behavior.

### 5) Reduce root font payload

- File:
  - `apps/public_www/src/app/layout.tsx`
- Opportunity:
  - Multiple font families and broad weight/style ranges are loaded globally.
- Best practice:
  - Audit real usage and trim unused weights/styles.
  - Prefer variable fonts and scope font loading where practical.

### 6) Improve static-export image delivery strategy

- Files:
  - `apps/public_www/next.config.js` (`images.unoptimized: true` under static export)
  - PNG usage in:
    - `apps/public_www/src/components/sections/my-best-auntie-booking-modal.tsx`
    - `apps/public_www/src/content/{en,zh-CN,zh-HK}.json`
- Opportunity:
  - Static export disables Next image optimization; remaining PNG-heavy paths can increase transfer/LCP.
- Best practice:
  - Continue converting to WebP/AVIF, generate responsive variants (`srcset`), and enforce image budgets in CI.

---

## Medium-impact refactors

### 7) Reduce route boilerplate for redirects/placeholders

- Files:
  - Redirect stubs across `apps/public_www/src/app/**/page.tsx`
  - Placeholder pages such as:
    - `apps/public_www/src/app/[locale]/privacy/page.tsx`
    - `apps/public_www/src/app/[locale]/terms/page.tsx`
    - `apps/public_www/src/app/[locale]/services/workshops/page.tsx`
- Opportunity:
  - Many near-identical route files increase maintenance overhead.
- Best practice:
  - Centralize repeated redirect/placeholder logic with shared helpers/factories.

### 8) Throttle scroll-driven state updates

- Files:
  - `apps/public_www/src/components/sections/my-best-auntie-booking.tsx`
  - `apps/public_www/src/components/sections/my-best-auntie-description.tsx`
- Opportunity:
  - Scroll handlers trigger state updates frequently.
- Best practice:
  - Use rAF throttling (or observer/scrollend patterns where possible) to reduce render churn.

### 9) Centralize repeated section background overlay configuration

- Files:
  - Multiple section files repeat the same CSS variable style object patterns.
- Opportunity:
  - Repeated inline style objects can drift and increase cognitive load.
- Best practice:
  - Create a shared helper/class contract for section background overlays.

### 10) Strengthen content contract validation depth

- File:
  - `apps/public_www/scripts/validate-content.mjs`
- Opportunity:
  - Current checks are mainly top-level shape checks.
- Best practice:
  - Add nested schema validation (for example Ajv/Zod-style contract checks) to catch deeper regressions.

### 11) Make sitemap timestamps deterministic

- File:
  - `apps/public_www/src/app/sitemap.ts`
- Opportunity:
  - `lastModified` is generated from current build time for every route.
- Best practice:
  - Use content-derived timestamps per route when available, or omit when no reliable source exists.

### 12) Tighten Lighthouse governance for performance regressions

- Files:
  - `apps/public_www/.lighthouserc.json`
  - `apps/public_www/package.json`
- Opportunity:
  - Current assertions are warning-level with moderate thresholds; CLI is invoked via `npx`.
- Best practice:
  - Pin LHCI in dependencies, progressively raise thresholds, and fail CI for key regressions once baseline stabilizes.

---

## Quick health notes from this review

- Asset audit status:
  - `npm run audit:assets` passed.
  - Reported counts: 49 referenced assets, 50 public assets.
- Local lint command status in the analysis environment:
  - `npm run lint` did not run because `eslint` binary was not available locally at review time (`eslint: not found`).

## Suggested phased implementation order

1. Split and lazy-load booking modal stack.
2. Split navbar into smaller client islands + shared hooks.
3. Centralize CRM data access and body scroll locking.
4. Complete image modernization pass (PNG to next-gen formats + responsive variants).
5. Reduce route boilerplate and improve validation/tooling guardrails.

