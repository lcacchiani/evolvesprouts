# SEO Branch Assessment: `cursor/seo-issues-assessment-plan-1ec3`

**Date:** 2026-02-26
**Compared against:** Original staging assessment (`docs/staging-assessment.md`)
**Branch commits reviewed:** `c688914`, `4c512ae`

---

## Summary

The SEO branch addresses the majority of the high-priority structural SEO
recommendations from the original assessment. Structured data, meta titles,
OG images, broken links, and Chinese navigation translation are all
implemented. However, several SEO-related items remain unaddressed.

---

## What Was Implemented (Correctly)

### 1. Meta Titles and Descriptions — DONE

- **Homepage title:** Changed from "Evolve Sprouts" to
  "Evolve Sprouts | Montessori Auntie Training in Hong Kong". Keyword-rich and
  locale-aware via `content.seo.home.title`.
- **Homepage description:** Changed from generic "Helping your child grow..."
  to "Transform your domestic helper into a Montessori-guided child development
  partner. Training courses for families with children aged 0-6 in Hong Kong."
- **Root layout fallback:** Changed from "Evolve Sprouts public website." to
  the keyword-rich fallback title/description from `enContent.seo`.
- **Training course page:** Now uses `content.seo.trainingCourse.description`
  instead of the transactional "Reserve your seat..." text.
- **All locales have translated SEO content:** `zh-CN` and `zh-HK` each have
  their own `seo` block with proper Chinese titles and descriptions.

### 2. Structured Data (JSON-LD) — DONE

All six recommended schema types have been implemented:

| Schema Type | Where Rendered | Implementation |
|---|---|---|
| Organization | Locale layout (all pages) | Server-rendered, env-driven social links |
| LocalBusiness | Locale layout (all pages) | Server-rendered, env-driven address/phone |
| BreadcrumbList | About Us, Contact Us, Events, Training Course | Per-page with correct locale URLs |
| FAQPage | About Us, Training Course | Full Q&A array from content |
| Course | Training Course page | Name, description, provider, localized URL |
| Event | Events page | Client-side after API fetch, per-event with offers |

The implementation is clean:
- A shared `StructuredDataScript` component handles empty-data guards.
- A `compactJsonLdObject` utility strips undefined fields to produce valid
  JSON-LD.
- Tests cover all six builders with locale, env, and edge-case scenarios.

### 3. Open Graph / Social Sharing Image — DONE

- Default social image changed from SVG (`evolvesprouts-logo.svg`) to PNG
  (`/images/seo/evolvesprouts-og-default.png`).
- The PNG is 1200x630px — the correct dimensions for OG/Twitter cards.
- All pages now pass `socialImage` to `buildLocalizedMetadata`.
- Root layout also has fallback OG/Twitter meta with the PNG image.

**Note:** The PNG file is only 3KB. While technically valid, this suggests it
may be a minimal placeholder. A properly designed OG image with branding,
tagline, and visual appeal would typically be 50-200KB. This should be replaced
with a higher-quality branded image before production launch.

### 4. Broken/Placeholder Links — DONE

| Link | Original | SEO Branch | Assessment |
|---|---|---|---|
| Montessori Training (navbar) | `#` | `/services/my-best-auntie-training-course` | Correct fix |
| Newsletter (footer) | `#` | `/contact-us` | Acceptable interim fix |
| LinkedIn (footer) | `https://linkedin.com` | `/contact-us` (fallback) | See note below |
| Instagram (footer) | `https://instagram.com` | `/contact-us` (fallback) | See note below |

The social links use a smart fallback mechanism: if `NEXT_PUBLIC_LINKEDIN_URL`
or `NEXT_PUBLIC_INSTAGRAM_URL` env vars are set, the actual profile URL is used.
If not set, and the content JSON still has generic root URLs, the footer
component hides those links entirely. The content JSON was updated to use
`/contact-us` as a placeholder. This is a safe approach that prevents generic
social root links from leaking into production.

**Content validation** was also added: the `validate-content.mjs` script now
rejects `#` links in nav/footer and generic social root URLs.

### 5. Chinese Navigation Labels — DONE

Both `zh-CN` and `zh-HK` nav labels are now fully translated:

| Label | zh-CN | zh-HK |
|---|---|---|
| Home | 首页 | 首頁 |
| Training Courses | 培训课程 | 培訓課程 |
| Auntie Training | 阿姨培训 | 姨姨培訓 |
| Montessori Training | 蒙特梭利培训 | 蒙特梭利培訓 |
| About Us | 关于我们 | 關於我們 |
| Events | 活动 | 活動 |
| Contact Us | 联系我们 | 聯絡我們 |

