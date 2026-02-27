import type { Locale } from '@/content';
import { localizePath } from '@/lib/locale-routing';

export const ROUTES = {
  home: '/',
  about: '/about-us',
  contact: '/contact-us',
  events: '/events',
  privacy: '/privacy',
  servicesMyBestAuntieTrainingCourse: '/services/my-best-auntie-training-course',
  servicesWorkshops: '/services/workshops',
  terms: '/terms',
} as const;

export type AppRoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export const PLACEHOLDER_ROUTE_PATHS: readonly AppRoutePath[] = [
  ROUTES.servicesWorkshops,
];

export const INDEXED_ROUTE_PATHS: readonly AppRoutePath[] = [
  ROUTES.home,
  ROUTES.about,
  ROUTES.events,
  ROUTES.contact,
  ROUTES.privacy,
  ROUTES.terms,
  ROUTES.servicesMyBestAuntieTrainingCourse,
];

export function buildLocalizedResourcesHashPath(locale: Locale): string {
  return `${localizePath(ROUTES.home, locale)}#resources`;
}
