import { describe, expect, it } from 'vitest';

import { isDiscountValidityRangeInverted } from '@/lib/discount-validity';

describe('discount-validity', () => {
  it('detects inverted local datetime-local ranges', () => {
    expect(isDiscountValidityRangeInverted('2026-06-02T10:00', '2026-06-01T10:00')).toBe(true);
    expect(isDiscountValidityRangeInverted('2026-06-01T10:00', '2026-06-01T09:00')).toBe(true);
  });

  it('allows empty or single-sided ranges', () => {
    expect(isDiscountValidityRangeInverted('', '2026-06-01T10:00')).toBe(false);
    expect(isDiscountValidityRangeInverted('2026-06-01T10:00', '')).toBe(false);
    expect(isDiscountValidityRangeInverted('', '')).toBe(false);
  });

  it('allows same instant or later until', () => {
    expect(isDiscountValidityRangeInverted('2026-06-01T10:00', '2026-06-01T10:00')).toBe(false);
    expect(isDiscountValidityRangeInverted('2026-06-01T10:00', '2026-06-02T10:00')).toBe(false);
  });
});
