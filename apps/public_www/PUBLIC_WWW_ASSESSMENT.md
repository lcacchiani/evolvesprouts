# Public WWW Codebase Assessment

Thorough assessment of `apps/public_www` identifying improvements, refactoring
opportunities, and best-practice gaps. Each item includes the exact file path,
line numbers where applicable, the current state, and the concrete action
required.

Baseline snapshot (2026-02-28):

- Next.js 16 static export, TypeScript, Tailwind CSS v4, Vitest
- 264 tests passing, ESLint clean (zero warnings)
- Multi-locale: `en`, `zh-CN`, `zh-HK`

---

## Conventions

- **File paths** are relative to `apps/public_www/` unless otherwise noted.
- **Priority** uses HIGH / MEDIUM / LOW.
- Each item has a unique ID (`H-1`, `M-3`, etc.) for cross-referencing.

---

## HIGH Priority

### H-1 — Hardcoded `lang="en"` in Root Layout

| Field | Detail |
|-------|--------|
| File | `src/app/layout.tsx` |
| Line | 93 |
| Current | `<html lang='en' ...>` |
| Impact | SEO + accessibility — crawlers and users with JS disabled see English regardless of locale |

**Action:** Make the `lang` attribute locale-aware. Since this is a static
export with a `[locale]` route segment, one approach is to pass the resolved
locale from the locale layout into the root layout via a mechanism like a
`<script>` that runs before paint (the existing
`set-locale-document-attributes.js` patches it client-side, but the **initial
HTML** must be correct for crawlers). Alternatively, restructure so each locale
gets its own `<html lang="...">` in the generated HTML — for a static export
this means the locale layout could inject a small inline script that patches
`document.documentElement.lang` synchronously, **and** the build pipeline
(`scripts/inject-csp-meta.mjs` or a new post-build script) could patch the
`lang` attribute in each locale's HTML files at build time.

---

### H-2 — Duplicate Root-Level Route Redirects

| Field | Detail |
|-------|--------|
| Files | `src/app/about/page.tsx` and `src/app/about-us/page.tsx` |
| Files | `src/app/contact/page.tsx` and `src/app/contact-us/page.tsx` |
| Current | Both files in each pair contain identical code redirecting to the same canonical route |

**Example (both files are byte-identical):**

```typescript
import { createDefaultLocaleRedirectPage } from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';

export default createDefaultLocaleRedirectPage(ROUTES.about);
```

**Action:** Decide which slug is the canonical one (currently `ROUTES.about` →
`/about-us` and `ROUTES.contact` → `/contact-us`). Remove the duplicate:
- Delete `src/app/about/page.tsx` (keep `src/app/about-us/page.tsx`).
- Delete `src/app/contact/page.tsx` (keep `src/app/contact-us/page.tsx`).
- If the alternate slugs (`/about`, `/contact`) existed for legacy URL support,
  document that rationale in a code comment in the remaining file. Otherwise
  just remove them.

---

### H-3 — Missing `error.tsx` Route Segments

| Field | Detail |
|-------|--------|
| Affected dirs | `src/app/` and `src/app/[locale]/` |
| Current | Zero `error.tsx` or `loading.tsx` files exist anywhere |
| Impact | Any runtime error in a client component shows a blank page with no recovery path |

**Action:** Create error boundary components:

1. `src/app/error.tsx` — root error boundary. Must be a `'use client'`
   component. Display a user-friendly error message with a "Try again" button
   that calls `reset()`. Use the default-locale content for the message.
2. `src/app/[locale]/error.tsx` — locale-aware error boundary. Same pattern
   but can display locale-appropriate text if available.

Both should:
- Use the `'use client'` directive (Next.js requirement for error boundaries).
- Accept `{ error, reset }` props.
- Render a minimal, accessible error UI.
- Not import heavy dependencies (keep the error page lightweight).

Note: `loading.tsx` is less critical for a static export site but could be
added for the events page which fetches data server-side.

---

### H-4 — Hardcoded Form Validation Messages (i18n Gap)

