# Free Guides & Resources Page — Implementation Plan

**Status:** Awaiting approval  
**Scope:** `apps/public_www` (Next.js static-export public website)

---

## 1. Summary

Add a new standalone page at **`/free-guides-and-resources`** that gives free
material a permanent, searchable home. The page will contain five sections:

| # | Section | Component | Pattern |
|---|---------|-----------|---------|
| 1 | Hero | `FreeGuidesAndResourcesHero` | Text hero similar to `AboutUsHero` (no image initially) |
| 2 | Featured Guide | `FreeResourcesForGentleParenting` (existing) | Full existing component — split/overlay card with email capture form |
| 3 | Resource Library | `FreeGuidesAndResourcesLibrary` | Searchable tile grid modelled on `Faq` — search input, category pill filters, responsive card grid |
| 4 | Newsletter / Community | `SproutsSquadCommunity` (existing) | Reused as-is from the About Us page |
| 5 | FAQ | `FreeGuidesAndResourcesFaq` | Static Q&A card grid using existing `FaqCardGrid` shared component |

---

## 2. Decisions (confirmed)

| # | Question | Decision |
|---|----------|----------|
| 1 | Route path | `/free-guides-and-resources` |
| 2 | Navigation placement | Nested under "Our Services" in the navbar (second child alongside "Helper Training Course") |
| 3 | Featured guide presentation | Full existing `FreeResourcesForGentleParenting` component (image + checklist + email form) |
| 4 | Initial resource items | Create the data structure with just the one patience guide for now; more items added later via content JSON |
| 5 | Newsletter section | Reuse `SproutsSquadCommunity` as-is |
| 6 | Testimonials / related services | Not included in this iteration |

---

## 3. Content key structure

All new keys live under `freeGuidesAndResources` in the locale JSON files,
following the mandatory lowerCamelCase convention.

```
freeGuidesAndResources
├── hero
│   ├── eyebrow            "Free Guides & Resources"
│   ├── title              "Free Parenting Guides & Resources"
│   ├── subtitle           "Access our growing library of free tools..."
│   └── description        "Whether you're looking for..."
├── library
│   ├── eyebrow            "Resource Library"
│   ├── title              "Browse Our Free Resources"
│   ├── searchPlaceholder  "Search resources..."
│   ├── emptySearchResultsLabel  "No resources match your search."
│   ├── categories[]
│   │   ├── { id, label }  "all"  → "All Resources"
│   │   ├── { id, label }  "parenting-tips" → "Parenting Tips"
│   │   ├── { id, label }  "montessori" → "Montessori"
│   │   └── { id, label }  "helper-training" → "Helper Training"
│   └── items[]
│       └── { id, title, description, format, categoryId, ctaLabel, ctaHref }
└── faq
    ├── title              "Frequently Asked Questions"
    └── cards[]
        └── { question, answer }
```

### Content-to-component mapping

Per the `.cursorrules` content-key naming convention:

| Content key path | Component name | File name | `SectionShell` id / dataFigmaNode |
|-----------------|----------------|-----------|-----------------------------------|
| `freeGuidesAndResources.hero` | `FreeGuidesAndResourcesHero` | `free-guides-and-resources-hero.tsx` | `free-guides-and-resources-hero` |
| `freeGuidesAndResources.library` | `FreeGuidesAndResourcesLibrary` | `free-guides-and-resources-library.tsx` | `free-guides-and-resources-library` |
| `freeGuidesAndResources.faq` | `FreeGuidesAndResourcesFaq` | `free-guides-and-resources-faq.tsx` | `free-guides-and-resources-faq` |

The existing `resources` key (patience guide) and `sproutsSquadCommunity` key
remain unchanged — they are consumed by their existing components.

---

## 4. Resource library tile data model

Each item in `freeGuidesAndResources.library.items`:

```json
{
  "id": "patience-free-guide",
  "title": "4 Simple Ways to Teach Patience to Young Children",
  "description": "Gentle strategies for busy parents — practical tips you can start using today.",
  "format": "PDF Guide",
  "categoryId": "parenting-tips",
  "ctaLabel": "Get the Free Guide",
  "ctaHref": "#resources"
}
```

**Behaviour notes:**

