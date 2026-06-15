import { formatSlotDayAriaLabel } from '@/components/sections/shared/slot-picker-helpers';
import { describe, expect, it } from 'vitest';

describe('slot-picker-helpers', () => {
  it('formats day aria labels from templates', () => {
    expect(formatSlotDayAriaLabel('Select day {day}', 12)).toBe('Select day 12');
  });
});
