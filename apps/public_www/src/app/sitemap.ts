import type { MetadataRoute } from 'next';

import { SUPPORTED_LOCALES } from '@/content';
import { SITE_ORIGIN, localizePath } from '@/lib/seo';
import { INDEXED_ROUTE_PATHS, ROUTES } from '@/lib/routes';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    INDEXED_ROUTE_PATHS.map((routePath) => ({
      url: `${SITE_ORIGIN}${localizePath(routePath, locale)}`,
      changeFrequency: routePath === ROUTES.home ? 'weekly' : 'monthly',
      priority: routePath === ROUTES.home ? 1 : 0.7,
    })),
  );
}