- `ctaHref` is a same-page anchor (`#resources`) pointing to the featured guide
  section above, where the email capture form lives. For future external
  resources it could be an absolute URL.
- `categoryId` maps to a `categories[].id`. The "all" category shows every item.
- `format` is a display-only badge string (e.g., "PDF Guide", "Video",
  "Checklist"). No enum enforcement — purely cosmetic.
- The search input filters by `title` and `description` text (case-insensitive),
  matching the FAQ search pattern.
- Category pills filter by `categoryId`, same as FAQ label pills.

---

## 5. FAQ content

Initial Q&A cards for the resources FAQ:

| Question | Answer |
|----------|--------|
| Are these resources really free? | Yes — all guides and materials on this page are completely free. We believe every family deserves access to quality parenting support. |
| What format are the guides in? | Most guides are downloadable PDFs that you can read on any device. We will add video and other formats over time. |
| Can I share these with my helper? | Absolutely! Our resources are designed for both parents and helpers. Sharing them is a great way to align on gentle parenting strategies. |
| How often do you release new resources? | We add new guides and materials regularly. Sign up for our newsletter to be the first to know when something new is available. |

---

## 6. Files to create

### 6.1 Route files

**`apps/public_www/src/app/free-guides-and-resources/page.tsx`**
Root redirect (no locale prefix) → `/{defaultLocale}/free-guides-and-resources`.
Pattern: same as `src/app/about-us/page.tsx` using
`createDefaultLocaleRedirectPage`.

**`apps/public_www/src/app/[locale]/free-guides-and-resources/page.tsx`**
Locale-aware route page:
- `generateStaticParams` from `generateLocaleStaticParams`.
- `generateMetadata` — builds localized SEO metadata from
  `seo.freeGuidesAndResources` content key using `buildLocalizedMetadata`.
- Default export renders `FreeGuidesAndResourcesPage` + `StructuredDataScript`
  with breadcrumb JSON-LD.
- Pattern: follows `src/app/[locale]/contact-us/page.tsx` exactly.

### 6.2 Page composition

**`apps/public_www/src/components/pages/free-guides-and-resources.tsx`**
Composes the full page inside `PageLayout`:

```
PageLayout (navbar + footer)
  ├── FreeGuidesAndResourcesHero        content.freeGuidesAndResources.hero
  ├── FreeResourcesForGentleParenting   content.resources
  ├── FreeGuidesAndResourcesLibrary     content.freeGuidesAndResources.library
  ├── SproutsSquadCommunity             content.sproutsSquadCommunity + content.common.captcha
  └── FreeGuidesAndResourcesFaq         content.freeGuidesAndResources.faq
```

Interface: `{ content: SiteContent }`.

### 6.3 Section components

All placed in `apps/public_www/src/components/sections/`.

**`free-guides-and-resources-hero.tsx`** (server component)
- `SectionShell` → `SectionContainer` → `SectionHeader` with `titleAs='h1'`.
- Shows eyebrow, title, subtitle, and optional description paragraph.
- Content type: `SiteContent['freeGuidesAndResources']['hero']`.

**`free-guides-and-resources-library.tsx`** (client component — `'use client'`)
- `SectionShell` → `SectionContainer` → `SectionHeader` + search bar +
  category pills + tile grid.
- **Search bar:** Rounded input with lens icon, matching `Faq` search styling
  (`es-border-soft`, `es-bg-surface-neutral`, pill-shaped).
- **Category pills:** Horizontal scrollable row of `ButtonPrimitive` with
  `variant='pill'`, `state='active' | 'inactive'`. "All" pill selected by
  default.
- **Tile grid:** `ul` with `grid grid-cols-1 gap-5 md:grid-cols-2
  lg:grid-cols-3`. Each tile is a `<li>` → `<article>` with:
  - Format badge (`<span>` with `es-bg-surface-muted` rounded pill).
  - `<h3>` title.
  - `<p>` description.
  - CTA rendered as `SmartLink` or `ButtonPrimitive` with `variant='secondary'`.
- **Filtering logic:** Same approach as `Faq`: `useMemo` with
  `getVisibleItems(items, activeCategoryId, normalizedQuery)`.
- **Empty state:** Centered message in a soft-bordered box, same as FAQ empty
  state.

