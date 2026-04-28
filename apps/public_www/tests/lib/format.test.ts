import { describe, expect, it } from 'vitest';

import {
  COHORT_VALUE_PATTERN,
  formatCohortValue,
  formatCurrencyDisplayPrefix,
  formatCurrencyHkd,
  formatPartDateTimeLabel,
  normalizeCurrencyPrefixForDisplay,
  parseCohortValue,
} from '@/lib/format';

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

  it('formats HKD values using locale-aware output', () => {
    expect(formatCurrencyHkd(9000, 'zh-CN')).toBe('HK$9,000');
    expect(formatCurrencyHkd(9000, 'zh-HK')).toBe('HK$9,000');
  });
});

describe('normalizeCurrencyPrefixForDisplay', () => {
  it('maps HKD to HK$ and passes through other prefixes', () => {
    expect(normalizeCurrencyPrefixForDisplay('HKD')).toBe('HK$');
    expect(normalizeCurrencyPrefixForDisplay(' hkd ')).toBe('HK$');
    expect(normalizeCurrencyPrefixForDisplay('HK$')).toBe('HK$');
    expect(normalizeCurrencyPrefixForDisplay('  ')).toBeUndefined();
  });
});

describe('formatCurrencyDisplayPrefix', () => {
  it('maps HKD to HK$ for template copy', () => {
    expect(formatCurrencyDisplayPrefix('HKD')).toBe('HK$');
    expect(formatCurrencyDisplayPrefix(' hkd ')).toBe('HK$');
  });

  it('returns a narrow symbol for other ISO codes when Intl supports them', () => {
    expect(formatCurrencyDisplayPrefix('USD').length).toBeGreaterThan(0);
  });
});

describe('formatPartDateTimeLabel', () => {
  it('returns an empty string for invalid date values', () => {
    expect(formatPartDateTimeLabel('not-a-date')).toBe('');
    expect(formatPartDateTimeLabel('')).toBe('');
  });

  it('formats valid datetime values in the site timezone with 24-hour English times', () => {
    expect(formatPartDateTimeLabel('2026-01-22T09:00:00Z')).toBe('22 Jan @ 17:00');
    expect(formatPartDateTimeLabel('2026-01-22T21:30:00Z')).toBe('23 Jan @ 05:30');
  });
});

describe('cohort value helpers', () => {
  it('keeps the shared cohort pattern aligned (parser validates month names)', () => {
    expect(COHORT_VALUE_PATTERN.test('04-26')).toBe(true);
    expect(COHORT_VALUE_PATTERN.test('apr-26')).toBe(true);
    expect(COHORT_VALUE_PATTERN.test('Apr-26')).toBe(true);
    expect(COHORT_VALUE_PATTERN.test('april-26')).toBe(false);
    expect(COHORT_VALUE_PATTERN.test('xx-26')).toBe(false);
    expect(COHORT_VALUE_PATTERN.test('4-26')).toBe(false);
  });

  it('parses valid cohort values (legacy numeric and canonical alpha)', () => {
    expect(parseCohortValue('04-26')).toEqual({ monthIndex: 3, year: 2026 });
    expect(parseCohortValue(' 12-29 ')).toEqual({ monthIndex: 11, year: 2029 });
    expect(parseCohortValue('apr-26')).toEqual({ monthIndex: 3, year: 2026 });
    expect(parseCohortValue('APR-26')).toEqual({ monthIndex: 3, year: 2026 });
    expect(parseCohortValue('jan-25')).toEqual({ monthIndex: 0, year: 2025 });
    expect(parseCohortValue('dec-29')).toEqual({ monthIndex: 11, year: 2029 });
  });

  it('returns null for invalid cohort values', () => {
    expect(parseCohortValue('13-26')).toBeNull();
    expect(parseCohortValue('AA-26')).toBeNull();
    expect(parseCohortValue('xyz-26')).toBeNull();
    expect(parseCohortValue('')).toBeNull();
  });

  it('formats parsed cohort values and preserves invalid inputs', () => {
    expect(formatCohortValue('04-26')).toBe('Apr, 2026');
    expect(formatCohortValue('apr-26')).toBe('Apr, 2026');
    expect(formatCohortValue(' Apr-26 ')).toBe('Apr, 2026');
    expect(formatCohortValue('invalid')).toBe('invalid');
    expect(formatCohortValue(' 04-26 ')).toBe('Apr, 2026');
  });
});
