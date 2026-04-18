import { describe, expect, it } from 'vitest';

import {
  buildLocalizedPublicPageUrl,
  normalizePublicSitePathInput,
} from '@/lib/public-site-page-urls';

describe('normalizePublicSitePathInput', () => {
  it('normalizes home', () => {
    expect(normalizePublicSitePathInput('')).toEqual({ path: '/', error: '' });
    expect(normalizePublicSitePathInput('   ')).toEqual({ path: '/', error: '' });
    expect(normalizePublicSitePathInput('/')).toEqual({ path: '/', error: '' });
  });

  it('normalizes paths with trailing slash and lowercases segments', () => {
    expect(normalizePublicSitePathInput('/about-us')).toEqual({ path: '/about-us/', error: '' });
    expect(normalizePublicSitePathInput('about-us/')).toEqual({ path: '/about-us/', error: '' });
  });

  it('rejects query strings and hashes', () => {
    expect(normalizePublicSitePathInput('/x?utm=1').error).toMatch(/query/i);
    expect(normalizePublicSitePathInput('/x#y').error).toMatch(/fragment/i);
  });

  it('rejects absolute URLs', () => {
    expect(normalizePublicSitePathInput('https://evil.com/x').error).toBeTruthy();
    expect(normalizePublicSitePathInput('//evil.com/x').error).toBeTruthy();
  });

  it('rejects path traversal', () => {
    expect(normalizePublicSitePathInput('/../x').error).toBeTruthy();
  });

  it('rejects uppercase segments', () => {
    expect(normalizePublicSitePathInput('/About-Us').error).toBeTruthy();
  });
});

describe('buildLocalizedPublicPageUrl', () => {
  it('builds locale home and inner paths with trailing slash', () => {
    expect(
      buildLocalizedPublicPageUrl({
        baseUrl: 'https://www.example.com',
        locale: 'en',
        path: '/',
      }),
    ).toBe('https://www.example.com/en/');

    expect(
      buildLocalizedPublicPageUrl({
        baseUrl: 'https://www.example.com',
        locale: 'zh-CN',
        path: '/about-us/',
      }),
    ).toBe('https://www.example.com/zh-CN/about-us/');
  });

  it('returns empty for invalid base or locale', () => {
    expect(
      buildLocalizedPublicPageUrl({
        baseUrl: '',
        locale: 'en',
        path: '/',
      }),
    ).toBe('');
    expect(
      buildLocalizedPublicPageUrl({
        baseUrl: 'https://www.example.com',
        locale: 'xx',
        path: '/',
      }),
    ).toBe('');
  });
});
