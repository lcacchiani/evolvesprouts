import { describe, expect, it } from 'vitest';

import bookAFreeCall from '@/content/landing-pages/book-a-free-call.json';

describe('book-a-free-call landing page locale JSON', () => {
  it('keeps introCall keys aligned across locales', () => {
    const keysEn = Object.keys(bookAFreeCall.en.introCall).sort();
    expect(Object.keys(bookAFreeCall['zh-CN'].introCall).sort()).toEqual(keysEn);
    expect(Object.keys(bookAFreeCall['zh-HK'].introCall).sort()).toEqual(keysEn);
  });

  it('includes anchor CTA label for CTA section', () => {
    expect(bookAFreeCall.en.cta.ctaAnchorLabel).toBeTruthy();
    expect(bookAFreeCall.en.cta.ctaAnchorHref).toBe('#intro-call-booking');
  });
});
