import type { MetadataRoute } from 'next';

import { SUPPORTED_LOCALES } from '@/content';
import { SITE_ORIGIN, localizePath } from '@/lib/seo';
import { INDEXED_ROUTE_PATHS, ROUTES } from '@/lib/routes';

export const dynamic = 'force-static';

function resolveSitemapLastModifiedDate(): Date {
  const configuredLastModified = process.env.NEXT_PUBLIC_SITEMAP_LASTMOD?.trim();
  if (configuredLastModified) {
    const parsedDate = new Date(configuredLastModified);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return new Date();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = resolveSitemapLastModifiedDate();

  return SUPPORTED_LOCALES.flatMap((locale) =>
    INDEXED_ROUTE_PATHS.map((routePath) => ({
      url: `${SITE_ORIGIN}${localizePath(routePath, locale)}`,
      changeFrequency: routePath === ROUTES.home ? 'weekly' : 'monthly',
      priority: routePath === ROUTES.home ? 1 : 0.7,
      lastModified,
    })),
  );
}
