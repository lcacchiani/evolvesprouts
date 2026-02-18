import { describe, expect, it } from 'vitest';

import { formatCurrencyHkd } from '@/lib/format';

describe('formatCurrencyHkd', () => {
  it('formats values as HKD with no decimals', () => {
    expect(formatCurrencyHkd(0)).toBe('HK$0');
    expect(formatCurrencyHkd(9000)).toBe('HK$9,000');
    expect(formatCurrencyHkd(18000)).toBe('HK$18,000');
  });

  it('rounds fractional input values', () => {
    expect(formatCurrencyHkd(8999.6)).toBe('HK$9,000');
    expect(formatCurrencyHkd(1999.4)).toBe('HK$1,999');
  });
});
