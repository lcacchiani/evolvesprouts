# Public WWW Audit — Reusability, Best Practice & Security

> Full audit of `apps/public_www` performed against `.cursorrules` conventions,
> Next.js/TypeScript best practices, WCAG accessibility standards, and frontend
> security baselines.

---

## 1 Reusability

### 1.1 `mergeClassNames` duplicated in five files — HIGH

The identical helper function is independently defined in:

- `src/components/shared/overlay-surface.tsx`
- `src/components/shared/placeholder-panel.tsx`
- `src/components/shared/button-primitive.tsx`
- `src/components/sections/shared/section-container.tsx`
- `src/components/sections/shared/section-header.tsx`

Additional ad-hoc `.filter(Boolean).join(' ')` patterns exist in
`background-glow.tsx`, `external-link-icon.tsx`, and
`section-eyebrow-chip.tsx`.

**Recommendation:** Extract a single `mergeClassNames` function into
`src/lib/class-utils.ts` and import it everywhere. This eliminates five
copies of the same code and ensures consistent behaviour.

### 1.2 `globals.css` mixes design tokens with section-specific rules — HIGH

At 1,728 lines the stylesheet bundles three concerns:

1. Base resets and typography (`@layer base`).
2. Design-system token variables (`:root` custom properties).
3. Highly specific component rules (`@layer components`) such as
   `es-my-best-auntie-booking-part-line--with-gap-stacked`.

**Recommendation:**

- Keep only shared design-system primitives (buttons, typography, surfaces,
  borders) in `globals.css`.
- Move section-specific rules closer to their components (CSS Modules or
  colocated Tailwind classes).
- This reduces the blast radius of CSS changes and improves navigability.

### 1.3 `SiteContent` prop bag passed to page composers — MEDIUM

Page composition components (`homepage.tsx`, `about-us.tsx`, etc.) receive
the entire `SiteContent` object and destructure it per section. This couples
every page composer to the full content shape.

**Recommendation:** Define page-level content types that contain only the
slices each page actually uses. This makes each page component's
dependencies explicit and easier to test in isolation.

### 1.4 `localizePath` re-exported from `seo.ts` — LOW

`src/lib/seo.ts` re-exports `localizePath` from `src/lib/locale-routing.ts`
as a thin wrapper. Consumers should import directly from the canonical
module.

**Recommendation:** Remove the wrapper in `seo.ts` and update import sites
to use `locale-routing.ts`.

---

## 2 Best Practices

### 2.1 `my-best-auntie-booking-modal.tsx` exceeds 500 lines (635) — HIGH

The component handles form state for seven-plus fields, discount code
validation, price calculation, course part rendering, and the full payment
form UI in a single file.

**Recommendation:** Extract into smaller subcomponents:

- `BookingModalPartsList` — course parts timeline.
- `BookingModalPricingSection` — pricing, location, learn-more CTA.
- `BookingModalReservationForm` — form fields, discount, acknowledgements,
  submit.

### 2.2 Form validation errors lack `aria-describedby` — MEDIUM

In `contact-us-form.tsx` the email validation error is rendered as a
`role="alert"` paragraph but is not linked to its input via
`aria-describedby`. The booking modal form fields have no error association
at all.

**Recommendation:** Add `id` attributes to error message elements and
matching `aria-describedby` on inputs for full WCAG 2.1 compliance.

### 2.3 ESLint config uses CommonJS — MEDIUM

`eslint.config.js` uses `require()` and `module.exports`. With ESLint v10
flat config, ES module syntax is preferred.

**Recommendation:** Rename to `eslint.config.mjs` and convert to
`import`/`export`.

### 2.4 `next.config.js` could be TypeScript — LOW

The rest of the codebase is TypeScript. Next.js 16 supports
`next.config.ts`.

**Recommendation:** Rename to `next.config.ts` for type-safety consistency.

### 2.5 No error boundary components — LOW

Client-side sections that fetch data (events, booking modal) or manage
complex form state have no React Error Boundary wrappers.

**Recommendation:** Add a shared `ErrorBoundary` component in
`src/components/shared/` for resilient client-side rendering.

### 2.6 Footer renders the logo image three times — LOW

