import { describe, expect, it } from 'vitest';

import {
  getLocaleFromPath,
  localizeHref,
  localizePath,
  normalizeLocalizedPath,
} from '@/lib/locale-routing';

describe('locale-routing', () => {
  it('normalizes localized paths into locale-agnostic paths', () => {
    expect(normalizeLocalizedPath('/en/about-us/')).toBe('/about-us');
    expect(normalizeLocalizedPath('/zh-CN/services/workshops')).toBe(
      '/services/workshops',
    );
    expect(normalizeLocalizedPath('/zh-HK')).toBe('/');
  });

  it('resolves locale from pathname and falls back to default', () => {
    expect(getLocaleFromPath('/zh-CN/events')).toBe('zh-CN');
    expect(getLocaleFromPath('/zh-HK/about-us')).toBe('zh-HK');
    expect(getLocaleFromPath('/about-us')).toBe('en');
  });

  it('localizes normalized paths', () => {
    expect(localizePath('/about-us', 'zh-CN')).toBe('/zh-CN/about-us');
    expect(localizePath('/zh-HK/events', 'en')).toBe('/en/events');
    expect(localizePath('/', 'zh-HK')).toBe('/zh-HK');
  });

  it('localizes internal href and preserves hash/query fragments', () => {
    expect(localizeHref('/resources#guide', 'zh-CN')).toBe(
      '/zh-CN/resources#guide',
    );
    expect(localizeHref('/events?type=upcoming', 'zh-HK')).toBe(
      '/zh-HK/events?type=upcoming',
    );
  });

  it('does not localize external href values', () => {
    expect(localizeHref('https://example.com/path', 'en')).toBe(
      'https://example.com/path',
    );
    expect(localizeHref('mailto:test@example.com', 'en')).toBe(
      'mailto:test@example.com',
    );
  });

  it('preserves unsafe href values for downstream link sanitization', () => {
    expect(localizeHref('javascript:alert(1)', 'en')).toBe(
      'javascript:alert(1)',
    );
  });
});
