import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '@/content';
import {
  buildLandingPagePath,
  getAllLandingPageSlugs,
  getLandingPageContent,
  isValidLandingPageSlug,
} from '@/lib/landing-pages';
import { ROUTES } from '@/lib/routes';

describe('landing-pages registry', () => {
  it('returns at least one registered slug', () => {
    const slugs = getAllLandingPageSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs.every((slug) => typeof slug === 'string' && slug.length > 0)).toBe(
      true,
    );
  });

  it('validates registered and unknown slugs', () => {
    const [firstSlug] = getAllLandingPageSlugs();
    if (!firstSlug) {
      throw new Error('Expected at least one landing page slug.');
    }

    expect(isValidLandingPageSlug(firstSlug)).toBe(true);
    expect(isValidLandingPageSlug('not-a-real-landing-page')).toBe(false);
  });

  it('resolves locale content for valid slugs and null for unknown slugs', () => {
    const [firstSlug] = getAllLandingPageSlugs();
    if (!firstSlug) {
      throw new Error('Expected at least one landing page slug.');
    }

    for (const locale of SUPPORTED_LOCALES) {
      const content = getLandingPageContent(firstSlug, locale);
      expect(content).not.toBeNull();
      expect(content?.meta.title).toBeTruthy();
    }

    expect(getLandingPageContent('unknown-slug', 'en')).toBeNull();
  });

  it('builds slash-prefixed landing page paths', () => {
    const [firstSlug] = getAllLandingPageSlugs();
    if (!firstSlug) {
      throw new Error('Expected at least one landing page slug.');
    }

    expect(buildLandingPagePath(firstSlug)).toBe(`/${firstSlug}`);
  });

  it('does not collide with existing canonical app routes', () => {
    const routeValues = new Set(Object.values(ROUTES));

    for (const slug of getAllLandingPageSlugs()) {
      expect(routeValues.has(buildLandingPagePath(slug))).toBe(false);
    }
  });
});
