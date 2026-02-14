import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildDiscountsApiUrl,
  fetchDiscountRules,
  normalizeDiscountsPayload,
  normalizeStaticDiscountRules,
} from '@/lib/discounts-data';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('discounts-data', () => {
  it('builds the discounts endpoint from CRM API base URL', () => {
    expect(buildDiscountsApiUrl('https://api.evolvesprouts.com/www')).toBe(
      'https://api.evolvesprouts.com/www/v1/discounts',
    );
    expect(buildDiscountsApiUrl('https://api.evolvesprouts.com/www/')).toBe(
      'https://api.evolvesprouts.com/www/v1/discounts',
    );
    expect(buildDiscountsApiUrl('api.evolvesprouts.com/www/')).toBe('');
    expect(buildDiscountsApiUrl('   ')).toBe('');
  });

  it('normalizes API payload data to discount rules', () => {
    const payload = {
      status: 'success',
      data: [
        {
          code: 'SIBLINGS',
          name: 'Siblings',
          amount: 10,
          is_percentage: true,
          currency_code: null,
          currency_symbol: null,
        },
        {
          code: 'WIDYA100',
          name: 'Referral fixed amount',
          amount: 100,
          is_percentage: false,
          currency_code: 'HKD',
          currency_symbol: 'HK$',
        },
      ],
    };

    expect(normalizeDiscountsPayload(payload)).toEqual([
      {
        code: 'SIBLINGS',
        name: 'Siblings',
        type: 'percent',
        value: 10,
        currencyCode: null,
        currencySymbol: null,
      },
      {
        code: 'WIDYA100',
        name: 'Referral fixed amount',
        type: 'amount',
        value: 100,
        currencyCode: 'HKD',
        currencySymbol: 'HK$',
      },
    ]);
  });

  it('normalizes static discount content and drops invalid entries', () => {
    const staticRules = [
      { code: ' SPROUTS10 ', type: 'percent', value: 10 },
      { code: '', type: 'amount', value: 1000 },
    ] as const;

    expect(normalizeStaticDiscountRules(staticRules)).toEqual([
      {
        code: 'SPROUTS10',
        type: 'percent',
        value: 10,
      },
    ]);
  });

  it('fetches discounts with x-api-key and returns normalized rules', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              code: 'FEIER10',
              name: 'Referral 10% - Feier',
              amount: 10,
              is_percentage: true,
              currency_code: null,
              currency_symbol: null,
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchSpy);

    const rules = await fetchDiscountRules(
      'https://api.evolvesprouts.com/www/v1/discounts',
      'secret-api-key',
      new AbortController().signal,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.evolvesprouts.com/www/v1/discounts',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'x-api-key': 'secret-api-key',
        }),
      }),
    );
    expect(rules).toEqual([
      {
        code: 'FEIER10',
        name: 'Referral 10% - Feier',
        type: 'percent',
        value: 10,
        currencyCode: null,
        currencySymbol: null,
      },
    ]);
  });

  it('throws when the API key is missing', async () => {
    await expect(
      fetchDiscountRules(
        'https://api.evolvesprouts.com/www/v1/discounts',
        '   ',
        new AbortController().signal,
      ),
    ).rejects.toThrow('Discounts API key is missing');
  });
});