Three `<Image>` elements for mobile, tablet, and desktop visibility.

**Recommendation:** Acceptable for responsive layout but could be
consolidated with a single responsive image if bundle size becomes a
concern.

### 2.7 Positive observations

- `SmartLink` and `ButtonPrimitive` are well-designed shared primitives
  handling internal/external link discrimination, `rel` attributes, and
  render props.
- `createPlaceholderPage` factory in `locale-page.ts` is a good DRY
  pattern for stub pages.
- Modals are correctly code-split with `next/dynamic` and `{ ssr: false }`.
- Lighthouse CI is configured with a 0.9 minimum across all four audit
  categories for every locale.
- Component file naming is consistent kebab-case with named exports.

---

## 3 Security

### 3.1 `document.write()` in thank-you modal print flow — HIGH

`booking-modal/thank-you-modal.tsx` opens a popup window and injects HTML
via `popup.document.write(printHtml)`. The `escapeHtml()` helper sanitises
interpolated values, which mitigates direct XSS, but the pattern itself is
fragile.

**Recommendation:**

- Replace with programmatic DOM construction in the popup, or apply a
  print-specific CSS stylesheet and call `window.print()` on the current
  page.
- If `document.write()` is retained, add a `<meta>` CSP tag in the printed
  document to block script execution.

### 3.2 API key exposed via `NEXT_PUBLIC_` prefix — MEDIUM

```
baseUrl: process.env.NEXT_PUBLIC_WWW_CRM_API_BASE_URL ?? '',
apiKey: process.env.NEXT_PUBLIC_WWW_CRM_API_KEY ?? '',
```

The `NEXT_PUBLIC_` prefix embeds the API key in the client-side bundle,
visible to anyone inspecting the page source.

**Recommendation:**

- Verify the key has minimal read-only permissions (events listing,
  discounts listing only).
- Implement rate limiting on the API backend for this key.
- Document this as an intentionally public key with restricted scope in
  `docs/architecture/security.md`.
- Longer term, consider proxying API calls through an edge function to
  avoid exposing the key entirely.

### 3.3 FPS merchant mobile number hardcoded in client code — MEDIUM

`booking-modal/shared.tsx` contains:

```
const FPS_MOBILE_NUMBER = '85297942094';
```

**Recommendation:** FPS payment details must be visible to the payer, so
client exposure is expected. Consider fetching this value from the API to
allow changes without redeployment.

### 3.4 Booking form fields passed unsanitised to callback — MEDIUM

The booking modal passes raw form values (name, email, phone, topics) to
`onSubmitReservation`. While the thank-you modal uses `escapeHtml()` for
display, downstream consumers may not.

**Recommendation:** Trim and sanitise all form values at the form boundary
before passing them to callbacks. Establish a convention where data leaving
a form component is always cleaned.

### 3.5 Contact form phone field has no format validation — LOW

`contact-us-form.tsx` validates email but accepts any string for the phone
field. The value is embedded in a `mailto:` link body via
`URLSearchParams`.

**Recommendation:** Add a basic phone pattern check (length, numeric
characters) to prevent malformed data.

### 3.6 No Content-Security-Policy headers documented — MEDIUM

For a static export site CSP would be configured at the CDN/hosting layer.
There is no documentation or meta tag indicating the expected policy.

**Recommendation:** Document the target CSP in
`docs/architecture/security.md` or add a CSP `<meta>` tag in the root
layout.

### 3.7 Positive observations

- Zero `console.log/warn/error` calls in `src/`.
- No `dangerouslySetInnerHTML` or direct `innerHTML` usage.
- `SmartLink` correctly applies `rel="noopener noreferrer"` for external
  links.
- `sanitizeExternalHref()` in `events-data.ts` and `sanitizePath()` in
  `locale-routing.ts` properly guard against malformed input.

---

## 4 Test Coverage Gaps

### 4.1 Untested section components — MEDIUM

The following sections have no test file in `tests/components/sections/`:

