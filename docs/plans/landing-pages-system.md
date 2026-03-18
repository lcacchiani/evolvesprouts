# Landing Pages System — Implementation Plan

> **Status**: Approved for execution
> **Branch**: `cursor/landing-page-organization-8408`
> **First page**: `easter-2026-montessori-play-coaching-workshop`
> **Scope**: `apps/public_www` only

---

## Table of contents

1. [Overview](#1-overview)
2. [URL and routing design](#2-url-and-routing-design)
3. [Source code organization](#3-source-code-organization)
4. [Step-by-step implementation order](#4-step-by-step-implementation-order)
5. [File specifications](#5-file-specifications)
6. [Content JSON specification](#6-content-json-specification)
7. [Section component specifications](#7-section-component-specifications)
8. [Booking modal integration](#8-booking-modal-integration)
9. [SEO and structured data](#9-seo-and-structured-data)
10. [Analytics](#10-analytics)
11. [Tests](#11-tests)
12. [Validation and build integration](#12-validation-and-build-integration)
13. [Developer workflow for future landing pages](#13-developer-workflow-for-future-landing-pages)
14. [Constraints and .cursorrules compliance](#14-constraints-and-cursorrules-compliance)
15. [Risks and mitigations](#15-risks-and-mitigations)

---

## 1. Overview

Build a reusable, content-driven landing page system for `apps/public_www`.
Landing pages live at **level-1 URLs** (e.g. `/{locale}/easter-2026-montessori-play-coaching-workshop/`)
but their **source code** is organized in `landing-pages/` subfolders for maintainability.

Each landing page is defined by:
- A per-page content JSON file (all three locales in one file).
- A single entry in a central registry module.
- A thin root-level redirect file.

The dynamic `[slug]` route, shared section components, and composition component
are created **once** and reused by all landing pages.

### Page sections (in order)

1. `LandingPageHero` — hero banner with title, subtitle, date/location callout, image
2. `LandingPageDetails` — workshop details (what it covers, bullet points)
3. `DeferredTestimonials` — **reused as-is** from existing codebase
4. `LandingPageFaq` — FAQ accordion
5. `LandingPageCta` — call-to-action that opens the **existing booking modal**

---

## 2. URL and routing design

### Public URLs

```
/{locale}/easter-2026-montessori-play-coaching-workshop/
```

All three locales are generated: `en`, `zh-CN`, `zh-HK`.

### Root-level redirect

```
/easter-2026-montessori-play-coaching-workshop  →  /en/easter-2026-montessori-play-coaching-workshop/
```

Implemented as a static page file using `createDefaultLocaleRedirectPage()`.

### Next.js App Router route

A **dynamic `[slug]` segment** under `[locale]`:

```
src/app/[locale]/[slug]/page.tsx
```

- Existing static routes (`about-us/`, `contact-us/`, etc.) take precedence over `[slug]` in Next.js App Router.
- `generateStaticParams()` returns the cross-product of all locales × all registered landing page slugs.
- This is compatible with `output: 'export'` (static generation).

---

## 3. Source code organization

All new landing-page code lives in `landing-pages/` subfolders within existing
directories. No new top-level directories are created.

```
apps/public_www/
├── public/images/landing-pages/
│   └── easter-2026/                                          # Per-page images
│       ├── hero.webp
│       ├── hero-mobile.webp
│       └── og.png
├── src/
│   ├── app/
│   │   ├── easter-2026-montessori-play-coaching-workshop/
│   │   │   └── page.tsx                                      # Root redirect
│   │   └── [locale]/
│   │       └── [slug]/
│   │           └── page.tsx                                  # Dynamic landing page route
│   ├── components/
│   │   ├── pages/
│   │   │   └── landing-pages/
│   │   │       └── landing-page.tsx                          # Page composition component
│   │   └── sections/
│   │       └── landing-pages/
│   │           ├── landing-page-hero.tsx
│   │           ├── landing-page-details.tsx
│   │           ├── landing-page-faq.tsx
│   │           └── landing-page-cta.tsx                      # Client component (modal state)
│   ├── content/
│   │   └── landing-pages/
│   │       └── easter-2026-montessori-play-coaching-workshop.json
│   └── lib/
│       └── landing-pages.ts                                  # Registry + helpers
└── tests/
    ├── components/
    │   ├── pages/
    │   │   └── landing-pages/
    │   │       └── landing-page.test.tsx
    │   └── sections/
    │       └── landing-pages/
    │           ├── landing-page-hero.test.tsx
    │           ├── landing-page-details.test.tsx
    │           ├── landing-page-faq.test.tsx
    │           └── landing-page-cta.test.tsx
    └── lib/
        └── landing-pages.test.ts
```

### Existing files modified

| File | Change |
|------|--------|
| `src/lib/routes.ts` | Add `LANDING_PAGE_SLUGS` validation helper |
| `src/content/en.json` | Add `landingPages` top-level key (shared labels) |
| `src/content/zh-CN.json` | Mirror `landingPages` key |
| `src/content/zh-HK.json` | Mirror `landingPages` key |
| `src/content/index.ts` | Export `LandingPageContent` type and `LandingPagesCommonContent` type |
| `src/app/sitemap.ts` | Include landing page slugs in sitemap generation |
| `src/lib/structured-data.ts` | Add `buildLandingPageEventSchema()` builder |
| `src/lib/analytics-taxonomy.json` | Add `landing_page_cta_click` event |
| `tests/components/sections/section-structure-contract.test.tsx` | Add landing page section files to `pageSectionFiles` |

---

## 4. Step-by-step implementation order

Execute in this order to minimize broken intermediate states.

### Phase 1: Content and types

1. **Create `src/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json`**
   - Full per-page content for all three locales (see section 6).

2. **Add shared labels to `src/content/en.json`**
   - Add `landingPages` top-level key with common UI labels.
   - Mirror in `zh-CN.json` and `zh-HK.json`.

3. **Update `src/content/index.ts`**
   - Add `LandingPagesCommonContent` type derived from `SiteContent['landingPages']`.
   - Add `LandingPageContent` type definition for per-page content shape.

### Phase 2: Registry and lib

4. **Create `src/lib/landing-pages.ts`**
   - Landing page registry mapping slugs to content imports.
   - `getAllLandingPageSlugs()`, `getLandingPageContent(slug, locale)`.
   - `buildLandingPagePath(slug)` helper.
   - Validation: assert no slug collides with values in `ROUTES`.

5. **Update `src/lib/routes.ts`**
   - No changes to the `ROUTES` object itself.
   - Optionally add a type for landing page slug strings.

6. **Update `src/lib/structured-data.ts`**
   - Add `buildLandingPageEventSchema()` that produces `Event` JSON-LD.

7. **Update `src/lib/analytics-taxonomy.json`**
   - Add `landing_page_cta_click` event entry.

### Phase 3: Section components

8. **Create `src/components/sections/landing-pages/landing-page-hero.tsx`**
   - See section 7.1.

9. **Create `src/components/sections/landing-pages/landing-page-details.tsx`**
   - See section 7.2.

10. **Create `src/components/sections/landing-pages/landing-page-faq.tsx`**
    - See section 7.3.

11. **Create `src/components/sections/landing-pages/landing-page-cta.tsx`**
    - See section 7.4. This is a `'use client'` component.

### Phase 4: Page composition

12. **Create `src/components/pages/landing-pages/landing-page.tsx`**
    - Assembles all sections in order (see section 7.5).

### Phase 5: Routes

13. **Create `src/app/[locale]/[slug]/page.tsx`**
    - Dynamic route with `generateStaticParams`, `generateMetadata`, default export.
    - See section 5.1.

14. **Create `src/app/easter-2026-montessori-play-coaching-workshop/page.tsx`**
    - Root redirect. See section 5.2.

### Phase 6: Sitemap and SEO

15. **Update `src/app/sitemap.ts`**
    - Import `getAllLandingPageSlugs` from the registry.
    - Append landing page URLs to the sitemap alongside `INDEXED_ROUTE_PATHS`.

### Phase 7: Test updates

16. **Update `tests/components/sections/section-structure-contract.test.tsx`**
    - Add the four new section files to the `pageSectionFiles` array.

17. **Create test files** (see section 11).

### Phase 8: Validation

18. **Run validation checks**:
    ```bash
    cd apps/public_www
    npm run validate:content
    npm run lint
    npm test
    npm run build
    bash ../../scripts/validate-cursorrules.sh
    ```

---

## 5. File specifications

### 5.1. `src/app/[locale]/[slug]/page.tsx`

```typescript
import { notFound } from 'next/navigation';

import { SUPPORTED_LOCALES, type Locale } from '@/content';
import { LandingPage } from '@/components/pages/landing-pages/landing-page';
import { StructuredDataScript } from '@/components/shared/structured-data-script';
import {
  type LocaleRouteProps,
  resolveLocalePageContext,
  getMenuLabel,
} from '@/lib/locale-page';
import {
  getAllLandingPageSlugs,
  getLandingPageContent,
  isValidLandingPageSlug,
  buildLandingPagePath,
} from '@/lib/landing-pages';
import { buildLocalizedMetadata } from '@/lib/seo';
import { buildBreadcrumbSchema } from '@/lib/structured-data';
import { buildLandingPageEventSchema } from '@/lib/structured-data';
import { ROUTES } from '@/lib/routes';

interface LandingPageRouteProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    getAllLandingPageSlugs().map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: LandingPageRouteProps) {
  const { locale, slug } = await params;
  // resolveLocalePageContext validates the locale; reuse its pattern
  // but we also need to validate the slug
  if (!isValidLandingPageSlug(slug)) {
    notFound();
  }

  const pageContent = getLandingPageContent(slug, locale as Locale);
  if (!pageContent) {
    notFound();
  }

  return buildLocalizedMetadata({
    locale: locale as Locale,
    path: buildLandingPagePath(slug),
    title: pageContent.meta.title,
    description: pageContent.meta.description,
    socialImage: {
      url: pageContent.meta.socialImage.url,
      alt: pageContent.meta.socialImage.alt,
    },
  });
}

export default async function LandingPageRoute({ params }: LandingPageRouteProps) {
  const resolvedParams = await params;
  const { locale, content: siteContent } = await resolveLocalePageContext(
    Promise.resolve({ locale: resolvedParams.locale }),
  );

  if (!isValidLandingPageSlug(resolvedParams.slug)) {
    notFound();
  }

  const pageContent = getLandingPageContent(resolvedParams.slug, locale);
  if (!pageContent) {
    notFound();
  }

  const pagePath = buildLandingPagePath(resolvedParams.slug);

  return (
    <>
      <LandingPage
        locale={locale}
        siteContent={siteContent}
        pageContent={pageContent}
      />
      <StructuredDataScript
        id={`landing-page-breadcrumb-jsonld-${locale}`}
        data={buildBreadcrumbSchema({
          locale,
          items: [
            {
              name: getMenuLabel(siteContent, ROUTES.home),
              path: ROUTES.home,
            },
            {
              name: pageContent.meta.title,
              path: pagePath as any, // landing page path, not in ROUTES
            },
          ],
        })}
      />
      {pageContent.structuredData ? (
        <StructuredDataScript
          id={`landing-page-event-jsonld-${locale}`}
          data={buildLandingPageEventSchema({
            locale,
            pageContent,
            pagePath,
          })}
        />
      ) : null}
    </>
  );
}
```

**Important implementation notes:**
- The `buildBreadcrumbSchema` function currently types `path` as `AppRoutePath`.
  The landing page path is not in `ROUTES`. Two options:
  (a) Widen the `BreadcrumbItem.path` type to `string`.
  (b) Cast with `as any` (less ideal).
  **Prefer option (a)**: update the `BreadcrumbItem` interface in
  `src/lib/structured-data.ts` to accept `string` instead of `AppRoutePath`.
- The `buildLocalizedMetadata` function also types `path` as `string`, so no issue there.
- `resolveLocalePageContext` validates the locale and returns `notFound()` if invalid.
  The `[slug]` validation is handled separately via `isValidLandingPageSlug`.

### 5.2. `src/app/easter-2026-montessori-play-coaching-workshop/page.tsx`

```typescript
import { createDefaultLocaleRedirectPage } from '@/lib/locale-page';

export default createDefaultLocaleRedirectPage(
  '/easter-2026-montessori-play-coaching-workshop',
);
```

This is the only file that must be created per-landing-page (beyond the content JSON and registry entry).

---

## 6. Content JSON specification

### 6.1. Per-page content: `src/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json`

The file contains all three locales. The executing agent should populate actual
content for the Easter workshop. Use placeholder copy if real copy is not
available — the owner can refine later.

```jsonc
{
  "en": {
    "meta": {
      "title": "Easter 2026 Montessori Play Coaching Workshop",
      "description": "A hands-on Easter workshop for parents and children...",
      "socialImage": {
        "url": "/images/landing-pages/easter-2026/og.png",
        "alt": "Easter 2026 Montessori Play Coaching Workshop by Evolve Sprouts"
      }
    },
    "hero": {
      "title": "Easter 2026 Montessori Play Coaching Workshop",
      "subtitle": "A hands-on experience for parents and little ones",
      "description": "Join us this Easter for a guided Montessori play coaching session...",
      "imageAlt": "Children engaged in Montessori play activities",
      "imageSrc": "/images/landing-pages/easter-2026/hero.webp",
      "imageMobileSrc": "/images/landing-pages/easter-2026/hero-mobile.webp",
      "dateLabel": "April 5-6, 2026",
      "locationLabel": "Sheung Wan, Hong Kong"
    },
    "details": {
      "eyebrow": "Workshop Details",
      "title": "What You'll Experience",
      "description": "Our workshop is designed to...",
      "items": [
        {
          "title": "Guided Montessori Play",
          "description": "Hands-on activities tailored to your child's developmental stage."
        },
        {
          "title": "Parent Coaching",
          "description": "Learn practical techniques you can use at home."
        },
        {
          "title": "Age-Appropriate Activities",
          "description": "Sessions designed for different age groups."
        }
      ]
    },
    "faq": {
      "eyebrow": "FAQ",
      "title": "Frequently Asked Questions",
      "items": [
        {
          "question": "What ages is this workshop suitable for?",
          "answer": "This workshop is designed for children aged 0-6 and their parents/caregivers."
        },
        {
          "question": "What should I bring?",
          "answer": "Just bring yourselves! All materials are provided."
        }
      ]
    },
    "cta": {
      "eyebrow": "Reserve Your Spot",
      "title": "Ready to Join Us This Easter?",
      "description": "Spaces are limited. Book your spot today.",
      "buttonLabel": "Book Now"
    },
    "booking": {
      "ageOptions": [
        {
          "id": "0-3",
          "label": "0-3",
          "iconSrc": "/images/landing-pages/easter-2026/age-0-3.svg"
        },
        {
          "id": "3-6",
          "label": "3-6",
          "iconSrc": "/images/landing-pages/easter-2026/age-3-6.svg"
        }
      ],
      "cohorts": [
        {
          "id": "easter-2026-0-3-session-1",
          "age_group": "0-3",
          "title": "Easter Workshop 0-3 — Session 1",
          "description": "...",
          "cohort": "04-26",
          "spaces_total": 10,
          "spaces_left": 10,
          "is_fully_booked": false,
          "price": 800,
          "currency": "HKD",
          "location": "physical",
          "booking_system": "landing-page-easter-2026",
          "tags": ["Easter", "0-3"],
          "categories": ["Workshop"],
          "address": "Unit 507, 5/F, Arion Commercial Centre, 2-12 Queen's Road West, Sheung Wan",
          "address_url": "https://www.google.com/maps/dir/?api=1&destination=Arion+Commercial+Centre",
          "dates": [
            {
              "id": "session-1",
              "start_datetime": "2026-04-05T01:00:00Z",
              "end_datetime": "2026-04-05T03:00:00Z"
            }
          ]
        }
      ],
      "modal": {
        "title": "Easter Montessori Play Coaching Workshop",
        "subtitle": "Booking Details",
        "partSummaries": ["Session 1"]
      },
      "spacesLeftLabelTemplate": "{count} spots left",
      "soldOutStampLabel": "Sold Out",
      "confirmAndPayLabel": "Confirm & Pay",
      "ageSelectorLabel": "Select age group",
      "dateSelectorLabel": "Select session",
      "scheduleLabel": "Next session",
      "nextCohortLabelTemplate": "{scheduleLabel} ({ageGroupLabel})",
      "noCohortsLabel": "No sessions available",
      "scrollDatesLeftAriaLabel": "Scroll sessions left",
      "scrollDatesRightAriaLabel": "Scroll sessions right"
    },
    "structuredData": {
      "eventName": "Easter 2026 Montessori Play Coaching Workshop",
      "description": "A hands-on Easter workshop...",
      "startDate": "2026-04-05T09:00:00+08:00",
      "endDate": "2026-04-06T17:00:00+08:00",
      "locationName": "Arion Commercial Centre",
      "locationAddress": "Unit 507, 5/F, Arion Commercial Centre, 2-12 Queen's Road West, Sheung Wan",
      "offerPrice": "800",
      "offerCurrency": "HKD",
      "offerAvailability": "InStock"
    }
  },
  "zh-CN": {
    "...": "Mirror of en with Chinese Simplified translations (can start as copy of en)"
  },
  "zh-HK": {
    "...": "Mirror of en with Chinese Traditional translations (can start as copy of en)"
  }
}
```

**Cohort data shape**: The `booking.cohorts` array entries must conform to the
same shape as entries in `src/content/my-best-auntie-training-courses.json`:

```typescript
interface LandingPageCohort {
  id: string;
  age_group: string;
  title: string;
  description: string;
  cohort: string;           // MM-YY format for the existing formatter, or free text
  spaces_total: number;
  spaces_left: number;
  is_fully_booked: boolean;
  price: number;
  currency: string;
  location: string;
  booking_system: string;
  tags: string[];
  categories: string[];
  address: string;
  address_url: string;
  dates: Array<{
    id: string;
    start_datetime: string;  // ISO 8601
    end_datetime: string;    // ISO 8601
  }>;
}
```

### 6.2. Shared labels in locale JSONs

Add to `src/content/en.json` (and mirror in `zh-CN.json`, `zh-HK.json`):

```jsonc
{
  // ... existing keys ...
  "landingPages": {
    "common": {
      "backToHomeLabel": "Back to Home",
      "defaultCtaLabel": "Book Now",
      "a11y": {
        "heroSectionLabel": "Event overview",
        "detailsSectionLabel": "Event details",
        "ctaSectionLabel": "Booking",
        "faqSectionLabel": "Frequently asked questions"
      }
    }
  }
}
```

**Position**: Add `landingPages` as the last top-level key in each locale JSON,
before the closing `}`. This minimizes diff noise.

---

## 7. Section component specifications

All section components follow the existing codebase patterns:
- Import and use `SectionShell`, `SectionContainer`, `SectionHeader` from
  `@/components/sections/shared/`.
- `SectionShell` must have `id` and `dataFigmaNode` in kebab-case matching the
  file name (per `.cursorrules`).
- No inline `style={...}` or `CSSProperties`.
- Use Tailwind classes, mobile-first.
- No `dangerouslySetInnerHTML`.

### 7.1. `landing-page-hero.tsx`

```
SectionShell id='landing-page-hero' dataFigmaNode='landing-page-hero'
  SectionContainer
    SectionHeader (title, subtitle from content)
    <p> description
    <div> date + location callout badges
    <Image> hero image (responsive: mobile + desktop sources)
```

**Props interface:**

```typescript
interface LandingPageHeroProps {
  content: {
    title: string;
    subtitle: string;
    description: string;
    imageAlt: string;
    imageSrc: string;
    imageMobileSrc?: string;
    dateLabel: string;
    locationLabel: string;
  };
}
```

**Server component** (no `'use client'`).

### 7.2. `landing-page-details.tsx`

```
SectionShell id='landing-page-details' dataFigmaNode='landing-page-details'
  SectionContainer
    SectionHeader (eyebrow, title)
    <p> description
    <ul/grid> items (title + description cards)
```

**Props interface:**

```typescript
interface LandingPageDetailsProps {
  content: {
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{ title: string; description: string }>;
  };
}
```

**Server component**.

### 7.3. `landing-page-faq.tsx`

```
SectionShell id='landing-page-faq' dataFigmaNode='landing-page-faq'
  SectionContainer
    SectionHeader (eyebrow, title)
    <dl or accordion> question/answer pairs
```

**Props interface:**

```typescript
interface LandingPageFaqProps {
  content: {
    eyebrow: string;
    title: string;
    items: Array<{ question: string; answer: string }>;
  };
}
```

**Server component** (unless an interactive accordion is desired — then `'use client'`).
For simplicity, start with a static list of Q&A pairs. An accordion can be added later.

### 7.4. `landing-page-cta.tsx`

This is a **`'use client'`** component because it manages booking modal open/close state.

```
SectionShell id='landing-page-cta' dataFigmaNode='landing-page-cta'
  SectionContainer
    SectionHeader (eyebrow, title)
    <p> description
    <ButtonPrimitive variant='primary'> → opens booking modal

{isPaymentModalOpen && <MyBestAuntieBookingModal ... />}
{isThankYouModalOpen && <MyBestAuntieThankYouModal ... />}
```

**Props interface:**

```typescript
import type {
  BookingModalContent,
  Locale,
  MyBestAuntieModalContent,
} from '@/content';

interface LandingPageCtaBookingContent {
  ageOptions: Array<{ id: string; label: string; iconSrc: string }>;
  cohorts: LandingPageCohort[];  // Same shape as my-best-auntie cohorts
  modal: {
    title: string;
    subtitle: string;
    partSummaries: string[];
  };
  spacesLeftLabelTemplate: string;
  soldOutStampLabel: string;
  confirmAndPayLabel: string;
  ageSelectorLabel: string;
  dateSelectorLabel: string;
  scheduleLabel: string;
  nextCohortLabelTemplate: string;
  noCohortsLabel: string;
  scrollDatesLeftAriaLabel: string;
  scrollDatesRightAriaLabel: string;
}

interface LandingPageCtaProps {
  locale: Locale;
  content: {
    eyebrow: string;
    title: string;
    description: string;
    buttonLabel: string;
  };
  bookingContent: LandingPageCtaBookingContent;
  bookingModalContent: BookingModalContent;
}
```

**Implementation approach:**

The CTA section needs to:
1. Display the CTA copy (eyebrow, title, description, button).
2. On button click, open the `MyBestAuntieBookingModal` with the first
   available cohort pre-selected.
3. Handle the thank-you modal flow.

The simplest approach: dynamically import `MyBestAuntieBookingModal` and
`MyBestAuntieThankYouModal` (same pattern as `my-best-auntie-booking.tsx`):

```typescript
const MyBestAuntieBookingModal = dynamic(
  () =>
    import('@/components/sections/my-best-auntie/my-best-auntie-booking-modal').then(
      (module) => module.MyBestAuntieBookingModal,
    ),
  { ssr: false },
);

const MyBestAuntieThankYouModal = dynamic(
  () =>
    import('@/components/sections/my-best-auntie/my-best-auntie-booking-modal').then(
      (module) => module.MyBestAuntieThankYouModal,
    ),
  { ssr: false },
);
```

The CTA maintains state: `isPaymentModalOpen`, `isThankYouModalOpen`,
`reservationSummary`. It selects the first non-fully-booked cohort as the
default selected cohort.

Fire `landing_page_cta_click` analytics event on button click, then
`booking_modal_open` when the modal opens.

### 7.5. `landing-page.tsx` (page composition)

```typescript
import type { Locale, SiteContent } from '@/content';
import type { LandingPageLocaleContent } from '@/lib/landing-pages';
import { PageLayout } from '@/components/shared/page-layout';
import { LandingPageHero } from '@/components/sections/landing-pages/landing-page-hero';
import { LandingPageDetails } from '@/components/sections/landing-pages/landing-page-details';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import { LandingPageFaq } from '@/components/sections/landing-pages/landing-page-faq';
import { LandingPageCta } from '@/components/sections/landing-pages/landing-page-cta';

interface LandingPageProps {
  locale: Locale;
  siteContent: SiteContent;
  pageContent: LandingPageLocaleContent;
}

export function LandingPage({ locale, siteContent, pageContent }: LandingPageProps) {
  return (
    <PageLayout
      navbarContent={siteContent.navbar}
      footerContent={siteContent.footer}
    >
      <LandingPageHero content={pageContent.hero} />
      <LandingPageDetails content={pageContent.details} />
      <DeferredTestimonials
        content={siteContent.testimonials}
        commonAccessibility={siteContent.common.accessibility}
      />
      <LandingPageFaq content={pageContent.faq} />
      <LandingPageCta
        locale={locale}
        content={pageContent.cta}
        bookingContent={pageContent.booking}
        bookingModalContent={siteContent.bookingModal}
      />
    </PageLayout>
  );
}
```

---

## 8. Booking modal integration

The existing `MyBestAuntieBookingModal` (at
`src/components/sections/my-best-auntie/my-best-auntie-booking-modal.tsx`)
accepts these props:

```typescript
interface MyBestAuntieBookingModalProps {
  locale?: Locale;
  modalContent: MyBestAuntieModalContent;      // { title, subtitle, partSummaries }
  paymentModalContent: BookingPaymentModalContent;
  selectedCohort: CohortType | null;
  selectedCohortDateLabel?: string;
  selectedAgeGroupLabel?: string;
  onClose: () => void;
  onSubmitReservation: (summary: ReservationSummary) => void;
}
```

The `LandingPageCta` component maps its `bookingContent.modal` to
`modalContent`, uses `siteContent.bookingModal.paymentModal` for
`paymentModalContent`, and passes the first available cohort as
`selectedCohort`.

**Key constraint**: The cohort data in the landing page content JSON must match
the shape expected by the modal. The shape is defined in
`src/content/my-best-auntie-training-courses.json` (see section 6.1).

If the landing page workshop has **only one session and one age group**, the
`ageOptions` array has one entry and `cohorts` has one entry. The CTA button
label says "Book Now" and directly opens the modal — no age/date selection UI
in the CTA section itself. The age/date selection UI lives only in
`my-best-auntie-booking.tsx` and is NOT reused in the CTA section.

---

## 9. SEO and structured data

### Metadata (`generateMetadata`)

Each landing page produces full metadata via `buildLocalizedMetadata`:
- `title`: from `pageContent.meta.title` (appended with `" - Evolve Sprouts"`)
- `description`: from `pageContent.meta.description`
- `socialImage`: from `pageContent.meta.socialImage`
- `alternates.canonical`: localized path
- `alternates.languages`: all three locales + `x-default`
- `robots`: `{ index: true, follow: true }` (default)

### Sitemap

In `src/app/sitemap.ts`, append landing page URLs:

```typescript
import { getAllLandingPageSlugs, buildLandingPagePath } from '@/lib/landing-pages';

// Inside the sitemap() function, after the existing INDEXED_ROUTE_PATHS map:
const landingPageEntries = SUPPORTED_LOCALES.flatMap((locale) =>
  getAllLandingPageSlugs().map((slug) => ({
    url: `${siteOrigin}${localizePath(buildLandingPagePath(slug), locale)}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
    lastModified,
    alternates: buildSitemapAlternates(buildLandingPagePath(slug), siteOrigin),
  })),
);

return [...existingEntries, ...landingPageEntries];
```

**Note**: `buildSitemapAlternates` is a local function in `sitemap.ts`. It
accepts a string path. Landing page paths (`/easter-2026-...`) are plain
strings, so this works without type changes.

### Event structured data

Add to `src/lib/structured-data.ts`:

```typescript
interface LandingPageEventSchemaOptions {
  locale: Locale;
  pageContent: LandingPageLocaleContent;
  pagePath: string;
}

export function buildLandingPageEventSchema({
  locale,
  pageContent,
  pagePath,
}: LandingPageEventSchemaOptions): JsonLdObject {
  const organizationSchemaId = getOrganizationSchemaId();
  const sd = pageContent.structuredData;

  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'Event',
    name: sd.eventName,
    description: sd.description,
    startDate: sd.startDate,
    endDate: sd.endDate,
    eventStatus: EVENT_STATUS_SCHEDULED,
    eventAttendanceMode: EVENT_ATTENDANCE_MODE_OFFLINE,
    location: compactJsonLdObject({
      '@type': 'Place',
      name: sd.locationName,
      address: sd.locationAddress,
    }),
    organizer: {
      '@id': organizationSchemaId,
    },
    offers: compactJsonLdObject({
      '@type': 'Offer',
      price: sd.offerPrice,
      priceCurrency: sd.offerCurrency,
      availability: `${SCHEMA_CONTEXT}/${sd.offerAvailability}`,
      url: `${getSiteOrigin()}${localizePath(pagePath, locale)}`,
    }),
  });
}
```

**Note**: This requires making `getOrganizationSchemaId`, `EVENT_STATUS_SCHEDULED`,
`EVENT_ATTENDANCE_MODE_OFFLINE`, `SCHEMA_CONTEXT`, `compactJsonLdObject`, and
`getSiteOrigin` accessible. They are already module-level in `structured-data.ts`
so the new function can access them directly.

---

## 10. Analytics

### New event in `analytics-taxonomy.json`

Add to the `events` object:

```json
"landing_page_cta_click": {
  "requiredCustomParams": ["landing_page_slug"],
  "allowedCustomParams": ["landing_page_slug", "age_group", "cohort_label"],
  "ga4KeyEvent": false
}
```

### Usage in `LandingPageCta`

```typescript
trackAnalyticsEvent('landing_page_cta_click', {
  sectionId: 'landing-page-cta',
  ctaLocation: 'landing_page',
  params: {
    landing_page_slug: slug,
  },
});
```

The existing `booking_modal_open`, `booking_confirm_pay_click`,
`booking_submit_success`, etc. events are automatically fired by the
`MyBestAuntieBookingModal` and `BookingReservationForm` components.

---

## 11. Tests

### 11.1. `tests/components/sections/section-structure-contract.test.tsx`

Add to the `pageSectionFiles` array:

```typescript
'landing-pages/landing-page-hero.tsx',
'landing-pages/landing-page-details.tsx',
'landing-pages/landing-page-faq.tsx',
'landing-pages/landing-page-cta.tsx',
```

### 11.2. `tests/lib/landing-pages.test.ts`

Test:
- `getAllLandingPageSlugs()` returns a non-empty array of strings.
- `isValidLandingPageSlug()` returns true for registered slugs, false for others.
- `getLandingPageContent()` returns content for valid slug + locale, null for invalid.
- `buildLandingPagePath()` returns `/{slug}` format.
- No slug collides with existing `ROUTES` values.

### 11.3. `tests/components/pages/landing-pages/landing-page.test.tsx`

Test:
- Renders `PageLayout` with navbar and footer.
- Renders all five section components (`LandingPageHero`, `LandingPageDetails`,
  `DeferredTestimonials`, `LandingPageFaq`, `LandingPageCta`).

### 11.4. Section component tests

Each section test file should verify:
- `SectionShell` is rendered with correct `id` and `dataFigmaNode`.
- Content props are rendered (title, description, etc.).
- For `LandingPageCta`: button click opens the modal (mock the dynamic import).

Follow existing test patterns (vitest + @testing-library/react).
Test files go in `tests/` (not under `src/`), per `.cursorrules`.

---

## 12. Validation and build integration

### Content validation (`validate-content.mjs`)

The existing `validate-content.mjs` script validates **only** the three main
locale JSON files (`en.json`, `zh-CN.json`, `zh-HK.json`). It does **not**
scan `src/content/landing-pages/`.

**Decision**: Do NOT modify `validate-content.mjs` in this phase. The per-page
content JSONs are validated at the TypeScript level (imported by the registry
module with a typed interface). A dedicated landing page content validator can
be added later if the number of landing pages grows.

However, adding the `landingPages` key to `en.json`/`zh-CN.json`/`zh-HK.json`
**will** be validated by the existing script (shape alignment, href validation,
etc.), so those additions must pass.

### Analytics validation

The `validate-analytics-contract.mjs` script scans all `.ts`/`.tsx` files for
`trackAnalyticsEvent` calls and validates them against
`analytics-taxonomy.json`. Adding `landing_page_cta_click` to the taxonomy and
using it correctly in the CTA component will satisfy this check.

The `validate-analytics-governance.mjs` script may have additional checks.
Ensure the new event entry conforms to the governance rules.

### Build

After all changes, the full build pipeline must pass:

```bash
cd apps/public_www
npm run validate:content    # Locale JSON shape + semantic checks
npm run lint                # ESLint + analytics contract + governance
npm test                    # Vitest
npm run build               # next build + CSP inject + CSP validate
```

### .cursorrules validation

```bash
bash scripts/validate-cursorrules.sh
```

---

## 13. Developer workflow for future landing pages

To add a new landing page after this system is built:

1. **Create content JSON**: Copy an existing file in
   `src/content/landing-pages/` and edit the content for all three locales.

2. **Register the slug**: Add a one-line entry to the registry in
   `src/lib/landing-pages.ts`:
   ```typescript
   import newPageContent from '@/content/landing-pages/new-page-slug.json';
   // Add to LANDING_PAGES map:
   'new-page-slug': newPageContent,
   ```

3. **Create root redirect**: Create
   `src/app/new-page-slug/page.tsx`:
   ```typescript
   import { createDefaultLocaleRedirectPage } from '@/lib/locale-page';
   export default createDefaultLocaleRedirectPage('/new-page-slug');
   ```

4. **Add images** to `public/images/landing-pages/new-page-slug/`.

5. **Deploy**.

No new components, no new route files under `[locale]`, no changes to locale JSONs.

---

## 14. Constraints and .cursorrules compliance

| Rule | How this plan complies |
|------|----------------------|
| No inline `style={...}` | All styling via Tailwind classes |
| No `dangerouslySetInnerHTML` | Not used |
| No hardcoded secrets/URLs | All URLs from content JSON or env vars |
| SectionShell id = dataFigmaNode = file name (kebab-case) | `landing-page-hero`, `landing-page-details`, `landing-page-faq`, `landing-page-cta` |
| Content keys use lowerCamelCase | `landingPages.common.backToHomeLabel`, etc. |
| Locale JSONs aligned (en = zh-CN = zh-HK shape) | `landingPages` key added to all three |
| Tests in `tests/` not `src/` | All test files under `apps/public_www/tests/` |
| No test files under `src/` | Confirmed |
| User-visible copy from locale content | Section aria-labels from `landingPages.common.a11y.*` |
| Pre-commit ruff-format | No Python changes in this task |
| `validate-cursorrules.sh` must pass | Run as final validation |

---

## 15. Risks and mitigations

### Risk 1: `[slug]` route conflicts with existing static routes

**Impact**: Low. Next.js App Router resolves static routes before dynamic ones.
`about-us/page.tsx` always wins over `[slug]/page.tsx` for `/about-us`.

**Mitigation**: The registry's `isValidLandingPageSlug` function validates that
no registered slug matches an existing route path in `ROUTES`.

### Risk 2: Booking modal data shape mismatch

**Impact**: Medium. The modal expects cohort data in a specific shape.

**Mitigation**: The `LandingPageCohort` type is defined to exactly match the
existing cohort shape. TypeScript compilation catches mismatches.

### Risk 3: `validate-content.mjs` internal href validation

**Impact**: Medium. The script validates that internal hrefs in locale JSONs
point to existing routes under `[locale]/`. If any landing page content
key in the main locale JSONs contains an href pointing to the landing page
URL, the script will flag it as unknown (because `[slug]/page.tsx` is dynamic,
not a static folder name).

**Mitigation**: The `landingPages` key in locale JSONs contains only UI labels,
not hrefs. Per-page content (which may contain hrefs) lives in separate JSON
files that are not scanned by `validate-content.mjs`. If a future landing page
needs to be linked from the main locale JSONs (e.g., navbar or footer), the
validation script would need updating.

### Risk 4: `buildBreadcrumbSchema` type constraint

**Impact**: Low. The `BreadcrumbItem.path` is typed as `AppRoutePath`.

**Mitigation**: Widen the type to `string` in `structured-data.ts`. This is a
backward-compatible change since `AppRoutePath` is a subset of `string`.

### Risk 5: Build time growth

**Impact**: Low. Each landing page adds 3 static HTML files (one per locale)
plus 3 redirect files. Negligible for dozens of pages.

### Risk 6: Image placeholders

**Impact**: Low. The first landing page may not have final images at
implementation time.

**Mitigation**: Use placeholder paths in the content JSON. The page will render
with broken images but build correctly. Images can be added before deployment.