| Field | Detail |
|-------|--------|
| File | `src/components/sections/contact-us-form.tsx` |
| Lines | 370, 399 |
| File | `src/components/sections/booking-modal/reservation-form.tsx` |
| Line | 282 |
| Current | `"Please enter a valid email address."` and `"Please enter a valid phone number."` are hardcoded English strings |
| Context | All other user-facing text in these components comes from content props |

**Action:**

1. Add new content keys to all three locale JSON files
   (`src/content/en.json`, `src/content/zh-CN.json`, `src/content/zh-HK.json`):
   - Under `contactUsForm`: add `emailValidationError` and
     `phoneValidationError`.
   - Under `myBestAuntieBooking` (or whichever content object feeds the
     reservation form): add `emailValidationError`.
2. Update the `ContactUsContent` and related TypeScript content types if they
   are explicitly defined.
3. In `contact-us-form.tsx`, replace the hardcoded strings with
   `content.emailValidationError` and `content.phoneValidationError`.
4. In `reservation-form.tsx`, replace the hardcoded string with the
   corresponding content prop.
5. Also move the constant `RESERVATION_SUBMIT_ERROR_MESSAGE` in
   `reservation-form.tsx` (line 46-47) to content if not already sourced from
   props.

---

### H-5 — Incomplete Localization in `zh-CN.json` (Resources Section)

| Field | Detail |
|-------|--------|
| File | `src/content/zh-CN.json` |
| Lines | 493–516 |
| Current | Multiple keys still contain English text |

**Keys that need translation:**

| JSON path | Current English value |
|-----------|---------------------|
| `resources.cardTitle` | `"Free Guide: 4 Simple Ways to Teach Patience to Young Children"` |
| `resources.cardDescription` | `"Gentle Strategies for Busy Parents"` |
| `resources.mediaTitleLine1` | `"Teach Patience"` |
| `resources.mediaTitleLine2` | `"to Young Children"` |
| `resources.ctaLabel` | `"Get 4 Ways to Teach Patience"` |
| `resources.items[0]` | `"The "First…Then" Trick: Links waiting to a clear, concrete action."` |
| `resources.items[1]` | `"Make Time Visible: Use a visual timer for results."` |
| `resources.items[2]` | `"Stay Consistent: Set 2-3 non-negotiable waits daily."` |

**Action:**

1. Provide Simplified Chinese translations for all keys listed above.
2. Check `src/content/zh-HK.json` for the same issue and fix there too.
3. Run `npm run validate:content` to confirm content integrity after changes.

---

## MEDIUM Priority

### M-1 — Missing Metadata on `not-found.tsx`

| Field | Detail |
|-------|--------|
| File | `src/app/not-found.tsx` |
| Current | No `metadata` or `generateMetadata` export |
| Impact | 404 pages use root layout fallback metadata (homepage title/description); crawlers index misleading metadata |