**`free-guides-and-resources-faq.tsx`** (server component)
- `SectionShell` → `SectionContainer` → `SectionHeader` + `FaqCardGrid`.
- Follows `ContactUsFaq` pattern exactly.
- Content type: `SiteContent['freeGuidesAndResources']['faq']`.

---

## 7. Files to modify

### 7.1 Content / locale JSON

**`apps/public_www/src/content/en.json`**

1. Add top-level `freeGuidesAndResources` key (after `freeIntroSession`,
   alphabetical not required but kept near related keys) with `hero`, `library`,
   and `faq` sub-keys as described in section 3.

2. Add `seo.freeGuidesAndResources`:
   ```json
   "freeGuidesAndResources": {
     "title": "Free Parenting Guides & Resources",
     "description": "Access free Montessori-inspired parenting guides, tips for helpers, and gentle discipline resources from Evolve Sprouts in Hong Kong."
   }
   ```

3. Add `seo.socialImages.freeGuidesAndResources`:
   ```json
   "freeGuidesAndResources": {
     "url": "/images/seo/evolvesprouts-og-default.png",
     "alt": "Free parenting guides and resources from Evolve Sprouts"
   }
   ```

4. Update `navbar.menuItems` — add "Free Guides & Resources" as a child of
   "Our Services":
   ```json
   {
     "label": "Our Services",
     "href": "/services/my-best-auntie-training-course",
     "children": [
       {
         "label": "Helper Training Course",
         "href": "/services/my-best-auntie-training-course"
       },
       {
         "label": "Free Guides & Resources",
         "href": "/free-guides-and-resources"
       }
     ]
   }
   ```

5. Update `footer.services.items` — change the "Resources" link from
   `/#resources` to `/free-guides-and-resources`:
   ```json
   {
     "label": "Free Guides & Resources",
     "href": "/free-guides-and-resources"
   }
   ```

**`apps/public_www/src/content/zh-CN.json`**
Mirror the full `freeGuidesAndResources` structure with Chinese (Simplified)
translations. Also mirror `seo.freeGuidesAndResources`,
`seo.socialImages.freeGuidesAndResources`, navbar children addition, and footer
link update.

**`apps/public_www/src/content/zh-HK.json`**
Same as zh-CN but with Traditional Chinese translations.

### 7.2 Content types

**`apps/public_www/src/content/index.ts`**

Add narrow section type exports:

```typescript
export type FreeGuidesAndResourcesHeroContent =
  SiteContent['freeGuidesAndResources']['hero'];
export type FreeGuidesAndResourcesLibraryContent =
  SiteContent['freeGuidesAndResources']['library'];
export type FreeGuidesAndResourcesFaqContent =
  SiteContent['freeGuidesAndResources']['faq'];
```

No changes to `SiteContent` definition itself — it derives from `en.json`
automatically via `typeof enContent`.

### 7.3 Routes

**`apps/public_www/src/lib/routes.ts`**

1. Add to `ROUTES`:
   ```typescript
   freeGuidesAndResources: '/free-guides-and-resources',
   ```

2. Add to `INDEXED_ROUTE_PATHS`:
   ```typescript
   ROUTES.freeGuidesAndResources,
   ```

3. Update `buildLocalizedResourcesHashPath` to point to the new page instead
   of `home#resources`:
   ```typescript
   export function buildLocalizedResourcesHashPath(locale: Locale): string {
     return `${localizePath(ROUTES.freeGuidesAndResources, locale)}#resources`;
   }
   ```
   This preserves the `#resources` anchor (pointing to the
   `FreeResourcesForGentleParenting` section's `id='resources'`) but on the
   new page instead of the homepage.

### 7.4 Resource redirect routes

**`apps/public_www/src/app/resources/page.tsx`**
No code change needed — it calls `buildLocalizedResourcesHashPath` which will
now resolve to the new page automatically.

**`apps/public_www/src/app/[locale]/resources/page.tsx`**
No code change needed — same reason as above.

---

## 8. CSS / styling

No new CSS files are required. All styling will use existing utility classes and
design tokens already present in the codebase:

- `SectionShell`, `SectionContainer`, `SectionHeader` — standard section
  wrappers.
- `es-bg-surface-muted`, `es-border-soft`, `es-bg-surface-neutral` — surface
  tokens for cards and inputs.
