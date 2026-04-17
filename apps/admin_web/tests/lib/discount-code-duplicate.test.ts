import { describe, expect, it } from 'vitest';

import { bumpDuplicateDiscountCode, MAX_DISCOUNT_CODE_LENGTH } from '@/lib/discount-code-duplicate';

describe('bumpDuplicateDiscountCode', () => {
  it('appends COPY on first bump', () => {
    expect(bumpDuplicateDiscountCode('SAVE10')).toBe('SAVE10COPY');
  });

  it('increments COPY suffix', () => {
    expect(bumpDuplicateDiscountCode('SAVE10COPY')).toBe('SAVE10COPY2');
    expect(bumpDuplicateDiscountCode('SAVE10COPY2')).toBe('SAVE10COPY3');
  });

  it('trims base to respect max length', () => {
    const base = 'A'.repeat(MAX_DISCOUNT_CODE_LENGTH);
    const out = bumpDuplicateDiscountCode(base);
    expect(out.length).toBe(MAX_DISCOUNT_CODE_LENGTH);
    expect(out.endsWith('COPY')).toBe(true);
  });

  it('bumps COPY to COPY2 at max length (trims one char of root for longer suffix)', () => {
    const root = 'B'.repeat(MAX_DISCOUNT_CODE_LENGTH - 4);
    expect(`${root}COPY`.length).toBe(MAX_DISCOUNT_CODE_LENGTH);
    expect(bumpDuplicateDiscountCode(`${root}COPY`)).toBe(`${root.slice(0, -1)}COPY2`);
  });

  it('returns COPY for blank input', () => {
    expect(bumpDuplicateDiscountCode('   ')).toBe('COPY');
  });

  it('bumps bare COPY and COPY<n> as sequence roots', () => {
    expect(bumpDuplicateDiscountCode('COPY')).toBe('COPY2');
    expect(bumpDuplicateDiscountCode('COPY2')).toBe('COPY3');
  });

  it('treats trailing COPY as suffix even when glued to letters (collision bump)', () => {
    expect(bumpDuplicateDiscountCode('SCALLOPCOPY')).toBe('SCALLOPCOPY2');
    expect(bumpDuplicateDiscountCode('JOYCOPY9')).toBe('JOYCOPY10');
  });
});