**Action:** Add a `metadata` export:

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found - Evolve Sprouts',
  robots: { index: false, follow: false },
};
```

---

### M-2 — Hardcoded English Aria Labels Across Components

| File | Hardcoded strings |
|------|------------------|
| `src/components/sections/navbar.tsx` ~line 283, 287, 297 | `'Open navigation menu'`, `'Close navigation menu'` |
| `src/components/sections/course-highlights.tsx` ~line 220, 233 | `'Scroll course highlights left'`, `'Scroll course highlights right'` |
| `src/components/sections/my-best-auntie-description.tsx` ~line 108, 119 | `'Previous highlight cards'`, `'Next highlight cards'` |
| `src/components/sections/testimonials.tsx` ~line 171 | `'Previous testimonial'`, `'Next testimonial'` |
| `src/components/sections/faq.tsx` ~line 28 | `CONTACT_CARD_CTA_LABEL = 'Contact Us'` |

**Action:**

1. Add corresponding keys to all three locale JSON files under a shared
   `accessibility` or component-level namespace.
2. Thread these through component props alongside existing content.
3. Replace the hardcoded strings with the content values.

---

### M-3 — Unbounded CRM API Client Cache

| Field | Detail |
|-------|--------|
| File | `src/lib/crm-api-client.ts` |
| Line | 49 |
| Current | `const getRequestCache = new Map<string, CachedGetEntry>();` — grows without limit; expired entries are only cleaned up on read |

**Action:** Implement one of:

- **LRU eviction:** Before inserting a new entry, if cache size exceeds a
  maximum (e.g., 100), delete the oldest entry.
- **Periodic sweep:** On every Nth write, iterate the map and delete expired
  entries.

Also consider extracting the cache into a small `LruCache<K, V>` utility class
for testability.

---

### M-4 — Test-Only Export in Production Code

| Field | Detail |
|-------|--------|
| File | `src/lib/crm-api-client.ts` |
| Lines | 299–301 |
| Current | `export function clearCrmApiGetCacheForTests(): void` ships to production |

**Action:** Either:

- Guard with: `if (process.env.NODE_ENV !== 'test') throw new Error(...)`.
- Or move cache clearing to a test-only module that accesses the cache
  indirectly (e.g., re-import the module).

---

### M-5 — Large Components Approaching 500-Line Guideline

| File | Lines |
|------|-------|
| `src/components/sections/booking-modal/reservation-form.tsx` | 496 |
| `src/components/sections/contact-us-form.tsx` | 483 |
| `src/components/sections/free-resources-for-gentle-parenting.tsx` | 418 |
| `src/components/sections/navbar/menu-items.tsx` | 391 |
| `src/components/sections/navbar.tsx` | 362 |
| `src/components/sections/booking-modal/thank-you-modal.tsx` | 353 |

**Action:** Extract sub-components:

- `reservation-form.tsx` → extract `PriceBreakdown`, `DiscountCodeInput`,
  `ReservationFormFields` sub-components into
  `src/components/sections/booking-modal/`.
- `contact-us-form.tsx` → extract `ContactMethodList` and `ContactFormFields`
  sub-components, and move the success state into a `ContactFormSuccess`
  component.
- `free-resources-for-gentle-parenting.tsx` → extract the layout variant
  renderers (`SplitLayout`, `OverlayLayout`) into separate files under
  `src/components/sections/`.
- `menu-items.tsx` → split `DesktopMenuItems` and `MobileMenuItems` into
  separate files under `src/components/sections/navbar/`.

Ensure new files follow the existing `sections/` or `sections/booking-modal/`
placement convention.

---

### M-6 — Next.js Config Missing Security/Performance Settings

| Field | Detail |
|-------|--------|
| File | `next.config.ts` |
| Current | Only `output`, `trailingSlash`, and `images` configured |

**Action:** Add:

```typescript
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
};
```

- `reactStrictMode: true` — catches subtle bugs in development.
- `poweredByHeader: false` — removes the `X-Powered-By: Next.js` header
  (security best practice; reduces information leakage).

---

### M-7 — ESLint Config Gaps

| Field | Detail |
|-------|--------|
| File | `eslint.config.mjs` |
| Issues | Missing accessibility rules; phantom ignore pattern |

**Action:**

1. Add `eslint-plugin-jsx-a11y` and configure recommended rules to catch
   accessibility issues at lint time.
2. Verify that `react-hooks/rules-of-hooks` and
   `react-hooks/exhaustive-deps` are active (they should be inherited from
   `eslint-config-next`, but confirm explicitly).
3. Consider adding `@typescript-eslint/no-explicit-any: 'error'` to prevent
   future `any` regressions.
4. Remove the `e2e/**` and `playwright.config.ts` ignores (line 47) since
   those paths do not exist.

---

### M-8 — Vitest Missing Coverage and Timeout Configuration

| Field | Detail |
|-------|--------|
| File | `vitest.config.ts` |
| Current | No `coverage`, `testTimeout`, or `reporter` settings |

**Action:** Add test configuration:

```typescript
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./tests/setup.ts'],
  include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  testTimeout: 10000,
  coverage: {
    provider: 'v8',
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/app/generated/**'],
    reporter: ['text', 'lcov'],
  },
},
```

---

### M-9 — Silent Error Swallowing in Events Page

| Field | Detail |
|-------|--------|
| File | `src/app/[locale]/events/page.tsx` |
| Lines | 44–49 |
| Current | Both `catch` branches return `[]` identically; non-abort errors are silently discarded |

**Current code:**

```typescript
} catch (error) {
  if (isAbortRequestError(error)) {
    return [];
  }

  return [];
}
```

**Action:** Add error logging for non-abort errors:

```typescript
} catch (error) {
  if (isAbortRequestError(error)) {
    return [];
  }

  console.error('[events] Failed to fetch events:', error);
  return [];
}
```

Note: `console.error` is acceptable in build-time server code for a static
export. For runtime code, the project rules require structured logging, but
this runs only at build time during `next build`.

---

## LOW Priority

### L-1 — `as Record<string, unknown>` Type Assertions

| File | Line |
|------|------|
| `src/content/content-field-utils.ts` | 15 |
| `src/components/sections/testimonials.tsx` | 157 |
| `src/components/sections/free-resources-for-gentle-parenting.tsx` | 262 |

**Action:** Define stricter content interface types that include the optional
dynamic fields, eliminating the need for `as Record<string, unknown>` casts.
For example, if `testimonials` content has an optional `layoutVariant` field,
add it to the `TestimonialsContent` type.

---

### L-2 — Hardcoded Currency Formatter Locale

| Field | Detail |
|-------|--------|
| File | `src/lib/format.ts` |
| Line | 1 |
| Current | `new Intl.NumberFormat('en-HK', ...)` |

**Action:** Accept locale as a parameter and create locale-aware formatters, or
at minimum document that `'en-HK'` is intentional because HKD is the only
supported currency and English formatting is the business standard.

---

### L-3 — Hardcoded English Month Names in `events-data.ts`

| Field | Detail |
|-------|--------|
| File | `src/lib/events-data.ts` |
| Lines | 35–48 |
| Current | `UTC_MONTH_NAMES` array hardcoded in English |

**Action:** Replace with `Intl.DateTimeFormat` for locale-aware date
formatting, or accept a locale parameter in `formatUtcDateLabel` and
`formatUtcTimeLabel`.

---

### L-4 — CSS `!important` Usage

| Field | Detail |
|-------|--------|
| File | `src/app/styles/original/components-core.css` |
| Lines | 545, 549, 553, 557, 561 |
| Current | Five `!important` declarations on button hover states |

**Action:** Refactor selectors to achieve the desired specificity without
`!important`. For example, increase selector specificity with a parent class
or use CSS layers.

---

### L-5 — Missing Test Coverage for Specific Components

Components with no corresponding test file:

| Source file | Expected test location |
|------------|----------------------|
| `src/components/shared/structured-data-script.tsx` | `tests/components/shared/structured-data-script.test.tsx` |
| `src/components/sections/navbar/language-selector.tsx` | `tests/components/sections/navbar/language-selector.test.tsx` |
| `src/components/pages/events.tsx` | `tests/components/pages/events.test.tsx` |
| `src/components/pages/privacy-policy.tsx` | `tests/components/pages/privacy-policy.test.tsx` |
| `src/components/pages/terms-and-conditions.tsx` | `tests/components/pages/terms-and-conditions.test.tsx` |

**Action:** Add focused unit tests for each. Follow the existing test patterns
in the `tests/` directory. Tests must live under `tests/**`, not under `src/`.

---

### L-6 — `escapeHtmlAttribute` in CSP Script Is Incomplete

| Field | Detail |
|-------|--------|
| File | `scripts/inject-csp-meta.mjs` |
| Line | 84–85 |
| Current | Only escapes `&` and `"` |

**Action:** Expand escaping:

```javascript
function escapeHtmlAttribute(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

While CSP values are unlikely to contain `'`, `<`, or `>`, this is a
defense-in-depth measure.

---

### L-7 — Module-Level Mutable State in `use-modal-lock-body.ts`

| Field | Detail |
|-------|--------|
| File | `src/lib/hooks/use-modal-lock-body.ts` |
| Lines | 10–11 |
| Current | `const activeBodyLockTokens = new Set<string>(); let previousBodyOverflow = '';` at module scope |

**Action:** This pattern is intentional for coordinating multiple modals. Add
a brief comment explaining the design intent:

```typescript
// Module-scoped state coordinates body scroll locking across all mounted
// modals. The Set tracks active lock tokens so the last modal to unmount
// restores the original overflow value. This is safe in a static export
// (single browser context) but would need isolation in an SSR environment.
```

---

### L-8 — Potential `requestAnimationFrame` Cleanup Issue

| Field | Detail |
|-------|--------|
| File | `src/lib/hooks/use-horizontal-carousel.ts` |
| Around line | 143 |
| Current | `requestAnimationFrame` ID stored in a local variable inside `useEffect` |

**Action:** Store the frame ID in a `useRef` for safer cleanup on unmount:

```typescript
const rafIdRef = useRef<number | null>(null);

useEffect(() => {
  // ...
  rafIdRef.current = requestAnimationFrame(callback);
  return () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
  };
}, [dependencies]);
```

---

## Architecture Strengths (No Action Required)

These are positive findings worth preserving:

1. **Zero `any` types** in the entire source tree.
2. **Clean lint** with zero warnings and project-specific rules enforced (no
   inline styles, no `dangerouslySetInnerHTML`, no `CSSProperties`).
3. **264 tests across 71 test files** with strong coverage of components,
   hooks, and utilities.
4. **Proper component structure** — `pages/`, `sections/`, `shared/`,
   `sections/shared/` all follow `.cursorrules`.
5. **Test file placement** — all tests live in `tests/**`, never under `src/`.
6. **SEO well-implemented** — `buildLocalizedMetadata` with canonical URLs,
   hreflang alternates, Open Graph, and Twitter cards.
7. **Strong CSP pipeline** — SHA-256 hash-based CSP with inject + validate in
   the build chain.
8. **No XSS vectors** — zero `dangerouslySetInnerHTML`, zero `eval`, zero
   inline styles.
9. **Minimal client components** — only ~13 files use `'use client'`, all with
   justified reasons (form state, modals, carousels, intersection observers).
10. **Good accessibility patterns** — skip-to-content link, aria-labels,
    keyboard navigation, focus management, body scroll locking.
11. **Well-documented `.env.example`** with clear comments for every variable.
12. **Solid content architecture** — typed content with compile-time
    `satisfies` checks and a build-time validation script.

---

## Summary Table

| ID | Priority | Category | File(s) |
|----|----------|----------|---------|
| H-1 | HIGH | SEO / a11y | `src/app/layout.tsx` |
| H-2 | HIGH | Code quality | `src/app/about/`, `src/app/contact/` |
| H-3 | HIGH | UX | `src/app/error.tsx` (missing) |
| H-4 | HIGH | i18n | `contact-us-form.tsx`, `reservation-form.tsx` |
| H-5 | HIGH | i18n | `src/content/zh-CN.json` |
| M-1 | MEDIUM | SEO | `src/app/not-found.tsx` |
| M-2 | MEDIUM | a11y / i18n | navbar, course-highlights, testimonials, faq |
| M-3 | MEDIUM | Performance | `src/lib/crm-api-client.ts` |
| M-4 | MEDIUM | Code quality | `src/lib/crm-api-client.ts` |
| M-5 | MEDIUM | Maintainability | 6 large component files |
| M-6 | MEDIUM | Security / DX | `next.config.ts` |
| M-7 | MEDIUM | Code quality | `eslint.config.mjs` |
| M-8 | MEDIUM | Testing | `vitest.config.ts` |
| M-9 | MEDIUM | Debuggability | `src/app/[locale]/events/page.tsx` |
| L-1 | LOW | Type safety | `content-field-utils.ts`, 2 section components |
| L-2 | LOW | i18n | `src/lib/format.ts` |
| L-3 | LOW | i18n | `src/lib/events-data.ts` |
| L-4 | LOW | Maintainability | `styles/original/components-core.css` |
| L-5 | LOW | Testing | 5 untested components |
| L-6 | LOW | Security | `scripts/inject-csp-meta.mjs` |
| L-7 | LOW | Documentation | `src/lib/hooks/use-modal-lock-body.ts` |
| L-8 | LOW | Performance | `src/lib/hooks/use-horizontal-carousel.ts` |
