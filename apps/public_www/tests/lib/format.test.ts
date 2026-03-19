import { describe, expect, it } from 'vitest';

import {
  COHORT_VALUE_PATTERN,
  formatCohortValue,
  formatCurrencyHkd,
  formatPartDateTimeLabel,
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

describe('formatPartDateTimeLabel', () => {
  it('returns an empty string for invalid date values', () => {
    expect(formatPartDateTimeLabel('not-a-date')).toBe('');
    expect(formatPartDateTimeLabel('')).toBe('');
  });

  it('formats valid datetime values with lowercase am/pm', () => {
    expect(formatPartDateTimeLabel('2026-01-22T09:00:00Z')).toBe('Jan 22 @ 9:00 am');
    expect(formatPartDateTimeLabel('2026-01-22T21:30:00Z')).toBe('Jan 22 @ 9:30 pm');
  });
});

describe('cohort value helpers', () => {
  it('keeps the shared cohort pattern aligned', () => {
    expect(COHORT_VALUE_PATTERN.test('04-26')).toBe(true);
    expect(COHORT_VALUE_PATTERN.test('4-26')).toBe(false);
  });

  it('parses valid cohort values', () => {
    expect(parseCohortValue('04-26')).toEqual({ monthIndex: 3, year: 2026 });
    expect(parseCohortValue(' 12-29 ')).toEqual({ monthIndex: 11, year: 2029 });
  });

  it('returns null for invalid cohort values', () => {
    expect(parseCohortValue('13-26')).toBeNull();
    expect(parseCohortValue('AA-26')).toBeNull();
    expect(parseCohortValue('')).toBeNull();
  });

  it('formats parsed cohort values and preserves invalid inputs', () => {
    expect(formatCohortValue('04-26')).toBe('Apr, 2026');
    expect(formatCohortValue('invalid')).toBe('invalid');
    expect(formatCohortValue(' 04-26 ')).toBe('Apr, 2026');
  });
});
