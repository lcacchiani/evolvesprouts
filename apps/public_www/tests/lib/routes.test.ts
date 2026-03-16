import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '@/content';
import { localizePath } from '@/lib/locale-routing';
import {
  buildLocalizedResourcesHashPath,
  INDEXED_ROUTE_PATHS,
  PLACEHOLDER_ROUTE_PATHS,
  ROUTES,
  UNLISTED_ROUTE_PATHS,
} from '@/lib/routes';

describe('routes', () => {
  it('keeps canonical route values unique', () => {
    const routeValues = Object.values(ROUTES);
    expect(new Set(routeValues).size).toBe(routeValues.length);
  });

  it('classifies each canonical route as indexed, placeholder, or unlisted with no overlap', () => {
    const indexedSet = new Set(INDEXED_ROUTE_PATHS);
    const placeholderSet = new Set(PLACEHOLDER_ROUTE_PATHS);
    const unlistedSet = new Set(UNLISTED_ROUTE_PATHS);
    const classifiedSet = new Set([...indexedSet, ...placeholderSet, ...unlistedSet]);
    const routeValues = Object.values(ROUTES);

    for (const route of routeValues) {
      expect(classifiedSet).toContain(route);
      const inIndexed = indexedSet.has(route) ? 1 : 0;
      const inPlaceholder = placeholderSet.has(route) ? 1 : 0;
      const inUnlisted = unlistedSet.has(route) ? 1 : 0;
      expect(inIndexed + inPlaceholder + inUnlisted).toBe(1);
    }
  });

  it('builds locale-aware resources hash paths', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(buildLocalizedResourcesHashPath(locale)).toBe(
        `${localizePath(ROUTES.home, locale)}#resources`,
      );
    }
  });
});
