import type { MetadataRoute } from 'next';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/content';
import { getSiteOrigin, localizePath } from '@/lib/seo';
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

function buildSitemapAlternates(
  routePath: string,
  siteOrigin: string,
): MetadataRoute.Sitemap[number]['alternates'] {
  return {
    languages: Object.fromEntries([
      ...SUPPORTED_LOCALES.map((supportedLocale) => [
        supportedLocale,
        `${siteOrigin}${localizePath(routePath, supportedLocale)}`,
      ]),
      ['x-default', `${siteOrigin}${localizePath(routePath, DEFAULT_LOCALE)}`],
    ]),
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteOrigin = getSiteOrigin();
  const lastModified = resolveSitemapLastModifiedDate();

  return SUPPORTED_LOCALES.flatMap((locale) =>
    INDEXED_ROUTE_PATHS.map((routePath) => ({
      url: `${siteOrigin}${localizePath(routePath, locale)}`,
      changeFrequency: routePath === ROUTES.home ? 'weekly' : 'monthly',
      priority: routePath === ROUTES.home ? 1 : 0.7,
      lastModified,
      alternates: buildSitemapAlternates(routePath, siteOrigin),
    })),
  );
}
