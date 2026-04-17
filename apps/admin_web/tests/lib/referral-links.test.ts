import { describe, expect, it } from 'vitest';

import { buildMyBestAuntieReferralUrl } from '@/lib/referral-links';

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
