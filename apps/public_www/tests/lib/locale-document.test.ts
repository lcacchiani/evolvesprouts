import { describe, expect, it } from 'vitest';

import {
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
});
