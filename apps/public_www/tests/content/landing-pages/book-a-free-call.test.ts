import { describe, expect, it } from 'vitest';

import bookAFreeCall from '@/content/landing-pages/book-a-free-call.json';

describe('book-a-free-call landing page locale JSON', () => {
  it('keeps introCall keys aligned across locales', () => {
    const keysEn = Object.keys(bookAFreeCall.en.introCall).sort();
    expect(Object.keys(bookAFreeCall['zh-CN'].introCall).sort()).toEqual(keysEn);
    expect(Object.keys(bookAFreeCall['zh-HK'].introCall).sort()).toEqual(keysEn);
  });

  it('includes anchor CTA href and label for hero and CTA section in every locale', () => {
    for (const loc of ['en', 'zh-CN', 'zh-HK'] as const) {
      const block = bookAFreeCall[loc];
      expect(block.hero.ctaAnchorHref).toBe('#intro-call-booking');
      expect(block.hero.ctaAnchorLabel?.trim()).toBeTruthy();
      expect(block.cta.ctaAnchorHref).toBe('#intro-call-booking');
      expect(block.cta.ctaAnchorLabel?.trim()).toBeTruthy();
    }
  });

  it('includes loadErrorMessage for intro-call picker in every locale', () => {
    for (const loc of ['en', 'zh-CN', 'zh-HK'] as const) {
      expect(bookAFreeCall[loc].introCall.loadErrorMessage?.trim()).toBeTruthy();
    }
  });
});
