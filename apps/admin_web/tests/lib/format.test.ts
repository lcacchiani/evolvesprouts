import { describe, expect, it } from 'vitest';

import { formatDate, formatEnumLabel, getCurrencyOptions } from '@/lib/format';

describe('format helpers', () => {
  it('formats snake_case values into title case labels', () => {
    expect(formatEnumLabel('training_course')).toBe('Training Course');
    expect(formatEnumLabel('in_person')).toBe('In Person');
  });

  it('exposes only USD, CNY, HKD, and SGD in currency options with expected labels', () => {
    const options = getCurrencyOptions();
    expect(options.map((o) => o.value)).toEqual(['USD', 'CNY', 'HKD', 'SGD']);
    expect(options.some((option) => option.value === 'HKD' && option.label === 'HKD Hong Kong Dollar')).toBe(true);
  });

  it('formats dates in the local timezone and default locale', () => {
    const iso = '2026-03-01T10:00:00Z';
    const parsed = new Date(iso);
    const expected = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
    expect(formatDate(iso)).toBe(expected);
    expect(formatDate(null)).toBe('—');
  });
});
