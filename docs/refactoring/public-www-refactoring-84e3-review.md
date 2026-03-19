# Implementation Review: `cursor/www-repository-refactoring-84e3`

> Reviewed: 2026-03-19
> Branch: `cursor/www-repository-refactoring-84e3`
> Commits: 3 (1 merged PR #781 + 1 refactoring + 1 fix)
> CI: All 24 checks pass (lint, tests, security, build)

---

## Refactoring Plan Coverage

| Plan Item | Status | Notes |
|-----------|--------|-------|
| 1a. Extract `formatPartDateTimeLabel` | Done | Moved to `src/lib/format.ts`; all 3 call sites updated |
| 1b. Extract `parseCohortValue`/`formatCohortValue` | Done | Cleaner version kept; moved to `src/lib/format.ts` |
| 2. Extract navbar helpers | Done | `navbar-utils.ts` created; both menu files updated |
| 3. CAPTCHA constants to locale | Done | `common.captcha.*` in all 3 locale JSONs; `api-paths.ts` created |
| 4. Shared FAQ card grid | Done | `faq-card-grid.tsx` used by both FAQ sections |
| 5. Page naming (`*Page` suffix) | Done | All page components renamed |
| 6. Remove dead `ContactMethodList` | Done | Component and test deleted |
| 7. Decompose large files | **Not done** | Was medium priority |
| 8. Consolidate `readRequiredText` | Done | Moved to `content-field-utils.ts` |
| 9. Generalize label-by-href | Done | `findLabelByHref` extracted in `locale-page.ts` |
| 10. Use shared `Locale` type | Done | `SupportedLocale` replaced with `Locale` from `@/content` |
| 11. Align root `/media/download` | Done | Converted to redirect |
| 12. Test suite improvements | **Not done** | Was low priority |

10 of 12 items implemented. The two skipped items (7, 12) were medium/low
priority.

---

## Issues Found

### Issue 1 — Route page naming convention not consistently applied

**Severity:** Low (cosmetic, no runtime impact)

When page components were renamed to `*Page` (e.g. `ContactUsPage`), the
route-level default exports in `src/app/[locale]/` had naming collisions. The
fix commit (81cc850d) renamed them to `*RoutePage`, but only where collisions
existed:

| Route file | Default export name | Convention |
|------------|---------------------|------------|
| `[locale]/page.tsx` | `HomeRoutePage` | `*RoutePage` |
| `[locale]/about-us/page.tsx` | `AboutUsRoutePage` | `*RoutePage` |
| `[locale]/contact-us/page.tsx` | `ContactUsRoutePage` | `*RoutePage` |
| `[locale]/events/page.tsx` | `EventsRoutePage` | `*RoutePage` |
| `[locale]/links/page.tsx` | `LinksRoutePage` | `*RoutePage` |
| `[locale]/services/my-best-auntie-training-course/page.tsx` | `MyBestAuntieRoutePage` | `*RoutePage` |
| `[locale]/privacy/page.tsx` | `PrivacyPage` | **Not `*RoutePage`** |
| `[locale]/terms/page.tsx` | `TermsPage` | **Not `*RoutePage`** |

`PrivacyPage` and `TermsPage` don't collide because the component imports are
`PrivacyPolicyPage` and `TermsAndConditionsPage`. No technical issue, but the
convention is inconsistent.

**Recommendation:** Either rename to `PrivacyRoutePage`/`TermsRoutePage` for
consistency, or document that the `*RoutePage` suffix is only required when a
collision exists.

---

### Issue 2 — `readRequiredText` vs `readOptionalText` return-type asymmetry

**Severity:** Low (API ergonomics)

The consolidated `readRequiredText` returns `string | null`, while
`readOptionalText` returns `string | undefined`. Both represent "no value" but
use different sentinels.

This is inherited from the original `discounts-data.ts` implementation, so
there is no behavioral regression. However, it's a missed opportunity to
standardize on one "empty" representation.

**Recommendation:** Consider aligning to `string | undefined` for consistency
with `readOptionalText`, or document the intentional difference.

---

### Issue 3 — CAPTCHA content prop defaults to English

**Severity:** Low (edge case, fallback only)

Both `EventNotification` and `SproutsSquadCommunity` accept an optional
`commonCaptchaContent` prop with a default of `enContent.common.captcha`:

```typescript
commonCaptchaContent = enContent.common.captcha
```

All current call sites correctly pass locale-aware content
(`content.common.captcha`), so this does not produce incorrect behavior today.
However, if a future caller omits the prop, users on `zh-CN`/`zh-HK` would
see English CAPTCHA error messages.

**Recommendation:** Consider making `commonCaptchaContent` a required prop
(no default) to force callers to pass locale-aware content.

---

### Issue 4 — Unused imports in privacy and terms route pages

**Severity:** Low (dead code)

`[locale]/privacy/page.tsx` and `[locale]/terms/page.tsx` import
`getFooterLinkLabel` but do not use it:

```typescript
import {
  generateLocaleStaticParams,
  getFooterLinkLabel,      // <-- unused
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
```

This appears to be pre-existing (not introduced by this branch), but it was
not cleaned up during the refactoring.

**Recommendation:** Remove the unused `getFooterLinkLabel` imports.

---

## Out-of-Scope Changes (Feature Work Mixed In)

The branch includes PR #781 ("Use events price for landing page CTA label")
which adds non-refactoring feature work:

1. **`ctaPriceLabel` plumbing** — New `ctaPriceLabel` field on
   `LandingPageBookingEventContent`, threaded through `LandingPage` →
   `LandingPageHero` → `LandingPageCta` → `LandingPageBookingCtaAction`.
2. **`buttonLabelTemplate`** — New `LandingPageLocaleContent.cta` field and
   `resolveCtaLabel` function that interpolates `{price}`.
3. **`formatLandingPageEventCtaPriceLabel`** — New function in
   `events-data.ts` (~37 lines).
4. **Hero chip icons** — `landing-page-hero.tsx` now renders `calendar.svg`,
   `clock.svg`, `location.svg` icons inside chips (typed `HeroChip` with
   `type` discriminant).
5. **Partner logo size** — Evolvesprouts logo gets `h-10` vs `h-8` for
   others; `PartnerLogo` now normalizes the partner slug before building
   sources.
6. **CSS change** — `background-size: 110%` → `100%` in
   `components-sections.css`.
7. **Easter workshop JSON** — `buttonLabel` split into `buttonLabel` +
   `buttonLabelTemplate` across all 3 locales.

These changes are reasonable and tested, but they inflate the diff and make it
harder to review the refactoring in isolation. Future refactoring PRs should
avoid mixing feature work.

---

## What Went Well

1. **All CI checks pass** — Lint, tests, security, build, and Lighthouse
   constraints are green.
2. **Test coverage for new code** — New tests for `navbar-utils`,
   `faq-card-grid`, `format.ts` (cohort/dateTime), `content-field-utils`
   (readRequiredText/readRequiredRecordText), and updated landing page tests.
3. **Locale parity** — `common.captcha.*` added to all three locale files
   (`en.json`, `zh-CN.json`, `zh-HK.json`) with proper translations.
4. **Correct behavioral preservation** — `readRequiredRecordText` preserves
   the exact throw behavior of the old `readRequiredText` from
   `copy-normalizers.ts`.
5. **Clean extractions** — `navbar-utils.ts`, `faq-card-grid.tsx`,
   `format.ts`, and `api-paths.ts` are focused, well-typed, and tested.
6. **`findLabelByHref` in `locale-page.ts`** — Clean consolidation that
   removed ~20 lines of repetitive logic.
7. **`CONTACT_US_API_PATH`** — Properly extracted to `api-paths.ts` and
   updated in all 3 consumer files.
8. **Root `/media/download`** — Cleanly converted to a redirect using the
   existing `createDefaultLocaleRedirectPage` pattern; `ROUTES.mediaDownload`
   added to routes and marked as unlisted.
