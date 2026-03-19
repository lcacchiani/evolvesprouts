# Public WWW Refactoring Plan

> Generated: 2026-03-19
> Scope: `apps/public_www/**`
> Status: Ready for implementation

This document catalogues verified refactoring opportunities in the public
website. Each item is self-contained and can be tackled independently unless
noted otherwise.

---

## Table of Contents

1. [Extract duplicated date/cohort helpers](#1-extract-duplicated-datecohort-helpers)
2. [Extract duplicated navbar helpers](#2-extract-duplicated-navbar-helpers)
3. [Extract duplicated CAPTCHA constants and move to locale](#3-extract-duplicated-captcha-constants-and-move-to-locale)
4. [Extract shared FAQ card grid component](#4-extract-shared-faq-card-grid-component)
5. [Standardize page component naming to `*Page` suffix](#5-standardize-page-component-naming-to-page-suffix)
6. [Remove dead `ContactMethodList` component](#6-remove-dead-contactmethodlist-component)
7. [Decompose large files](#7-decompose-large-files)
8. [Consolidate `readRequiredText` into content-field-utils](#8-consolidate-readrequiredtext-into-content-field-utils)
9. [Generalize label-by-href helpers in locale-page.ts](#9-generalize-label-by-href-helpers-in-locale-pagets)
10. [Use shared `Locale` type in events-data.ts](#10-use-shared-locale-type-in-events-datats)
11. [Align root `/media/download` with locale redirect pattern](#11-align-root-mediadownload-with-locale-redirect-pattern)
12. [Test suite improvements](#12-test-suite-improvements)

---

## 1. Extract duplicated date/cohort helpers

**Priority:** High
**Type:** Code duplication

### 1a. `formatPartDateTimeLabel` — triplicated

The same ~23-line date formatting function exists in three files:

| File | Lines |
|------|-------|
| `src/components/sections/events/event-booking-modal.tsx` | 38–60 |
| `src/components/sections/my-best-auntie/my-best-auntie-booking-modal.tsx` | 72–94 |
| `src/components/sections/my-best-auntie/my-best-auntie-booking.tsx` | 165–187 |

**Action:**

- Extract `formatPartDateTimeLabel` into `src/lib/format.ts` (which already
  exists and contains `formatCurrencyHkd`).
- Update all three call sites to import from `@/lib/format`.
- Add unit tests in `tests/lib/format.test.ts`.

### 1b. `formatCohortValue` / `parseCohortValue` — duplicated

| File | Lines | Notes |
|------|-------|-------|
| `my-best-auntie-booking-modal.tsx` | 46–70 | Inline parsing; returns `trimmedValue` on failure |
| `my-best-auntie-booking.tsx` | 82–116 | Cleaner split: `parseCohortValue` + `formatCohortValue` |

**Action:**

- Keep the cleaner `parseCohortValue` / `formatCohortValue` from
  `my-best-auntie-booking.tsx`.
- Extract both into `src/lib/format.ts`.
- Update both call sites.
- Add unit tests in `tests/lib/format.test.ts`.

Also extract the shared `COHORT_VALUE_PATTERN` regex constant alongside the
functions.

---

## 2. Extract duplicated navbar helpers

**Priority:** High
**Type:** Code duplication

Identical implementations of `isHrefActive` and `isMenuItemActive` exist in:

| File | Lines |
|------|-------|
| `src/components/sections/navbar/desktop-menu-items.tsx` | 20–43 |
| `src/components/sections/navbar/mobile-menu-items.tsx` | 21–44 |

`SubmenuLinks` is also structurally similar between the two files (desktop
version adds `id` and `isOpen` props for `aria-hidden`/`tabIndex` control).

**Action:**

- Create `src/components/sections/navbar/navbar-utils.ts`.
- Move `isHrefActive` and `isMenuItemActive` there.
- Optionally extract a shared `SubmenuLinks` component with optional `id` and
  `isOpen` props. If the desktop-specific `aria-hidden`/`tabIndex` logic makes
  a shared component awkward, keep them separate but share the item-rendering
  logic via a helper.
- Add unit tests in `tests/components/sections/navbar/navbar-utils.test.ts`.

---

## 3. Extract duplicated CAPTCHA constants and move to locale

**Priority:** High
**Type:** Code duplication + `.cursorrules` compliance

Identical fallback constants and identical usage patterns are duplicated in:

| File | Lines |
|------|-------|
| `src/components/sections/event-notification.tsx` | 27–32 |
| `src/components/sections/sprouts-squad-community.tsx` | 27–33 |

Constants duplicated:

- `FALLBACK_CAPTCHA_REQUIRED_ERROR`
- `FALLBACK_CAPTCHA_LOAD_ERROR`
- `FALLBACK_CAPTCHA_UNAVAILABLE_ERROR`
- `CONTACT_US_API_PATH`

Per `.cursorrules` locale content contract, user-visible English fallback
strings must live in locale JSON files, not hardcoded in components.

**Action:**

1. Add CAPTCHA error messages to locale content under `common.captcha.*` in
   `en.json`, `zh-CN.json`, and `zh-HK.json`:
   - `common.captcha.requiredError`
   - `common.captcha.loadError`
   - `common.captcha.unavailableError`
2. Extract `CONTACT_US_API_PATH` to a shared constants or config location
   (e.g. `src/lib/crm-api-client.ts` if appropriate, or a new
   `src/lib/api-paths.ts`).
3. Update both components to read CAPTCHA messages from content and use the
   shared API path constant.
4. Remove the `FALLBACK_CAPTCHA_*` constants from both files.
5. Update existing tests for both components.

---

## 4. Extract shared FAQ card grid component

**Priority:** High
**Type:** Code duplication

`contact-us-faq.tsx` and `landing-pages/landing-page-faq.tsx` share
near-identical markup:

- `SectionShell` → `SectionContainer` → `SectionHeader` → `ul` grid
- Same card layout: `li` → `article` with identical Tailwind classes
  (`rounded-2xl border border-black/10 bg-white px-5 py-5 shadow-card ...`)
- Same `h3` + `p` structure for question/answer

Only differences: props shape (`cards` vs `items`), section identifiers, and
optional `ariaLabel`.

**Action:**

- Create `src/components/sections/shared/faq-card-grid.tsx` exporting a
  `FaqCardGrid` component that takes a generic list of `{ question, answer }`
  items and renders the grid.
- Refactor `ContactUsFaq` and `LandingPageFaq` to use `FaqCardGrid`.
- Add unit tests in `tests/components/sections/shared/faq-card-grid.test.tsx`.

---

## 5. Standardize page component naming to `*Page` suffix

**Priority:** Medium
**Type:** Naming consistency

Page components currently use inconsistent naming:

| Current Name | File | New Name |
|--------------|------|----------|
| `AboutUs` | `pages/about-us.tsx` | `AboutUsPage` |
| `MyBestAuntie` | `pages/my-best-auntie.tsx` | `MyBestAuntiePage` |
| `LandingPage` | `pages/landing-pages/landing-page.tsx` | `LandingPage` (already correct) |
| `HomePageSections` | `pages/homepage.tsx` | `HomePage` |
| `EventsPageSections` | `pages/events.tsx` | `EventsPage` |
| `ContactUsPageSections` | `pages/contact-us.tsx` | `ContactUsPage` |
| `PrivacyPolicyPageSections` | `pages/privacy-policy.tsx` | `PrivacyPolicyPage` |
| `TermsAndConditionsPageSections` | `pages/terms-and-conditions.tsx` | `TermsAndConditionsPage` |
| `LinksPageSections` | `pages/links.tsx` | `LinksPage` |
| `EmptyPagePlaceholder` | `pages/empty-page-placeholder.tsx` | `EmptyPagePlaceholder` (keep as-is, utility) |
| `MediaDownloadRedirectPage` | `pages/media-download-redirect.tsx` | `MediaDownloadRedirectPage` (already correct) |

Convention: page composition components use `*Page` suffix.

Section components already follow a consistent naming pattern (no suffix needed
for most; subcomponents like `ReservationFormFields` are clearly named). No
section-level renaming is required.

**Action:**

For each page rename:

1. Rename the exported function.
2. Rename the props type (e.g. `AboutUsProps` → `AboutUsPageProps`).
3. Update all import sites (route pages in `src/app/` and `src/app/[locale]/`).
4. Update corresponding test files in `tests/components/pages/`.

Do this as a single atomic commit to keep imports consistent.

---

## 6. Remove dead `ContactMethodList` component

**Priority:** Medium
**Type:** Dead code

`src/components/sections/contact-us-form-contact-method-list.tsx` exports
`ContactMethodList`, but it is **not imported by any production code**.
`ContactUsForm` implements its own contact methods inline (lines 211–238).
Only the test file references the component.

**Action:**

- Delete `src/components/sections/contact-us-form-contact-method-list.tsx`.
- Delete `tests/components/sections/contact-us-form-contact-method-list.test.tsx`.

---

## 7. Decompose large files

**Priority:** Medium
**Type:** Maintainability

Files exceeding the codebase's complexity comfort zone:

| File | Lines | Suggested splits |
|------|-------|-----------------|
| `src/lib/events-data.ts` | 1545 | Split into: event normalization, API fetch, sorting/filtering, landing-page helpers. At minimum extract `normalizeEventCard` (~89 lines) and its helper functions into a separate module. |
| `src/components/sections/testimonials.tsx` | 693 | Extract: icon components (`ChevronIcon`, `ParentIcon`), normalizer functions (`normalizeStory`, `normalizeStories`), carousel math utilities (`wrapIndex`, `getSlideItemWidth`, `getActiveDomIndex`, `arcPosition`), and subcomponents (`TestimonialSlide`, `AuthorStrip`, `DesktopAuthorRow`). |
| `src/components/sections/my-best-auntie/my-best-auntie-booking.tsx` | 675 | Extract: cohort parsing (see item 1b), date carousel subcomponent, and booking card subcomponent. |
| `src/components/sections/booking-modal/reservation-form.tsx` | 631 | Extract: payment options subcomponent, acknowledgement checkbox subcomponent. |
| `src/components/sections/booking-modal/thank-you-modal.tsx` | 469 | Extract: print document generation into a standalone helper. |
| `src/components/sections/my-best-auntie/my-best-auntie-outline.tsx` | 444 | Extract: module card subcomponent. |
| `src/components/sections/navbar.tsx` | 440 | Extract: mobile menu drawer subcomponent. |

**Action:**

- Tackle `events-data.ts` first (1545 lines, well over the 500-line guideline).
- For component files, extract subcomponents into sibling files within the same
  directory.
- Keep each new file focused on a single concern.
- Update or split corresponding test files to match.

---

## 8. Consolidate `readRequiredText` into content-field-utils

**Priority:** Medium
**Type:** Code organization

`readRequiredText` is independently defined in:

- `src/content/copy-normalizers.ts`
- `src/lib/discounts-data.ts`

Meanwhile, `readOptionalText` already lives in `src/content/content-field-utils.ts`.

**Action:**

- Add `readRequiredText` to `src/content/content-field-utils.ts`.
- Update `copy-normalizers.ts` and `discounts-data.ts` to import from
  `@/content/content-field-utils`.
- Remove the local definitions.
- Add a test in `tests/content/content-field-utils.test.ts`.

---

## 9. Generalize label-by-href helpers in locale-page.ts

**Priority:** Medium
**Type:** Code organization

`getMenuLabel` (lines 56–67) and `getFooterLinkLabel` (lines 69–105) in
`src/lib/locale-page.ts` both follow the same pattern:

1. Search item arrays by `href`.
2. Fall back to default content.
3. Return `fallbackLabel`.

`getFooterLinkLabel` repeats the section-scanning loop twice (locale content
then default content).

**Action:**

- Extract a private `findLabelByHref(itemSets: Array<{href; label}[]>, href)`
  helper.
- Refactor both functions to use it.
- Existing tests in `tests/lib/locale-page.test.ts` should keep passing
  unchanged.

---

## 10. Use shared `Locale` type in events-data.ts

**Priority:** Medium
**Type:** Type consistency

`src/lib/events-data.ts` line 14 defines:

```typescript
type SupportedLocale = 'en' | 'zh-CN' | 'zh-HK';
```

This is identical to `Locale` exported from `@/content`.

**Action:**

- Replace `SupportedLocale` with `import type { Locale } from '@/content'`.
- Update all usages in the file.
- Verify tests still pass.

---

## 11. Align root `/media/download` with locale redirect pattern

**Priority:** Medium
**Type:** Route consistency

All 13 root routes redirect to `/{DEFAULT_LOCALE}/...` except `/media/download`,
which renders actual content using hardcoded `enContent`.

**Action (option A — preferred):**

- Convert root `/media/download/page.tsx` to use
  `createDefaultLocaleRedirectPage(ROUTES.mediaDownload)` (or equivalent),
  matching the pattern of every other root page.

**Action (option B — if root URL must be preserved):**

- Document the intentional exception with a code comment explaining why this
  root page does not redirect.

---

## 12. Test suite improvements

**Priority:** Low
**Type:** Test quality

### 12a. Brittle string assertions

| File | Issue |
|------|-------|
| `tests/content/maintenance-page.test.ts` | Asserts on exact HTML/CSS strings like `'padding: 0.1875rem 1.5rem 1.5rem;'`. Breaks on content/style tweaks. |
| `tests/components/sections/section-structure-contract.test.tsx` | Hardcoded file list (`pageSectionFiles`) must be updated when sections are added. Consider auto-discovering files via glob. |
| `tests/lib/llms-content.test.ts` | Asserts on `enContent` string values. Fragile when content changes. |

### 12b. `window.eval` in test files

`tests/components/shared/google-tag-manager.test.tsx` and
`tests/components/shared/meta-pixel.test.tsx` use `window.eval` to run real
analytics scripts. Consider stubbing the scripts instead.

### 12c. Inconsistent env cleanup

Some tests use `vi.unstubAllEnvs()` in `afterEach`; others do manual
`process.env` restore. Standardize on `vi.stubEnv()` + `vi.unstubAllEnvs()`.

### 12d. Large test files

`tests/components/sections/my-best-auntie-booking-modal.test.tsx` is ~1100
lines. Consider splitting into multiple describe-level files.

### 12e. Missing test coverage

| Module / function | File |
|-------------------|------|
| `getContent`, `withConfiguredRuntimeContent` | `src/content/index.ts` |
| `formatContentTemplate`, `readOptionalText` | `src/content/content-field-utils.ts` |

### 12f. No accessibility tests

No `axe-core` or similar automated accessibility checks exist. Consider adding
`@axe-core/react` or `vitest-axe` for critical page renders.

---

## Implementation Notes

- Each numbered item can be implemented as an independent PR.
- Items 1–4 (high priority) have no cross-dependencies and can be worked in
  parallel.
- Item 5 (page renaming) should be a single atomic commit to avoid broken
  imports.
- Item 7 (large file decomposition) can be done file-by-file in separate
  commits.
- After each change, run `npm run lint` and `npm run test` in the
  `apps/public_www` directory.
- For any content/locale changes, update all three locale files
  (`en.json`, `zh-CN.json`, `zh-HK.json`) in the same commit.
