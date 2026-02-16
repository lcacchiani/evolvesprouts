# Optimization and Refactoring Plan for `apps/public_www`

**Date:** 16 February 2026
**Scope:** `apps/public_www` (Next.js public website, static export)

---

## 1. Duplicated `createMaskIconStyle` Utility (Quick Win)

**Files to modify:**
- `src/components/sections/my-best-auntie-booking.tsx` (lines 56-68)
- `src/components/sections/my-best-auntie-booking-modal.tsx` (lines 422-434)

**Problem:** The `createMaskIconStyle` function is identically duplicated in both files.

**Proposed fix:** Extract into a shared utility, e.g., `src/lib/css-utils.ts`, and import in both components.

**Risk:** None -- pure refactoring.

---

## 2. Duplicated Section Background Constants (Medium Priority)

**Files affected:**
- `src/components/sections/deferred-testimonials.tsx` (lines 14-21)
- `src/components/sections/testimonials.tsx` (lines 41-48)
- `src/components/sections/my-best-auntie-overview.tsx` (lines 37-43)
- `src/components/sections/course-highlights.tsx` (lines 34-40)

**Problem:** The section background CSS variable pattern (`SECTION_BACKGROUND_IMAGE`, `SECTION_BACKGROUND_POSITION`, `SECTION_BACKGROUND_SIZE`, `SECTION_BACKGROUND_FILTER`, `SECTION_BACKGROUND_MASK_IMAGE`) is repeated across 4+ components with only slight variations. The `DeferredTestimonials` component duplicates all the background constants from `Testimonials`.

**Proposed fix:** Create a shared `SectionBackgroundPreset` module in `src/lib/section-backgrounds.ts` that exports preset configurations (e.g., `LOGO_WATERMARK_TOP`, `LOGO_WATERMARK_DEEP`) and a helper function `buildSectionBackgroundStyle(preset, overrides?)`.

**Risk:** Low -- visual regression should be caught by Lighthouse CI or visual diff.

---

## 3. Duplicated CSSProperties Style Objects (Medium Priority)

**Files affected:** Nearly every section component.

**Problem:** Many components declare almost identical `CSSProperties` objects for common patterns:
- `headingStyle` with Poppins font, `HEADING_TEXT_COLOR`, weight 700
- `bodyStyle` with Lato font, `BODY_TEXT_COLOR`, weight 400
- `eyebrowTextStyle` with Lato font, 18px, weight 500
- `ctaStyle` with Lato font, weight 600

These are re-declared with minor variations in `hero-banner.tsx`, `testimonials.tsx`, `events.tsx`, `my-best-auntie-booking.tsx`, `my-best-auntie-booking-modal.tsx`, `my-best-auntie-overview.tsx`, `course-highlights.tsx`, `free-resources-for-gentle-parenting.tsx`, `sprouts-squad-community.tsx`, and `contact-us-form.tsx`.

**Proposed fix:** Extend `src/lib/design-tokens.ts` with shared style factory functions or pre-built style objects:

```typescript
export function headingStyle(overrides?: Partial<CSSProperties>): CSSProperties { ... }
export function bodyTextStyle(overrides?: Partial<CSSProperties>): CSSProperties { ... }
export function eyebrowStyle(overrides?: Partial<CSSProperties>): CSSProperties { ... }
```

**Risk:** Low -- each component can still override specific values.

---

## 4. Duplicate `isSupportedLocale` / `isValidLocale` Type Guards

**Files affected:**
- `src/lib/locale-routing.ts` (line 8): `isSupportedLocale`
- `src/content/index.ts` (line 73): `isValidLocale`

**Problem:** Both are functionally identical type guards (`SUPPORTED_LOCALES.includes(value as Locale)`).

**Proposed fix:** Keep only `isValidLocale` in `src/content/index.ts` (already the canonical source of locale types). Have `src/lib/locale-routing.ts` import and re-export or simply use `isValidLocale`.

**Risk:** None.

---

## 5. Duplicate `resolveLocaleFromPathname` / `getLocaleFromPath` Logic

**Files affected:**
- `src/lib/locale-document.ts` (line 21): `resolveLocaleFromPathname`
- `src/lib/locale-routing.ts` (line 37): `getLocaleFromPath`

**Problem:** Both functions parse a pathname and extract a locale from the first segment, falling back to `DEFAULT_LOCALE`. They differ only in that `getLocaleFromPath` runs `sanitizePath` first.

**Proposed fix:** Consolidate into a single `getLocaleFromPath` in `locale-routing.ts` and import it in `locale-document.ts`.

**Risk:** None.

---

## 6. Root-Level Redirect Pages -- DRY Generator Pattern

