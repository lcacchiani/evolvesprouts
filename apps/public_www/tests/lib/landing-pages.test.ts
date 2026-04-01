import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '@/content';
import {
  buildLandingPagePath,
  getAllLandingPageSlugs,
  getLandingPageContent,
  isValidLandingPageSlug,
} from '@/lib/landing-pages';
import { RESERVED_PATH_SEGMENTS, ROUTES } from '@/lib/routes';

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

  it('does not collide with reserved path segments (routes + filesystem roots)', () => {
    for (const slug of getAllLandingPageSlugs()) {
      expect(RESERVED_PATH_SEGMENTS.has(slug)).toBe(false);
    }
  });

  it('registers every landing slug in RESERVED_PATH_SEGMENTS coverage of ROUTES first segments', () => {
    for (const routePath of Object.values(ROUTES)) {
      const segment = routePath.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
      if (segment) {
        expect(RESERVED_PATH_SEGMENTS.has(segment)).toBe(true);
      }
    }
  });

  it('every landing page slug has a root app redirect page using the shared factory', () => {
    const appDir = path.resolve(__dirname, '../../src/app');
    for (const slug of getAllLandingPageSlugs()) {
      const pageFile = path.join(appDir, slug, 'page.tsx');
      expect(existsSync(pageFile)).toBe(true);
      const source = readFileSync(pageFile, 'utf8');
      expect(source).toContain('createLandingPageRootRedirect');
    }
  });

  it('every root page that uses createLandingPageRootRedirect matches a registered slug', () => {
    const appDir = path.resolve(__dirname, '../../src/app');
    const registered = new Set(getAllLandingPageSlugs());
    const entries = readdirSync(appDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('[') || entry.name.startsWith('(')) {
        continue;
      }
      const pageFile = path.join(appDir, entry.name, 'page.tsx');
      if (!existsSync(pageFile)) {
        continue;
      }
      const source = readFileSync(pageFile, 'utf8');
      if (source.includes('createLandingPageRootRedirect')) {
        expect(registered.has(entry.name)).toBe(true);
      }
    }
  });

  it('every static root app segment with page.tsx is reserved or a registered landing slug', () => {
    const appDir = path.resolve(__dirname, '../../src/app');
    const landingSlugSet = new Set(getAllLandingPageSlugs());
    const entries = readdirSync(appDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('[') || entry.name.startsWith('(')) {
        continue;
      }
      const pageFile = path.join(appDir, entry.name, 'page.tsx');
      if (!existsSync(pageFile)) {
        continue;
      }
      const covered =
        RESERVED_PATH_SEGMENTS.has(entry.name) || landingSlugSet.has(entry.name);
      expect(
        covered,
        `Add "${entry.name}" to RESERVED_PATH_SEGMENTS in routes.ts or register it as a landing page slug.`,
      ).toBe(true);
    }
  });
});
