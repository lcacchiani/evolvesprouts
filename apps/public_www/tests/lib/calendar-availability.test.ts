import { describe, expect, it } from 'vitest';

import {
  buildUnavailableSlotMap,
  normalizeAvailabilityYmd,
  parsePublicCalendarBlockersPayload,
} from '@/lib/calendar-availability';

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

  it('parsePublicCalendarBlockersPayload reads blockers array', () => {
    expect(
      parsePublicCalendarBlockersPayload({
        blockers: [{ date: '2026-05-01', period: 'pm' }],
      }),
    ).toEqual([{ date: '2026-05-01', period: 'pm' }]);
    expect(parsePublicCalendarBlockersPayload({ unavailable_slots: [] })).toEqual([]);
  });

  it('buildUnavailableSlotMap round-trips sorted slot list semantics', () => {
    const map = buildUnavailableSlotMap([
      { date: '2026-05-03', period: 'both' },
      { date: '2026-05-02', period: 'am' },
    ]);
    expect(map.get('2026-05-02')).toEqual({ am: true, pm: false });
    expect(map.get('2026-05-03')).toEqual({ am: true, pm: true });
  });
});