**Files affected:** 10+ root-level redirect pages:
- `src/app/page.tsx`, `src/app/about/page.tsx`, `src/app/about-us/page.tsx`, `src/app/contact-us/page.tsx`, `src/app/contact/page.tsx`, `src/app/events/page.tsx`, `src/app/privacy/page.tsx`, `src/app/resources/page.tsx`, `src/app/book/page.tsx`, `src/app/terms/page.tsx`, `src/app/services/workshops/page.tsx`, `src/app/services/my-best-auntie/page.tsx`, `src/app/services/my-best-auntie-training-course/page.tsx`

**Problem:** Each is a nearly identical 3-6 line file that calls `redirect('/en/...')`. This is boilerplate that will grow with every new route.

**Proposed fix:** While Next.js App Router requires physical `page.tsx` files, create a factory function `createRootRedirectPage(targetPath: string)` in `src/lib/locale-page.ts` to reduce each file to a single line:

```typescript
export default createRootRedirectPage('/en/about-us');
```

**Risk:** Low. Ensure static export still generates these redirect pages correctly.

---

## 7. Locale Alias Pages -- DRY Factory

**Files affected:**
- `src/app/[locale]/about/page.tsx`
- `src/app/[locale]/contact/page.tsx`
- `src/app/[locale]/resources/page.tsx`
- `src/app/[locale]/book/page.tsx`
- `src/app/[locale]/services/my-best-auntie/page.tsx`

**Problem:** Same pattern: resolve locale from params, redirect to canonical path.

**Proposed fix:** Create `createLocaleAliasRedirectPage(targetPath: string)` factory in `src/lib/locale-page.ts`.

**Risk:** Low.

---

## 8. Placeholder Pages -- DRY Factory

**Files affected:**
- `src/app/[locale]/privacy/page.tsx`
- `src/app/[locale]/terms/page.tsx`
- `src/app/[locale]/services/workshops/page.tsx`

**Problem:** These three pages follow an identical pattern with `PLACEHOLDER_OPTIONS`, `generateMetadata`, and `resolvePlaceholderPageTitle`. The helper infrastructure already exists in `locale-page.ts` but each page still has ~12 lines of boilerplate.

**Proposed fix:** Create `createPlaceholderPage(options)` that returns both the default export and `generateMetadata` export.

**Risk:** Low. Needs to ensure Next.js can still tree-shake and statically analyze exports.

---

## 9. Missing `generateStaticParams` on Several `[locale]` Pages

**Files affected:**
- `src/app/[locale]/about-us/page.tsx`
- `src/app/[locale]/contact-us/page.tsx`
- `src/app/[locale]/events/page.tsx`
- `src/app/[locale]/services/my-best-auntie-training-course/page.tsx`
- `src/app/[locale]/privacy/page.tsx`, `terms/page.tsx`, `services/workshops/page.tsx`

**Problem:** Only `src/app/[locale]/page.tsx` and `src/app/[locale]/layout.tsx` export `generateStaticParams`. With `output: 'export'`, Next.js needs `generateStaticParams` on every dynamic route segment to know which paths to pre-render. Currently relying on the layout's `generateStaticParams` which may or may not propagate depending on Next.js version. Explicitly adding it ensures correctness.

**Proposed fix:** Add `export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';` (or equivalent) to every `[locale]` page that lacks it.

**Risk:** Low -- ensures all localized pages are statically generated correctly.

---

## 10. Navbar Component Complexity -- Extract Sub-components

**File:** `src/components/sections/navbar.tsx` (957 lines)

**Problem:** This single file contains the entire Navbar: `LanguageSelectorButton`, `BookNowButton`, `TopLevelMenuLink`, `SubmenuLinks`, `DesktopMenuItem`, `DesktopMenuItems`, `MobileMenuItem`, `MobileMenuItems`, and the main `Navbar`. At 957 lines, it's close to the 500-line guideline and hard to maintain.

**Proposed fix:** Extract into a `src/components/sections/navbar/` directory:
- `navbar/index.tsx` -- main `Navbar` export
- `navbar/desktop-menu.tsx` -- `DesktopMenuItems`, `DesktopMenuItem`
- `navbar/mobile-menu.tsx` -- `MobileMenuItems`, `MobileMenuItem`
- `navbar/language-selector.tsx` -- `LanguageSelectorButton`
- `navbar/constants.ts` -- shared constants and styles

**Risk:** Medium -- the sub-components share substantial state through callbacks. Needs careful prop threading.

---

## 11. Booking Modal Component Complexity

**File:** `src/components/sections/my-best-auntie-booking-modal.tsx` (1256 lines)