### 6. Hero Subheadline — DONE

Changed from "Helping your child grow..." to "Helping **Hong Kong** children
grow..." across all three locales. Adds geographic keyword naturally.

### 7. Sitemap `lastModified` — DONE

Sitemap entries now include `lastModified`, configurable via
`NEXT_PUBLIC_SITEMAP_LASTMOD` env var. Falls back to the build date. This
addresses the original "no lastmod field" gap.

### 8. Site Config Module — DONE (New)

A new `site-config.ts` module centralizes environment-driven configuration
for social URLs, business address, and phone number. This follows the
`.cursorrules` ban on hardcoded environment-specific values and enables
structured data fields to be populated from deployment config.

### 9. Tests — DONE

Comprehensive test coverage was added:
- `structured-data.test.ts`: 3 tests covering all schema builders
- `seo.test.ts`: 1 new test for social image overrides
- `sitemap.test.ts`: 1 new test for lastModified
- `footer.test.tsx`: Updated to use env-driven social URLs

---

## What Is Still Missing (SEO-Related)

### HIGH PRIORITY — Should Address Before Launch

#### H1. Testimonial "1)" Copy Artifact

The first testimonial still starts with "1)":

```
"1) Ida was fantastic, she helped me understand..."
```

This is a content error visible to users and to search engines that index
testimonial content. It should be "Ida was fantastic..." — a simple content fix
in all three locale files.

#### H2. Hero CTA Mismatch

The hero CTA still reads **"Book your Free Intro Session"** but links to
`/services/my-best-auntie-training-course`, which is a paid course page
(HK$9,000 / HK$18,000). There is no free intro session booking mechanism on
the site.

This is both a UX and SEO issue: search engines evaluate landing page relevance
against the promise made in the CTA. If a user expects a "Free Intro Session"
and lands on a paid course booking page, it increases bounce rate, which is a
negative ranking signal.

**Fix:** Either change the CTA copy to match the destination (e.g., "Explore
Our Training Course") or create a dedicated free intro session booking flow.

#### H3. Privacy Policy and Terms Pages Still Placeholders

Both `/privacy` and `/terms` remain empty `EmptyPagePlaceholder` pages. These
are linked from the booking modal's "Terms & Conditions" checkbox and the
footer. For a site collecting personal data (contact form, booking
reservations), this is a legal risk and a trust signal issue for SEO.

Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)
framework specifically evaluates whether sites have proper legal pages.

#### H4. No Canonical on Non-Locale Root Pages

The site has both `/` and `/en/` (and `/zh-CN/`, `/zh-HK/`). The locale layout
and locale pages have proper `alternates.canonical` pointing to the locale-
prefixed path. However, the root `/` page should set a canonical pointing to
`/en/` (or the default locale path) to avoid duplicate content indexing.

The root `page.tsx` still uses the original metadata builder:
```typescript
title: content.navbar.brand,
description: content.hero.subheadline,
```
It was not updated to use the new `content.seo.home.*` values like the locale
page was.

#### H5. OG Image Quality

The OG image (`evolvesprouts-og-default.png`) is 1200x630px but only 3KB. This
is likely a minimal placeholder graphic. For effective social sharing, the image
should be a properly designed branded card with:
- Company logo
- Tagline or value proposition
- Brand colors
- Professional photography or illustration

The current image will render on social platforms (unlike the previous SVG), but
it won't be visually compelling enough to drive click-through from social
shares.

### MEDIUM PRIORITY — Recommended for SEO Growth

#### M1. "Why Joining Our Courses" Grammar Error

The course highlights section title is still "Why Joining Our Courses" — should
be "Why Join Our Courses" or "Why You Should Join Our Courses." This is a
heading that appears in the page content and may be picked up by search engine
snippets.

#### M2. Empty/Unused Content Sections Not Cleaned Up

Six content sections remain in the JSON files with empty `items` arrays:
- `courseHighlightsOurCourses`
- `banner`
- `realStories`
- `freeResources`
- `whyJoiningOurCourses`
- `courseModule`

While these don't affect the rendered HTML (they aren't rendered in any page
component), they clutter the content files and could confuse content editors or
future automated tooling.

#### M3. Font Preloading Still Disabled

Both Lato and Poppins fonts still have `preload: false`. This can cause
Flash of Unstyled Text (FOUT), which negatively impacts:
- Cumulative Layout Shift (CLS) — a Core Web Vital
- Largest Contentful Paint (LCP) — if the hero headline uses these fonts

