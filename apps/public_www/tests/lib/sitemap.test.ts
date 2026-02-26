import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '@/content';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import {
  INDEXED_ROUTE_PATHS,
  PLACEHOLDER_ROUTE_PATHS,
} from '@/lib/routes';
import { SITE_ORIGIN, localizePath } from '@/lib/seo';

describe('sitemap', () => {
  it('includes all indexed localized routes', () => {
    const entries = sitemap();
    const urls = new Set(entries.map((entry) => entry.url));

    for (const locale of SUPPORTED_LOCALES) {
      for (const routePath of INDEXED_ROUTE_PATHS) {
        expect(urls).toContain(`${SITE_ORIGIN}${localizePath(routePath, locale)}`);
      }
    }
  });

  it('excludes placeholder localized routes', () => {
    const entries = sitemap();
    const urls = new Set(entries.map((entry) => entry.url));

    for (const locale of SUPPORTED_LOCALES) {
      for (const routePath of PLACEHOLDER_ROUTE_PATHS) {
        expect(urls).not.toContain(`${SITE_ORIGIN}${localizePath(routePath, locale)}`);
      }
    }
  });

  it('keeps robots host aligned with SITE_ORIGIN', () => {
    const robotsMetadata = robots();

    expect(robotsMetadata.host).toBe(new URL(SITE_ORIGIN).hostname);
    expect(robotsMetadata.sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
  });
});
