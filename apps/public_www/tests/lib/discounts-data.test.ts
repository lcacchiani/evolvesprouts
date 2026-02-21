import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCrmApiClient } from '@/lib/crm-api-client';
import {
  buildDiscountValidationApiUrl,
  normalizeDiscountValidationPayload,
  validateDiscountCode,
} from '@/lib/discounts-data';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('discounts-data', () => {
  it('builds the discount validation endpoint from CRM API base URL', () => {
    expect(buildDiscountValidationApiUrl('https://api.evolvesprouts.com/www')).toBe(
      'https://api.evolvesprouts.com/www/v1/discounts/validate',
    );
    expect(buildDiscountValidationApiUrl('https://api.evolvesprouts.com/www/')).toBe(
      'https://api.evolvesprouts.com/www/v1/discounts/validate',
    );
    expect(buildDiscountValidationApiUrl('api.evolvesprouts.com/www/')).toBe('');
    expect(buildDiscountValidationApiUrl('   ')).toBe('');
  });

  it('normalizes validation payload data to a discount rule', () => {
    const payload = {
      data: {
        code: 'SIBLINGS',
        name: 'Siblings',
        amount: 10,
        is_percentage: true,
        currency_code: null,
        currency_symbol: null,
      },
    };

    expect(normalizeDiscountValidationPayload(payload, 'SIBLINGS')).toEqual({
      code: 'SIBLINGS',
      name: 'Siblings',
      type: 'percent',
      value: 10,
      currencyCode: null,
      currencySymbol: null,
    });
  });

  it('returns null for invalid discount validation payloads', () => {
    expect(
      normalizeDiscountValidationPayload(
        {
          valid: false,
        },
        'SPRING10',
      ),
    ).toBeNull();
    expect(normalizeDiscountValidationPayload({}, 'SPRING10')).toBeNull();
  });

  it('validates discounts with x-api-key and returns a normalized rule', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            code: 'FEIER10',
            name: 'Referral 10% - Feier',
            amount: 10,
            is_percentage: true,
            currency_code: null,
            currency_symbol: null,
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchSpy);
    const crmApiClient = createCrmApiClient({
      baseUrl: 'https://api.evolvesprouts.com/www',
      apiKey: 'secret-api-key',
    });
    if (!crmApiClient) {
      throw new Error('Expected CRM API client configuration to be valid');
    }

    const rule = await validateDiscountCode(
      crmApiClient,
      ' FEIER10 ',
      new AbortController().signal,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.evolvesprouts.com/www/v1/discounts/validate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          code: 'FEIER10',
        }),
        headers: expect.objectContaining({
          Accept: 'application/json',
          'x-api-key': 'secret-api-key',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(rule).toEqual({
      code: 'FEIER10',
      name: 'Referral 10% - Feier',
      type: 'percent',
      value: 10,
      currencyCode: null,
      currencySymbol: null,
    });
  });

  it('rejects invalid CRM API client configuration', () => {
    expect(
      createCrmApiClient({
        baseUrl: 'https://api.evolvesprouts.com/www',
        apiKey: '   ',
      }),
    ).toBeNull();
  });
});
