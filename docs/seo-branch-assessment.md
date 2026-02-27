# SEO Branch Assessment (Round 2): `cursor/seo-issues-assessment-plan-1ec3`

**Date:** 2026-02-26
**Compared against:** Round 1 assessment (`docs/seo-branch-assessment.md` prior)
**New commits reviewed:** `38e1090`, `3d40f79`, `a1d57c1`, `2286bbd`,
`282d50b`, `84add10`, `0493d43`

---

## Summary

Since the first review, seven additional commits have landed on the SEO branch.
They address nearly every item from the Round 1 "still missing" list.
The branch is now in strong shape for launch from an SEO standpoint, with only
a handful of minor items remaining.

---

## Items From Round 1 — Now Resolved

### H1. Testimonial "1)" Artifact — FIXED

The first testimonial in `en.json` now reads "Ida was fantastic..." (no "1)"
prefix). The Chinese locales were similarly fixed — `zh-CN` reads
"Ida 太棒了..." with no artifact.

### H3. Privacy Policy and Terms Pages — FIXED

Both pages have been converted from empty placeholders to full content pages:

- **Privacy Policy:** 7 sections covering data collection, usage, legal basis,
  sharing, retention, rights, and contact. Has `lastUpdatedLabel` and
  `lastUpdatedValue`.
- **Terms and Conditions:** 7 sections covering acceptance, services, booking/
  payments/refunds, user responsibilities, IP, liability, and governing law.
  Includes a `languagePrevailsClause` for multilingual legal clarity.

Both pages are now in `INDEXED_ROUTE_PATHS` (removed from
`PLACEHOLDER_ROUTE_PATHS`), meaning they will appear in the sitemap and be
indexable. All three locales (en, zh-CN, zh-HK) have translated versions.

The `/services/workshops` page remains the only placeholder.

### H4. Root Page Metadata — FIXED (by architecture)

The root `/` page (`src/app/page.tsx`) is a redirect page that sends users to
the default locale (`/en/`). Since it's a redirect, it doesn't need its own
metadata. The root layout correctly sets fallback metadata from
`enContent.seo.fallbackTitle`.

### H5. OG Image Quality — FIXED

The OG image has been replaced: previously 3KB, now 57KB. Still 1200x630px PNG
with colormap encoding. This is a reasonable quality for a branded social
sharing card.

### M1. "Why Joining Our Courses" Grammar — FIXED

Changed to "Why Join Our Courses" in `en.json`. Chinese locales have their
own correct translations.

### M2. Empty Content Sections — FIXED

All six empty sections have been removed from all three locale files:
`courseHighlightsOurCourses`, `banner`, `realStories`, `freeResources`,
`whyJoiningOurCourses`, `courseModule`.

### M3. Font Preloading — FIXED

Both Lato and Poppins now have `preload: true` in the root layout. This
eliminates the Flash of Unstyled Text (FOUT) risk and improves LCP/CLS
Core Web Vitals.

### M5. `<noscript>` Fallback — FIXED

The locale layout now includes a `<noscript>` section with:
- Localized copy for all three languages (en, zh-CN, zh-HK)
- Links to Home and Contact Us pages
- Clean, styled presentation

### M7. Event Schema Client-Side Issue — FIXED

The events page now fetches events server-side during static generation
(`resolveServerSideEvents`) and renders the Event JSON-LD at the page level,
not inside the client component. The client-side events component no longer
contains any structured data logic. This ensures Google crawlers see the
Event schema in the initial HTML without needing JavaScript execution.

The implementation includes a 5-second timeout and graceful error handling —
if the API is unreachable during build, the page still renders without event
schema (no build failure).

### L1. Hero Image Alt Text — FIXED

The hero image now has `alt="Montessori auntie training for Hong Kong families"`
instead of `alt=""`. This provides keyword-relevant alt text for image search.

### L2. FAQ Internal Linking — FIXED

FAQ answers now include contextual "Learn more" links mapped by topic category:
- `general` → About Us
- `discipline` → Training Course
- `support` → Contact Us
- `pricing` → Training Course
- `trust` → About Us
- `enrolment` → Contact Us

Links are localized per the current locale. This improves internal linking depth
and distributes page authority across the site.

### L3. Schema.org `@id` for Entity Linking — FIXED

Structured data now uses consistent `@id` values:
- `ORGANIZATION_SCHEMA_ID` = `{SITE_ORIGIN}#organization`
- `LOCAL_BUSINESS_SCHEMA_ID` = `{SITE_ORIGIN}#local-business`
- Course and Event schemas have locale-specific IDs

