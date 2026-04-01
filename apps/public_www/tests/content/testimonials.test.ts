import { describe, expect, it } from 'vitest';

import enContent from '@/content/en.json';

const CANONICAL_STORY_KEYS = new Set([
  'quote',
  'author',
  'service',
  'mainImageSrc',
]);

describe('testimonials locale content', () => {
  it('uses only canonical keys on testimonial items in en.json', () => {
    const items = enContent.testimonials.items;
    expect(Array.isArray(items)).toBe(true);
    for (const item of items) {
      if (typeof item !== 'object' || item === null) {
        throw new Error('Expected testimonial item to be an object.');
      }
      const keys = Object.keys(item);
      for (const key of keys) {
        expect(
          CANONICAL_STORY_KEYS.has(key),
          `Unexpected key "${key}" on testimonial item; use canonical keys only.`,
        ).toBe(true);
      }
    }
  });
});