| Component file | Status |
|---|---|
| `banner.tsx` | No test |
| `course-highlight-card.tsx` | No test |
| `course-highlights.tsx` | No test |
| `course-module.tsx` | No test |
| `deferred-testimonials.tsx` | No test |
| `deferred-testimonials-client.tsx` | No test |
| `free-resources.tsx` | No test |
| `ida.tsx` | No test |
| `reach-out.tsx` | No test |
| `real-stories.tsx` | No test |
| `whoops.tsx` | No test |
| `why-joining-our-courses.tsx` | No test |

### 4.2 Untested shared components — LOW

| Component file | Status |
|---|---|
| `background-glow.tsx` | No test |
| `external-link-icon.tsx` | No test |
| `page-layout.tsx` | No test |
| `whatsapp-contact-button.tsx` | No test |
| `overlay-surface.tsx` | No test |

### 4.3 Untested page composition components — MEDIUM

None of the files in `src/components/pages/` have corresponding tests:

- `homepage.tsx`
- `about-us.tsx`
- `contact-us.tsx`
- `events.tsx`
- `my-best-auntie.tsx`
- `empty-page-placeholder.tsx`

### 4.4 Untested utility files — LOW

- `src/lib/design-tokens.ts`
- `src/lib/section-backgrounds.ts`
- `src/lib/routes.ts`

### 4.5 `booking-modal/helpers.ts` has no tests — MEDIUM

Contains `applyDiscount`, `resolveLocalizedDate`, `escapeHtml`, and
`extractTimeRangeFromPartDate`. The `escapeHtml` function is
security-critical and must be covered.

**Recommendation:** Add unit tests for all exported functions with
edge-case coverage, prioritising `escapeHtml`.

---

## 5 Architecture Notes

### 5.1 Dual route structure — MEDIUM

Every route exists in both `src/app/<route>/page.tsx` (root redirect) and
`src/app/[locale]/<route>/page.tsx` (actual page). Alias redirects add a
third copy for some routes.

**Recommendation:** Consider a build-time script to auto-generate the root
redirect pages and eliminate manual maintenance.

### 5.2 `ROUTES.terms` missing from sitemap — LOW

`ROUTES.terms` is defined but not included in `INDEXED_ROUTE_PATHS`. The
terms page will not appear in the generated sitemap.

**Recommendation:** Add `ROUTES.terms` to `INDEXED_ROUTE_PATHS` or
document the intentional exclusion with a code comment.

### 5.3 `images.unoptimized: true` — LOW

Required by `output: 'export'` since Next.js image optimisation needs a
server. The `scripts/optimize-images.mjs` pipeline covers this gap.

**Recommendation:** Verify the script produces properly-sized WebP images.
Add explicit `sizes` attributes to `<Image>` components to prevent layout
shift.

---

## 6 Priority Summary

| Priority | Finding | Section |
|---|---|---|
| HIGH | Extract shared `mergeClassNames` utility | 1.1 |
| HIGH | Split `my-best-auntie-booking-modal.tsx` (635 lines) | 2.1 |
| HIGH | Replace `document.write()` in print flow | 3.1 |
| MEDIUM | Split `globals.css` (1,728 lines) | 1.2 |
| MEDIUM | Document or restrict public API key scope | 3.2 |
| MEDIUM | Add `aria-describedby` for form validation errors | 2.2 |
| MEDIUM | Sanitise booking form inputs at boundary | 3.4 |
| MEDIUM | Document Content-Security-Policy expectations | 3.6 |
| MEDIUM | Add tests for `booking-modal/helpers.ts` | 4.5 |
| MEDIUM | Add tests for untested section components | 4.1 |
| MEDIUM | Add tests for page composition components | 4.3 |
| MEDIUM | Consider auto-generating root redirect pages | 5.1 |
| LOW | Convert `next.config.js` to TypeScript | 2.4 |
| LOW | Modernise ESLint config to ES modules | 2.3 |
| LOW | Add `ROUTES.terms` to indexed paths | 5.2 |
| LOW | Remove `localizePath` re-export wrapper in `seo.ts` | 1.4 |
| LOW | Add phone validation to contact form | 3.5 |
| LOW | Add error boundary component | 2.5 |
| LOW | Add tests for untested shared components | 4.2 |
| LOW | Add tests for untested utility files | 4.4 |
