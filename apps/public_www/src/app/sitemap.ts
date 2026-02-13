import type { MetadataRoute } from 'next';

import { SUPPORTED_LOCALES } from '@/content';
import { SITE_ORIGIN, localizePath } from '@/lib/seo';

export const dynamic = 'force-static';

const INDEXED_ROUTE_PATHS = [
  '/',
  '/about-us',
  '/events',
  '/contact-us',
  '/privacy',
  '/services/my-best-auntie-training-course',
  '/services/workshops',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return SUPPORTED_LOCALES.flatMap((locale) =>
    INDEXED_ROUTE_PATHS.map((routePath) => ({
      url: `${SITE_ORIGIN}${localizePath(routePath, locale)}`,
      lastModified: now,
      changeFrequency: routePath === '/' ? 'weekly' : 'monthly',
      priority: routePath === '/' ? 1 : 0.7,
    })),
  );
}