**Problem:** The largest component file in the project at 1256 lines. Contains `MyBestAuntieBookingModal`, `MyBestAuntieThankYouModal`, `FpsQrCode`, `DiscountBadge`, `ModalOverlay`, `CloseButton`, and extensive utility functions.

**Proposed fix:** Extract into `src/components/sections/booking-modal/`:
- `booking-modal/booking-modal.tsx`
- `booking-modal/thank-you-modal.tsx`
- `booking-modal/fps-qr-code.tsx`
- `booking-modal/modal-overlay.tsx` (reusable for any future modal)
- `booking-modal/close-button.tsx`
- `booking-modal/helpers.ts` (for `loadExternalScript`, `escapeHtml`, etc.)

**Risk:** Medium -- same as navbar.

---

## 12. Font Weight Optimization (Performance)

**File:** `src/app/layout.tsx`

**Problem:** Four Google Fonts are loaded with many weight/style combinations:
- Lato: 4 weights x 2 styles = 8 font files
- Poppins: 5 weights x 2 styles = 10 font files
- Urbanist: 5 weights x 2 styles = 10 font files
- Plus Jakarta Sans: 5 weights x 1 style = 5 font files

Total: ~33 font files. Most weights (e.g., Lato 900, Urbanist 800, Poppins 800) may not be used anywhere.

**Proposed fix:** Audit actual font weight usage across all components and content, then trim to only used weights. Remove italic styles that aren't used. For example:
- Lato: likely only 400, 600, 700 needed (drop 300, 900, italics)
- Urbanist: likely only 600 needed (footer column titles)
- Plus Jakarta Sans: likely only 600 needed (navbar book button)
- Poppins: likely 500, 600, 700 needed (drop 400, 800, italics)

**Risk:** Low if audited carefully. Wrong removal would cause visual regression.

---

## 13. PNG Images in `/public/images/my-best-auntie-booking/` -- Convert to WebP

**Files affected:**
- `public/images/my-best-auntie-booking/seat-tree.png`
- `public/images/my-best-auntie-booking/flying-chip.png`
- `public/images/my-best-auntie-booking/small-tree-form.png`
- `public/images/my-best-auntie-booking/modal-big-tree.png`
- `public/images/my-best-auntie-booking/thank-you-modal-tree.png`
- `public/images/my-best-auntie-booking/green-tick-icon.png`
- `public/images/my-best-auntie-booking/clock.png`
- `public/images/baby.png`, `public/images/toddler.png`, `public/images/kid.png`
- `public/images/flags/cn.png`, `hk.png`, `gb.png`

**Problem:** These are PNG files while the hero and testimonial images are already optimized as WebP. PNG files are significantly larger.

**Proposed fix:** Convert to WebP using the existing `scripts/optimize-images.mjs` pipeline and update all references. The flag images at 30x30 display are negligible, so prioritize the booking modal tree/decorative images.

**Risk:** Low -- the `optimize-images.mjs` script already exists.

---

## 14. Hardcoded Color Values -- Extract to Design Tokens

**Problem:** Many components contain hardcoded hex colors like `#C84A16`, `#E76C3D`, `#F2A975`, `#333333`, `#4A4A4A`, `#EECAB0`, `#FFF0E5`, etc. While some are referenced via Figma CSS variables, many are not. This makes theme changes or dark mode support difficult.

**Proposed fix:** Expand `src/lib/design-tokens.ts` to export all brand colors as named constants:

```typescript
export const BRAND_ORANGE = '#C84A16';
export const BRAND_ORANGE_LIGHT = '#F2A975';
export const ACCENT_SALMON = '#E76C3D';
export const BORDER_WARM = '#EECAB0';
export const BG_WARM_LIGHT = '#FFF0E5';
// etc.
```

Or better yet, map them to CSS custom properties in `globals.css` and reference those.

**Risk:** Low -- pure refactoring with no functional change.

---

## 15. `EmptyPagePlaceholder` Doesn't Use `PageLayout`

**File:** `src/components/empty-page-placeholder.tsx`

**Problem:** This component renders its own `<main>` tag but doesn't include `<Navbar>` or `<Footer>`. Pages using it (privacy, terms, workshops) render without site navigation. Compare with `not-found.tsx` which does use `PageLayout`.

**Proposed fix:** Either wrap `EmptyPagePlaceholder` in `PageLayout` at the page level (like `not-found.tsx` does), or make `EmptyPagePlaceholder` accept optional `navbarContent`/`footerContent` props.

**Risk:** Low -- improves UX on placeholder pages.

---

## 16. Missing SEO: Open Graph / Twitter Card Metadata

**File:** `src/lib/seo.ts`

