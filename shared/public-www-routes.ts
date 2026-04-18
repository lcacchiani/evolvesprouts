/**
 * Canonical first-party path strings for the static public website (`apps/public_www`).
 * Single source of truth for `apps/public_www/src/lib/routes.ts` and admin QR presets.
 */
export const PUBLIC_WWW_ROUTES = {
  home: '/',
  about: '/about-us',
  freeGuidesAndResources: '/services/free-guides-and-resources',
  contact: '/contact-us',
  events: '/events',
  mediaDownload: '/media/download',
  privacy: '/privacy',
  servicesIndex: '/services',
  servicesConsultations: '/services/consultations',
  servicesMyBestAuntieTrainingCourse: '/services/my-best-auntie-training-course',
  servicesWorkshops: '/services/workshops',
  terms: '/terms',
  links: '/links',
  book: '/book',
  resources: '/resources',
} as const;

export type PublicWwwAppRoutePath = (typeof PUBLIC_WWW_ROUTES)[keyof typeof PUBLIC_WWW_ROUTES];
