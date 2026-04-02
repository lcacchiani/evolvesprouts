import type { Locale } from '@/content';
import { localizePath } from '@/lib/locale-routing';

export const ROUTES = {
  home: '/',
  about: '/about-us',
  freeGuidesAndResources: '/services/free-guides-and-resources',
  contact: '/contact-us',
  events: '/events',
  mediaDownload: '/media/download',
  privacy: '/privacy',
  servicesConsultations: '/services/consultations',
  servicesMyBestAuntieTrainingCourse: '/services/my-best-auntie-training-course',
  servicesWorkshops: '/services/workshops',
  terms: '/terms',
  links: '/links',
} as const;

export type AppRoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export const PLACEHOLDER_ROUTE_PATHS: readonly AppRoutePath[] = [
  ROUTES.servicesWorkshops,
];

export const UNLISTED_ROUTE_PATHS: readonly AppRoutePath[] = [
  ROUTES.links,
  ROUTES.mediaDownload,
];

export const INDEXED_ROUTE_PATHS: readonly AppRoutePath[] = [
  ROUTES.home,
  ROUTES.about,
  ROUTES.events,
  ROUTES.contact,
  ROUTES.privacy,
  ROUTES.terms,
  ROUTES.servicesConsultations,
  ROUTES.servicesMyBestAuntieTrainingCourse,
  ROUTES.freeGuidesAndResources,
];

export function buildLocalizedResourcesHashPath(locale: Locale): string {
  return `${localizePath(ROUTES.freeGuidesAndResources, locale)}#resources`;
}

/**
 * First path segments reserved by static app routes (canonical `ROUTES` plus
 * filesystem-only roots). Landing page slugs must not collide with these or
 * Next.js may serve the wrong page for `/[locale]/[slug]`.
 */
export const RESERVED_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  ...new Set(
    Object.values(ROUTES)
      .map((path) => path.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '')
      .filter((segment) => segment.length > 0),
  ),
  'resources',
  'book',
  'free-guides-and-resources',
]);
