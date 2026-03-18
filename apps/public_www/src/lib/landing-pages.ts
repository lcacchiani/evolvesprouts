import type {
  LandingPageContent,
  LandingPageLocaleContent,
  Locale,
} from '@/content';
import easter2026MontessoriPlayCoachingWorkshop from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';
import { ROUTES } from '@/lib/routes';

const LANDING_PAGES = {
  'easter-2026-montessori-play-coaching-workshop': easter2026MontessoriPlayCoachingWorkshop,
} satisfies Record<string, LandingPageContent>;

export type LandingPageSlug = keyof typeof LANDING_PAGES;

const LANDING_PAGE_SLUGS = Object.freeze(
  Object.keys(LANDING_PAGES) as LandingPageSlug[],
);

function assertNoLandingPageRouteCollisions(): void {
  const appRoutePathSet = new Set(Object.values(ROUTES));

  for (const slug of LANDING_PAGE_SLUGS) {
    const landingPagePath = buildLandingPagePath(slug);
    if (appRoutePathSet.has(landingPagePath)) {
      throw new Error(
        `Landing page slug "${slug}" collides with an existing app route.`,
      );
    }
  }
}

assertNoLandingPageRouteCollisions();

export function getAllLandingPageSlugs(): LandingPageSlug[] {
  return [...LANDING_PAGE_SLUGS];
}

export function isValidLandingPageSlug(slug: string): slug is LandingPageSlug {
  return slug in LANDING_PAGES;
}

export function buildLandingPagePath(slug: LandingPageSlug | string): string {
  return `/${slug}`;
}

export function getLandingPageContent(
  slug: string,
  locale: Locale,
): LandingPageLocaleContent | null {
  if (!isValidLandingPageSlug(slug)) {
    return null;
  }

  return LANDING_PAGES[slug][locale];
}
