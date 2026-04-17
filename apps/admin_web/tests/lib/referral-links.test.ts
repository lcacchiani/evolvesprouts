import { describe, expect, it } from 'vitest';

import { buildMyBestAuntieReferralUrl, buildPublicReferralUrlWithSlug } from '@/lib/referral-links';

describe('buildMyBestAuntieReferralUrl', () => {
  it('builds locale-prefixed URLs for all locales and param styles', () => {
    expect(
      buildMyBestAuntieReferralUrl({
        baseUrl: 'https://www.example.com',
        locale: 'en',
        code: 'SAVE10',
        paramName: 'ref',
      }),
    ).toBe('https://www.example.com/en/services/my-best-auntie-training-course?ref=SAVE10');

    expect(
      buildMyBestAuntieReferralUrl({
        baseUrl: 'https://www.example.com/',
        locale: 'zh-CN',
        code: 'abc',
        paramName: 'discount',
      }),
    ).toBe('https://www.example.com/zh-CN/services/my-best-auntie-training-course?discount=ABC');

    expect(
      buildMyBestAuntieReferralUrl({
        baseUrl: 'https://www.example.com',
        locale: 'zh-HK',
        code: 'x',
        paramName: 'ref',
      }),
    ).toBe('https://www.example.com/zh-HK/services/my-best-auntie-training-course?ref=X');
  });

  it('encodes special characters in the code', () => {
    const url = buildMyBestAuntieReferralUrl({
      baseUrl: 'https://www.example.com',
      locale: 'en',
      code: 'A+B',
      paramName: 'ref',
    });
    expect(url).toContain('ref=');
    expect(url).not.toContain(' ');
  });

  it('returns empty string for unknown locale', () => {
    expect(
      buildMyBestAuntieReferralUrl({
        baseUrl: 'https://www.example.com',
        locale: 'fr',
        code: 'SAVE',
        paramName: 'ref',
      }),
    ).toBe('');
  });
});

describe('buildPublicReferralUrlWithSlug', () => {
  it('builds service path when slug is set', () => {
    expect(
      buildPublicReferralUrlWithSlug({
        baseUrl: 'https://www.example.com',
        locale: 'en',
        serviceSlug: 'my-best-auntie',
        code: 'SAVE10',
        paramName: 'ref',
      }),
    ).toBe('https://www.example.com/en/services/my-best-auntie?ref=SAVE10');
  });

  it('builds locale home when slug is null', () => {
    expect(
      buildPublicReferralUrlWithSlug({
        baseUrl: 'https://www.example.com',
        locale: 'en',
        serviceSlug: null,
        code: 'SAVE10',
        paramName: 'ref',
      }),
    ).toBe('https://www.example.com/en/?ref=SAVE10');
  });
});
