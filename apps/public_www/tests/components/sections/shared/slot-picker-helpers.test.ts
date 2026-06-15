import {
  formatSlotDayAriaLabel,
  isMorningWallClockHour,
} from '@/components/sections/shared/slot-picker-helpers';
import { describe, expect, it } from 'vitest';

describe('slot-picker-helpers', () => {
  it('formats day aria labels from templates', () => {
    expect(formatSlotDayAriaLabel('Select day {day}', 12)).toBe('Select day 12');
  });

  it('classifies morning wall-clock hours', () => {
    expect(isMorningWallClockHour(0)).toBe(true);
    expect(isMorningWallClockHour(11)).toBe(true);
    expect(isMorningWallClockHour(12)).toBe(false);
    expect(isMorningWallClockHour(23)).toBe(false);
  });
});
