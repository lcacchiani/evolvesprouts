import { describe, expect, it } from 'vitest';

import { buildUnavailableSlotMap, normalizeAvailabilityYmd } from '@/lib/calendar-availability';

describe('calendar-availability', () => {
  it('normalizeAvailabilityYmd accepts YYYY-MM-DD only', () => {
    expect(normalizeAvailabilityYmd('2026-04-15')).toBe('2026-04-15');
    expect(normalizeAvailabilityYmd(' 2026-04-15 ')).toBe('2026-04-15');
    expect(normalizeAvailabilityYmd('15-04-2026')).toBeNull();
    expect(normalizeAvailabilityYmd('')).toBeNull();
  });

  it('buildUnavailableSlotMap merges am, pm, and both', () => {
    const map = buildUnavailableSlotMap([
      { date: '2026-04-10', period: 'am' },
      { date: '2026-04-10', period: 'pm' },
      { date: '2026-04-11', period: 'both' },
      { date: 'not-a-date', period: 'am' },
    ]);
    expect(map.get('2026-04-10')).toEqual({ am: true, pm: true });
    expect(map.get('2026-04-11')).toEqual({ am: true, pm: true });
  });
});
