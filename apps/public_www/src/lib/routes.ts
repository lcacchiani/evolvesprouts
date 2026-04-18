import type { Locale } from '@/content';
import { PUBLIC_WWW_ROUTES } from '@shared-public-www/public-www-routes';
import { localizePath } from '@/lib/locale-routing';

export const ROUTES = PUBLIC_WWW_ROUTES;

export type AppRoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export const PLACEHOLDER_ROUTE_PATHS: readonly AppRoutePath[] = [
  ROUTES.servicesIndex,
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
  ROUTES.book,
  ROUTES.resources,
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
  'free-guides-and-resources',
]);
