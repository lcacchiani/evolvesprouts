import { describe, expect, it } from 'vitest';

import { formatEnumLabel, getCurrencyOptions } from '@/lib/format';

describe('format helpers', () => {
  it('formats snake_case values into title case labels', () => {
    expect(formatEnumLabel('training_course')).toBe('Training Course');
    expect(formatEnumLabel('in_person')).toBe('In Person');
  });

  it('includes HKD currency label in currency options', () => {
    const options = getCurrencyOptions();
    expect(options.some((option) => option.value === 'HKD' && option.label === 'HKD Hong Kong Dollar')).toBe(true);
  });
});