- `es-section-bg-overlay` — optional background overlay for visual sections.
- `ButtonPrimitive` with `variant='pill'` — category filter pills.
- `shadow-card`, `rounded-2xl` — card styling matching `FaqCardGrid`.
- `es-divider-green` — green left border on FAQ answer blocks.
- `es-ui-icon-mask es-ui-icon-mask--faq-lens` — search icon.

If the resource library tiles need a distinct visual treatment (e.g., a format
badge pill), a small Tailwind-only class composition will suffice with no
custom CSS.

---

## 9. Tests

Following the project test conventions
(`apps/public_www/tests/components/**`):

**`tests/components/sections/free-guides-and-resources-hero.test.tsx`**
- Renders with content, confirms `h1`, eyebrow, subtitle, description.
- Confirms `SectionShell` id and `dataFigmaNode`.

**`tests/components/sections/free-guides-and-resources-library.test.tsx`**
- Renders tile grid with items.
- Search filters items by title/description.
- Category pills filter by `categoryId`.
- Empty state shown when no matches.
- "All" category shows all items.

**`tests/components/sections/free-guides-and-resources-faq.test.tsx`**
- Renders Q&A cards.
- Confirms `SectionShell` id and `dataFigmaNode`.

**`tests/components/pages/free-guides-and-resources.test.tsx`**
- Renders page composition with all sections.

---

## 10. SEO / structured data

- **Sitemap:** Automatically included via `INDEXED_ROUTE_PATHS` addition.
- **Metadata:** `generateMetadata` in the route file will produce title,
  description, OG image, canonical URL, and locale alternates.
- **Breadcrumb JSON-LD:** `StructuredDataScript` with `buildBreadcrumbSchema`
  (Home → Free Guides & Resources).
- **FAQ JSON-LD (optional, recommended):** If the FAQ cards are substantial
  enough, a `buildFaqPageSchema` call can be added to the route file, following
  the About Us page pattern. This will make FAQ entries eligible for Google
  rich results.

---

## 11. Edge cases and risks

| Risk | Mitigation |
|------|------------|
| `id='resources'` anchor collision if featured guide is also added to homepage later | The anchor only appears on one page at a time. If both pages need it, the homepage version can use a different `id`. |
| Resource library starts with only one item | The grid and search still render correctly with a single tile. No minimum item count required. |
| Static export — search/filter must be client-side | The library section will be a `'use client'` component with `useState` + `useMemo`, same proven approach as the global `Faq`. |
| Locale parity | All three locale files will be updated in the same commit. Chinese translations can be placeholder initially. |
| Footer "Resources" link changes | Existing `/#resources` link becomes `/free-guides-and-resources`. The `/resources` and `/[locale]/resources` redirect routes will point to the new page via the updated `buildLocalizedResourcesHashPath`. No dead links. |
| Navbar dropdown overflow | "Our Services" already supports a `children` array with dropdown rendering. Adding a second child is within the existing UI pattern. |

---

## 12. Implementation sequence

1. **Content:** Add `freeGuidesAndResources` key to `en.json`, `zh-CN.json`,
   `zh-HK.json`. Update `seo`, `navbar.menuItems`, and `footer.services.items`.
2. **Types:** Add section type exports to `src/content/index.ts`.
3. **Routes:** Add route constant and update `INDEXED_ROUTE_PATHS` in
   `routes.ts`. Update `buildLocalizedResourcesHashPath`.
4. **Sections:** Create `free-guides-and-resources-hero.tsx`,
   `free-guides-and-resources-library.tsx`,
   `free-guides-and-resources-faq.tsx`.
5. **Page composition:** Create `src/components/pages/free-guides-and-resources.tsx`.
6. **Route files:** Create `src/app/free-guides-and-resources/page.tsx` and
   `src/app/[locale]/free-guides-and-resources/page.tsx`.
7. **Tests:** Add test files under `tests/components/`.
8. **Validate:** Run lint, build, and `scripts/validate-cursorrules.sh`.

---

## 13. Out of scope (future iterations)

- Testimonials snippet ("What Parents Say About Our Guides").
- Related services CTA banner.
- Upcoming events teaser.
- Additional resource items beyond the patience guide.
- Resource detail pages (individual resource landing pages).
- Backend API for dynamic resource management.
