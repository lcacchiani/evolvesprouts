import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '@/content';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import {
  buildLandingPagePath,
  getAllLandingPageSlugs,
} from '@/lib/landing-pages';
import {
  INDEXED_ROUTE_PATHS,
  PLACEHOLDER_ROUTE_PATHS,
} from '@/lib/routes';
import { getSiteOrigin, localizePath } from '@/lib/seo';

describe('sitemap', () => {
  it('includes all indexed localized routes', () => {
    const siteOrigin = getSiteOrigin();
    const entries = sitemap();
    const urls = new Set(entries.map((entry) => entry.url));

    for (const locale of SUPPORTED_LOCALES) {
      for (const routePath of INDEXED_ROUTE_PATHS) {
        expect(urls).toContain(`${siteOrigin}${localizePath(routePath, locale)}`);
      }
    }
  });

  it('adds lastModified for every sitemap entry', () => {
    const entries = sitemap();

    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });

  it('includes localized landing page entries', () => {
    const siteOrigin = getSiteOrigin();
    const entries = sitemap();
    const urls = new Set(entries.map((entry) => entry.url));

    for (const locale of SUPPORTED_LOCALES) {
      for (const slug of getAllLandingPageSlugs()) {
        expect(urls).toContain(
          `${siteOrigin}${localizePath(buildLandingPagePath(slug), locale)}`,
        );
      }
    }
  });

  it('excludes placeholder localized routes', () => {
    const siteOrigin = getSiteOrigin();
    const entries = sitemap();
    const urls = new Set(entries.map((entry) => entry.url));

    for (const locale of SUPPORTED_LOCALES) {
      for (const routePath of PLACEHOLDER_ROUTE_PATHS) {
        expect(urls).not.toContain(`${siteOrigin}${localizePath(routePath, locale)}`);
      }
    }
  });

  it('keeps robots host aligned with SITE_ORIGIN', () => {
    const siteOrigin = getSiteOrigin();
    const robotsMetadata = robots();

    expect(robotsMetadata.host).toBe(new URL(siteOrigin).hostname);
    expect(robotsMetadata.sitemap).toBe(`${siteOrigin}/sitemap.xml`);
  });

  it('does not block localized and redirect aliases in robots.txt', () => {
    const robotsMetadata = robots();
    const crawlerRules = robotsMetadata.rules ?? [];
    const defaultCrawlerRule = crawlerRules.find((rule) => rule.userAgent === '*');

    expect(defaultCrawlerRule).toMatchObject({
      userAgent: '*',
      allow: '/',
    });
    expect(defaultCrawlerRule).not.toHaveProperty('disallow');
  });
});
