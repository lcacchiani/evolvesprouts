import { describe, expect, it } from 'vitest';

import {
  isHrefActive,
  isMenuItemActive,
} from '@/components/sections/navbar/navbar-utils';

describe('navbar-utils', () => {
  describe('isHrefActive', () => {
    it('treats hash placeholders as inactive', () => {
      expect(isHrefActive('/en/about-us', '#')).toBe(false);
    });

    it('matches root paths exactly', () => {
      expect(isHrefActive('/', '/')).toBe(true);
      expect(isHrefActive('/en', '/')).toBe(false);
    });

    it('matches exact and nested localized paths', () => {
      expect(isHrefActive('/about-us', '/about-us')).toBe(true);
      expect(isHrefActive('/about-us/team', '/about-us')).toBe(true);
      expect(isHrefActive('/events', '/about-us')).toBe(false);
    });
  });

  describe('isMenuItemActive', () => {
    it('returns true when top-level href is active', () => {
      expect(
        isMenuItemActive('/about-us', {
          href: '/about-us',
          children: [],
        }),
      ).toBe(true);
    });

    it('returns true when one child href is active', () => {
      expect(
        isMenuItemActive('/services/my-best-auntie-training-course', {
          href: '/services',
          children: [
            { href: '/services/workshops' },
            { href: '/services/my-best-auntie-training-course' },
          ],
        }),
      ).toBe(true);
    });

    it('returns false when neither parent nor children are active', () => {
      expect(
        isMenuItemActive('/contact-us', {
          href: '/about-us',
          children: [{ href: '/services/workshops' }],
        }),
      ).toBe(false);
    });
  });
});
