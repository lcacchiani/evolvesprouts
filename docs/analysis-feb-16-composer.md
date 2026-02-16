# Public WWW – Optimization & Refactoring Analysis

**Date:** February 16, 2025  
**Scope:** `apps/public_www`  
**Aligned with:** `.cursorrules`, Next.js best practices

---

## 1. **Section Background Duplication (High Impact)**

The same background pattern is repeated across many components:

- `faq.tsx`, `testimonials.tsx`, `deferred-testimonials.tsx`, `course-highlights.tsx`, `my-best-auntie-overview.tsx`, `my-best-auntie-description.tsx`, `my-history.tsx`, `my-journey.tsx`

Shared constants:

```ts
SECTION_BG = '#FFFFFF' (or similar)
SECTION_BACKGROUND_IMAGE = 'url("/images/evolvesprouts-logo.svg")'
SECTION_BACKGROUND_POSITION = 'center -150px' | 'center -900px'
SECTION_BACKGROUND_SIZE = '900px auto' | '2000px auto'
SECTION_BACKGROUND_FILTER = 'sepia(1) opacity(7%) hue-rotate(-50deg) saturate(250%)'
SECTION_BACKGROUND_MASK_IMAGE = 'linear-gradient(to bottom, black 18%, transparent 20%)'
```

**Recommendation:** Extract to a shared module (e.g. `src/lib/section-styles.ts` or `src/components/section-backgrounds.ts`) with a helper like `getBrandedSectionOverlayStyle(variant)` so variants (e.g. `'hero' | 'content'`) are defined once.

---

## 2. **Client Component Usage (Medium Impact)**

`.cursorrules` states: *"Prefer server components by default; minimize `use client`"*.

Current `'use client'` usage:

| Component | Reason | Server-friendly? |
|-----------|--------|------------------|
| `navbar.tsx` | `usePathname`, mobile menu, language selector | No – needs client |
| `faq.tsx` | Search, tabs, expand/collapse | Partially – could split |
| `deferred-testimonials.tsx` | IntersectionObserver, dynamic import | Partially – wrapper could stay server |
| `testimonials.tsx` | Carousel/slider | No – needs client |
| `my-best-auntie-booking.tsx` | Form, date picker, modal | No – needs client |
| `contact-us-form.tsx` | Form state | No – needs client |
| `events.tsx` | Calendar, filters | No – needs client |
| `course-highlight-card.tsx` | Expand/collapse | No – needs client |

**Recommendation:** Keep `'use client'` only where truly needed. For `faq.tsx`, consider extracting a server `FaqSection` that renders the shell and passes a client `FaqList` for search/tabs. For `deferred-testimonials.tsx`, keep the shell as a server component and only use `'use client'` in the lazy-loaded part.

---

## 3. **Font Loading (Medium Impact)**

Root layout loads 4 Google Fonts:

```ts
Lato, Plus_Jakarta_Sans, Poppins, Urbanist
```

**Recommendation:**

- Reduce to 2–3 fonts if possible (e.g. Lato + Poppins for headings).
- Use `display: 'swap'` consistently (already done).
- Consider `subset` to only load needed glyphs (e.g. `'latin'`).

---

## 4. **Legacy Redirect Routes (Low–Medium Impact)**

There are many redirect-only pages:

- Root: `/about-us`, `/contact`, `/contact-us`, `/about`, `/privacy`, `/terms`, `/events`, `/resources`, `/book`, `/services/*`
- `[locale]`: `/about`, `/contact`, `/book`, `/resources`, `/services/my-best-auntie`

**Recommendation:** Extract a shared redirect helper:

```ts
// src/lib/redirect-utils.ts
export function createRedirectPage(target: string | ((locale: string) => string)) { ... }
```

Then use it in each redirect page to reduce boilerplate and avoid duplication.

---

## 5. **Locale-Aware FAQ Link (Bug)**

`faq.tsx` hardcodes:

```ts
const CONTACT_CARD_CTA_HREF = '/contact-us';
```

On `/zh-CN/about-us`, clicking the FAQ "Contact Us" CTA sends users to `/contact-us` (which redirects to `/en/contact-us`), not `/zh-CN/contact-us`.

**Recommendation:** Pass `locale` and use `localizePath('/contact-us', locale)` from `@/lib/locale-routing`, or use the content layer for the link.

---

## 6. **Image Optimization (Medium Impact)**

`next.config.js` has:

```js
images: { unoptimized: true }
```

For static export this is expected, but images are still served as-is.

**Recommendation:**

- Use `scripts/optimize-images.mjs` to generate `.webp` variants.
- Keep `unoptimized: true` for static export, but ensure `<picture>` or `<Image>` with `srcSet` for `.webp` where appropriate.
- Consider moving images to `<Image>` with `unoptimized` for consistent sizing and lazy loading.

---

## 7. **Navbar Size (High Impact)**

`navbar.tsx` is ~640 lines; `.cursorrules` says *"Keep Python files under 500 lines"* – similar guidance applies to TS.

**Recommendation:** Split into:

- `navbar-desktop.tsx` – desktop menu items
- `navbar-mobile.tsx` – mobile drawer
- `navbar-language-selector.tsx` – language selector
- `navbar-constants.ts` – styles, class names, constants

---

## 8. **Page Layout Pattern**

Each page uses:

```ts
resolveLocalePageContext(params) → buildLocalizedMetadata
```

**Recommendation:** Extract a shared `createLocalePage` helper:

```ts
export function createLocalePage<T>({ path, getTitle, getDescription, PageContent }) { ... }
```

Then pages can use it for consistent metadata and content handling.

---

## 9. **TypeScript / Design Tokens**

`navbar.tsx` uses:

```ts
(content as NavbarContent & { languageSelector?: {...} }).languageSelector
```

**Recommendation:** Extend `NavbarContent` in `content/index.ts` so `languageSelector` is optional but typed. Avoid `as` casts.

---

## 10. **Testing**

- Vitest + Testing Library is used.
- Tests exist for several components.

**Recommendation:**

- Add tests for `locale-page.ts`, `locale-routing.ts`, `seo.ts`.
- Ensure FAQ contact CTA uses `localizePath` and add a test for it.
- Add tests for shared section background helpers.

---

## 11. **SEO / Sitemap**

- `robots.ts` and `sitemap.ts` are in place.
- `/resources` redirects to `/#resources` and is not in the sitemap.

**Recommendation:** Decide if `/resources` should be indexed. If yes, add it to the sitemap; if not, document that it is intentionally excluded.

---

## 12. **Best Practices Summary**

| Area | Recommendation |
|------|-----------------|
| **Server vs client** | Prefer server components; keep `'use client'` only where needed |
| **Duplication** | Extract shared section styles, redirect helpers, and page metadata helpers |
| **Component size** | Split navbar into smaller components |
| **i18n** | Ensure all links use `localizePath` / `localizeHref` |
| **Fonts** | Reduce to 2–3 fonts and subset where possible |
| **Images** | Use `.webp` for images and keep layout/sizing consistent |
| **Types** | Use proper types instead of `as` casts |
| **Tests** | Add tests for shared libs and locale-aware links |

---

## Suggested Implementation Order

1. Fix FAQ contact CTA locale (bug).
2. Extract shared section background styles.
3. Split navbar into smaller components.
4. Add shared redirect helper.
5. Add `createLocalePage` helper.
6. Refine font loading.
7. Add tests for shared utilities and locale behavior.