**Problem:** `buildLocalizedMetadata` only returns `title`, `description`, `alternates`, and `robots`. It lacks Open Graph and Twitter Card metadata, which are important for social sharing.

**Proposed fix:** Add `openGraph` and `twitter` properties:

```typescript
openGraph: {
  title: pageTitle,
  description,
  url: localizePath(path, locale),
  siteName: 'Evolve Sprouts',
  locale,
  type: 'website',
},
twitter: {
  card: 'summary_large_image',
  title: pageTitle,
  description,
},
```

**Risk:** None -- additive improvement.

---

## 17. `tailwind.config.ts` Appears Unused with Tailwind v4

**File:** `tailwind.config.ts`

**Problem:** The project uses `@tailwindcss/postcss` v4 (see `postcss.config.js` and `package.json`). Tailwind v4 uses CSS-first configuration via `@import 'tailwindcss'` in CSS (which `globals.css` does). The `tailwind.config.ts` is a v3-style config that may be ignored by Tailwind v4.

**Proposed fix:** Verify whether this config is actually consumed. If not, remove it to avoid confusion. Tailwind v4 content detection is automatic.

**Risk:** Low -- needs testing.

---

## 18. Duplicate `toRecord` Utility

**Files affected:**
- `src/lib/events-data.ts` (line 54)
- `src/lib/discounts-data.ts` (line 20)

**Problem:** Both files have an identical `toRecord` helper that casts `unknown` to `Record<string, unknown>`.

**Proposed fix:** Move to `src/content/content-field-utils.ts` (which already houses similar helpers).

**Risk:** None.

---

## 19. `autoprefixer` May Be Redundant

**File:** `postcss.config.js`

**Problem:** Tailwind CSS v4 includes vendor prefixing out of the box via Lightning CSS. The separate `autoprefixer` PostCSS plugin may be redundant.

**Proposed fix:** Test removing `autoprefixer` from PostCSS config, verify that all CSS still works correctly. This simplifies the build pipeline.

**Risk:** Low -- needs build verification.

---

## 20. Inline SVGs -- Consider Icon Component Library

**Problem:** Many section components contain large inline SVG icons (social icons in footer, various chevrons, calendar/clock/location icons in events, loading gear, WhatsApp icon path, etc.). These are duplicated or similar across files.

**Proposed fix:** Create `src/components/icons/` directory with reusable icon components:
- `chevron-icon.tsx` (used in testimonials, booking, navbar)
- `calendar-icon.tsx` (used in events, booking)
- `close-icon.tsx` (used in booking modal, navbar)
- `social-icons.tsx` (Facebook, LinkedIn, Instagram, TikTok)

**Risk:** Low -- pure refactoring.

---

## Summary Priority Matrix

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| **High** | 12. Font weight optimization | Performance | Low |
| **High** | 13. PNG to WebP conversion | Performance | Low |
| **High** | 9. Missing `generateStaticParams` | Correctness | Low |
| **High** | 15. `EmptyPagePlaceholder` missing nav | UX | Low |
| **High** | 16. Missing OG/Twitter metadata | SEO | Low |
| **Medium** | 1. Duplicate `createMaskIconStyle` | Maintainability | Low |
| **Medium** | 2. Section background constants | Maintainability | Low |
| **Medium** | 3. Duplicate CSSProperties styles | Maintainability | Medium |
| **Medium** | 4+5. Duplicate locale type guards | Maintainability | Low |
| **Medium** | 10. Navbar decomposition | Maintainability | Medium |
| **Medium** | 11. Booking modal decomposition | Maintainability | Medium |
| **Medium** | 14. Hardcoded colors to tokens | Maintainability | Medium |
| **Medium** | 18. Duplicate `toRecord` utility | Maintainability | Low |
| **Medium** | 20. Icon component library | Maintainability | Medium |
| **Low** | 6. Root redirect page factory | DRY | Low |
| **Low** | 7. Locale alias page factory | DRY | Low |
| **Low** | 8. Placeholder page factory | DRY | Low |
| **Low** | 17. Unused `tailwind.config.ts` | Cleanup | Low |
| **Low** | 19. Redundant `autoprefixer` | Cleanup | Low |

---

## Questions to Validate Before Implementation

1. Should all items be implemented, or should a subset be prioritised?
2. For item 10 (Navbar) and 11 (Booking Modal), should decomposition use subdirectories with barrel exports, or keep flat with longer filenames?
3. For item 12 (fonts), should a detailed audit of which weights are actually used be performed before trimming?
4. For item 14 (color tokens), is the preference for CSS custom properties in `globals.css` or TypeScript constants in `design-tokens.ts`?