The `provider` and `organizer` references in Course and Event schemas point
back to the Organization `@id`, enabling Google to link entities across pages.

### L5. Copyright Year — FIXED

The copyright in content JSON changed from `"© 2025 Evolve Sprouts"` to
`"© Evolve Sprouts"` (year removed). The code already dynamically injects the
current year, so this removes the stale hardcoded year from the content.

### Hero CTA — PARTIALLY ADDRESSED (changed approach)

The hero CTA text remains "Book your Free Intro Session" but the link target
has been changed. Instead of linking to the paid training course page, it now
builds a **WhatsApp pre-filled message link** using
`buildWhatsappPrefilledHref()` with `content.hero.ctaPrefillMessage` =
"Hi, I'd like to book a free session!".

This means the CTA now opens WhatsApp with a pre-filled message, which is a
reasonable approach for a personal service business — it creates a direct
conversation channel rather than sending users to a page with price shock.
The CTA copy is now aligned with the action (initiating a conversation about
a free session via WhatsApp).

### Per-Page OG Image Alts — DONE (image URL same, alt text varies)

While all pages still share the same OG image URL (only one PNG exists), each
page now has a **unique, page-specific alt text** for the social image via
`content.seo.socialImages.{page}.alt`. This is correct semantically and sets up
the infrastructure for per-page images in the future.

---

## What Remains

### Still Not Addressed

| Item | Original Priority | Status | Notes |
|---|---|---|---|
| Blog/content marketing section | Tier 3 (M4) | Not done | Major feature — appropriate to track as separate work |
| Per-page unique OG images (distinct URLs) | Tier 2 (M6) | Infrastructure done, images not yet created | All pages currently share one PNG; alt text varies per page |
| Cookie consent banner | Tier 3 | Not done | Compliance feature |
| Workshops page still placeholder | Tier 1 (original) | Not done | Only remaining placeholder page |
| Google Reviews / Trustpilot widget | Tier 3 | Not done | Third-party integration |
| Video content | Tier 3 | Not done | Content production |
| Location map on Contact page | Tier 3 | Not done | UX enhancement |

### Minor Observations

1. **Per-page unique OG images:** The `socialImages` structure in the content
   JSON is ready for per-page images, but all five entries currently point to
   the same `/images/seo/evolvesprouts-og-default.png`. When distinct images
   are available, only the content JSON needs to be updated — no code changes
   required.

2. **The OG image is colormap-encoded** (8-bit colormap rather than full RGB).
   This is fine for most social platforms but may lose color fidelity for
   photographs. If the final image includes photography, re-encoding as
   8-bit RGB would be better.

3. **Workshops page** (`/services/workshops`) is the only route still in
   `PLACEHOLDER_ROUTE_PATHS`. It is excluded from the sitemap and has
   `noindex` metadata. This is correct handling for an unpublished page.

4. **FAQ duplicate schema on two pages:** The same FAQ JSON-LD is rendered on
   both the About Us page and the Training Course page. Google may flag this
   as duplicate FAQ structured data. Consider rendering FAQ schema only on
   the page with the most relevant context (e.g., About Us for general
   questions, Training Course for pricing/enrollment questions), or
   splitting the FAQ content between pages.

---

## Overall Assessment

| Area | Round 1 Score | Round 2 Score | Change |
|---|---|---|---|
| Meta titles/descriptions | 8/10 | 9/10 | Social image alt per-page added |
| Structured data (JSON-LD) | 8/10 | 9.5/10 | @id linking, server-side events, all types |
| OG/social sharing | 7/10 | 8.5/10 | Real PNG, per-page alts, proper fallbacks |
| Broken links | 9/10 | 9.5/10 | Hero CTA now uses WhatsApp approach |
| Localization | 9/10 | 9.5/10 | Legal pages translated across all 3 locales |
| Content quality | 6/10 | 8.5/10 | Testimonial, grammar, copyright, empty sections all fixed |
| Technical SEO | 7/10 | 9/10 | Font preload, noscript, server-side event schema |
| Legal/trust pages | 2/10 | 8/10 | Privacy + Terms now have real content |

**Overall: 9/10** — The branch is ready for production from an SEO perspective.
The remaining items (blog, per-page OG images, cookie consent, workshops page)
are all growth/compliance features appropriate for separate workstreams.
