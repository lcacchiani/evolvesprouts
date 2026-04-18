/**
 * Curated public-site paths for QR presets (aligned with `apps/public_www/src/lib/routes.ts`).
 * Values are normalized paths (`/` or `/about-us/` style) for `normalizePublicSitePathInput`.
 */
export interface PublicSitePagePreset {
  label: string;
  /** Raw path input accepted by `normalizePublicSitePathInput` (with or without trailing slash). */
  pathInput: string;
}

export const PUBLIC_SITE_PAGE_PRESETS: readonly PublicSitePagePreset[] = [
  { label: 'Home', pathInput: '/' },
  { label: 'About us', pathInput: '/about-us' },
  { label: 'Contact us', pathInput: '/contact-us' },
  { label: 'Events', pathInput: '/events' },
  { label: 'Book', pathInput: '/book' },
  { label: 'Resources', pathInput: '/resources' },
  { label: 'Services index', pathInput: '/services' },
  { label: 'Consultations', pathInput: '/services/consultations' },
  { label: 'Workshops', pathInput: '/services/workshops' },
  { label: 'My Best Auntie training course', pathInput: '/services/my-best-auntie-training-course' },
  { label: 'Free guides and resources', pathInput: '/services/free-guides-and-resources' },
  { label: 'Privacy', pathInput: '/privacy' },
  { label: 'Terms', pathInput: '/terms' },
  { label: 'Links', pathInput: '/links' },
  { label: 'Media download', pathInput: '/media/download' },
] as const;
