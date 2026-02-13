import { describe, expect, it } from 'vitest';

import {
  buildLocaleDocumentAttributesScript,
  getDirectionForLocale,
  resolveLocaleFromPathname,
} from '@/lib/locale-document';

describe('locale-document', () => {
  it('resolves locale from localized pathnames', () => {
    expect(resolveLocaleFromPathname('/en/about-us')).toBe('en');
    expect(resolveLocaleFromPathname('/zh-CN/events')).toBe('zh-CN');
    expect(resolveLocaleFromPathname('/zh-HK/services/workshops')).toBe('zh-HK');
  });

  it('falls back to default locale for non-localized paths', () => {
    expect(resolveLocaleFromPathname('/')).toBe('en');
    expect(resolveLocaleFromPathname('/about-us')).toBe('en');
    expect(resolveLocaleFromPathname('/fr/about-us')).toBe('en');
  });

  it('provides a direction for each locale', () => {
    expect(getDirectionForLocale('en')).toBe('ltr');
    expect(getDirectionForLocale('zh-CN')).toBe('ltr');
    expect(getDirectionForLocale('zh-HK')).toBe('ltr');
  });

  it('generates a pre-hydration script with direction map', () => {
    const script = buildLocaleDocumentAttributesScript();

    expect(script).toContain('applyLocaleDocumentAttributes');
    expect(script).toContain('"en":"ltr"');
    expect(script).toContain('"zh-CN":"ltr"');
    expect(script).toContain('"zh-HK":"ltr"');
  });
});