Enabling preloading for the primary font weight (Poppins 600 for headings)
would improve perceived performance.

#### M4. No Blog or Content Marketing Section

The site has no article/blog section for targeting long-tail organic search
queries. The target audience (Hong Kong parents) searches for topics like:
- "Montessori at home Hong Kong"
- "how to train domestic helper childcare"
- "gentle parenting tips toddler"

A blog section with 5-10 SEO-optimized articles would significantly improve
organic discovery.

#### M5. No `<noscript>` Fallback Content

Users with JavaScript disabled see an empty page. While rare, search engine
crawlers sometimes evaluate `<noscript>` content. Adding a simple `<noscript>`
message with key content would improve crawlability resilience.

#### M6. Per-Page Unique OG Images

All pages currently share the same default OG image. Creating unique OG images
for the training course page, about us page, and events page would improve
social sharing click-through rates.

#### M7. No Structured Data on the Homepage

The homepage does not have page-specific structured data beyond the global
Organization and LocalBusiness schemas (from the locale layout). Consider
adding:
- A `WebPage` schema for the homepage
- An `EducationalOrganization` type as a more specific Organization subtype

#### M8. Event Schema Is Client-Side Only

The Event JSON-LD is rendered client-side after the events API fetch completes.
Google can execute JavaScript but processes it with a delay (days). For
time-sensitive event schema (which drives Google Events rich results), server-
side rendering or pre-rendering would be more reliable.

### LOW PRIORITY — Optimization Opportunities

#### L1. Image Alt Text Optimization

The hero image has `alt=""` (decorative). While accessible, adding a
descriptive alt like "Child in Montessori learning environment in Hong Kong"
would add keyword relevance for image search.

#### L2. Internal Linking Strategy

No internal linking optimization between pages. The FAQ answers reference
services and concepts but don't link to relevant pages. Adding contextual
internal links improves crawl depth and distributes page authority.

#### L3. Schema.org `@id` for Entity Linking

The Organization and LocalBusiness schemas don't use `@id` properties. Adding
consistent `@id` values would allow Google to link entity references across
pages (e.g., the Course provider pointing to the Organization's `@id`).

#### L4. Sitemap `changefreq` and `priority` Are Static

While the sitemap has correct `changefreq` and `priority`, these are static
values. The events page, which changes frequently, might benefit from `daily`
change frequency. Note: Google largely ignores these fields, so this is very
low priority.

#### L5. Copyright Year in Content JSON

The footer content still has `"copyright": "© 2025 Evolve Sprouts"`. The code
dynamically resolves the year, but if this content is ever consumed by other
systems (e.g., a CMS preview), the hardcoded year would appear outdated.

---

## Scorecard

| Original Recommendation | Status | Quality |
|---|---|---|
| Fix Montessori Training dead link | DONE | Correct |
| Fix Newsletter dead link | DONE | Correct |
| Fix social media generic URLs | DONE | Well-engineered env-var approach |
| Improve meta titles/descriptions | DONE | Excellent keyword optimization |
| Add JSON-LD Organization schema | DONE | Correct |
| Add JSON-LD LocalBusiness schema | DONE | Correct, env-driven |
| Add JSON-LD BreadcrumbList schema | DONE | Correct on 4 pages |
| Add JSON-LD FAQPage schema | DONE | Correct on 2 pages |
| Add JSON-LD Course schema | DONE | Correct |
| Add JSON-LD Event schema | DONE | Correct, but client-side |
| Replace SVG OG image with PNG | DONE | Correct dimensions, low quality |
| Translate Chinese nav labels | DONE | zh-CN and zh-HK both complete |
| Add "Hong Kong" to hero subheadline | DONE | Natural integration |
| Add sitemap lastModified | DONE | Env-configurable |
| Fix testimonial "1)" artifact | NOT DONE | Simple content fix needed |
| Fix hero CTA mismatch | NOT DONE | Copy or flow change needed |
| Publish Privacy/Terms pages | NOT DONE | Content/legal work needed |
| Fix "Why Joining" grammar | NOT DONE | Simple content fix needed |
| Clean up empty content sections | NOT DONE | Housekeeping |
| Enable font preloading | NOT DONE | Performance improvement |
| Add blog/content section | NOT DONE | Major feature |
| Add cookie consent banner | NOT DONE | Compliance feature |
| Update root page metadata | NOT DONE | Should match locale page |

**Overall SEO implementation quality: 8/10** — The structural SEO work is
thorough, well-tested, and follows good engineering practices. The remaining
gaps are primarily content-level fixes and growth-oriented features.
