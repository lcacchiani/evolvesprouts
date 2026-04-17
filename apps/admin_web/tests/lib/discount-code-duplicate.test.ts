import { describe, expect, it } from 'vitest';

import { buildDuplicateDiscountCodeName, MAX_DISCOUNT_CODE_LENGTH } from '@/lib/discount-code-duplicate';

describe('buildDuplicateDiscountCodeName', () => {
  it('appends COPY when within max length', () => {
    expect(buildDuplicateDiscountCodeName('SAVE10')).toBe('SAVE10COPY');
  });

  it('trims base so base plus COPY fits max length', () => {
    const base = 'A'.repeat(MAX_DISCOUNT_CODE_LENGTH);
    const out = buildDuplicateDiscountCodeName(base);
    expect(out.length).toBe(MAX_DISCOUNT_CODE_LENGTH);
    expect(out.endsWith('COPY')).toBe(true);
  });

  it('returns COPY for blank input', () => {
    expect(buildDuplicateDiscountCodeName('   ')).toBe('COPY');
  });
});
