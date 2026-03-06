import { describe, expect, it } from 'vitest';

import { formatDate, formatEnumLabel, getCurrencyOptions } from '@/lib/format';

describe('format helpers', () => {
  it('formats snake_case values into title case labels', () => {
    expect(formatEnumLabel('training_course')).toBe('Training Course');
    expect(formatEnumLabel('in_person')).toBe('In Person');
  });

  it('includes HKD currency label in currency options', () => {
    const options = getCurrencyOptions();
    expect(options.some((option) => option.value === 'HKD' && option.label === 'HKD Hong Kong Dollar')).toBe(true);
  });

  it('formats dates using UK locale and timezone', () => {
    expect(formatDate('2026-03-01T10:00:00Z')).toBe('01 Mar 2026, 10:00');
    expect(formatDate(null)).toBe('—');
  });
});
