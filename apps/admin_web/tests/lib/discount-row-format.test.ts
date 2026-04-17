import { describe, expect, it } from 'vitest';

import { formatDiscountRowValue } from '@/lib/discount-row-format';

describe('formatDiscountRowValue', () => {
  it('returns Referral for referral type', () => {
    expect(
      formatDiscountRowValue({
        discountType: 'referral',
        discountValue: '0',
        currency: 'HKD',
      }),
    ).toBe('Referral');
  });

  it('returns percentage suffix', () => {
    expect(
      formatDiscountRowValue({
        discountType: 'percentage',
        discountValue: '15',
        currency: null,
      }),
    ).toBe('15%');
  });

  it('returns amount and currency for absolute', () => {
    expect(
      formatDiscountRowValue({
        discountType: 'absolute',
        discountValue: '50',
        currency: 'HKD',
      }),
    ).toBe('50 HKD');
  });
});
