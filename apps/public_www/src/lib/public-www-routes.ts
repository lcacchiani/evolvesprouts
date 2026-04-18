/**
 * Canonical first-party path strings for the static public website.
 * Single source of truth for `routes.ts` here and admin Website QR presets (`apps/admin_web`).
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
