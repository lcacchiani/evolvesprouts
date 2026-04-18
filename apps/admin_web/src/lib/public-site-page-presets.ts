import { PUBLIC_WWW_ROUTES } from '@shared-public-www/public-www-routes';

/**
 * Curated public-site paths for QR presets (same paths as `PUBLIC_WWW_ROUTES` in
 * `apps/public_www/src/lib/public-www-routes.ts`, re-exported from `apps/public_www/src/lib/routes.ts`).
 */
export interface PublicSitePagePreset {
  label: string;
  /** Raw path input accepted by `normalizePublicSitePathInput` (with or without trailing slash). */
  pathInput: string;
}

const PRESET_ROWS: readonly { label: string; routeKey: keyof typeof PUBLIC_WWW_ROUTES }[] = [
  { label: 'Home', routeKey: 'home' },
  { label: 'About us', routeKey: 'about' },
  { label: 'Contact us', routeKey: 'contact' },
  { label: 'Events', routeKey: 'events' },
  { label: 'Book', routeKey: 'book' },
  { label: 'Resources', routeKey: 'resources' },
  { label: 'Services index', routeKey: 'servicesIndex' },
  { label: 'Consultations', routeKey: 'servicesConsultations' },
  { label: 'Workshops', routeKey: 'servicesWorkshops' },
  { label: 'My Best Auntie training course', routeKey: 'servicesMyBestAuntieTrainingCourse' },
  { label: 'Free guides and resources', routeKey: 'freeGuidesAndResources' },
  { label: 'Privacy', routeKey: 'privacy' },
  { label: 'Terms', routeKey: 'terms' },
  { label: 'Links', routeKey: 'links' },
  { label: 'Media download', routeKey: 'mediaDownload' },
] as const;

export const PUBLIC_SITE_PAGE_PRESETS: readonly PublicSitePagePreset[] = PRESET_ROWS.map(
  ({ label, routeKey }) => ({
    label,
    pathInput: PUBLIC_WWW_ROUTES[routeKey],
  }),
);
