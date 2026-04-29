import { describe, expect, it } from 'vitest';

import {
  buildUnavailableSlotMap,
  normalizeAvailabilityYmd,
  parsePublicCalendarBlockersPayload,
  unavailableSlotMapToSlots,
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

  it('parsePublicCalendarBlockersPayload reads blockers or legacy unavailable_slots', () => {
    expect(
      parsePublicCalendarBlockersPayload({
        blockers: [{ date: '2026-05-01', period: 'pm' }],
      }),
    ).toEqual([{ date: '2026-05-01', period: 'pm' }]);
    expect(
      parsePublicCalendarBlockersPayload({
        unavailable_slots: [{ date: '2026-05-02', period: 'am' }],
      }),
    ).toEqual([{ date: '2026-05-02', period: 'am' }]);
  });

  it('unavailableSlotMapToSlots emits sorted both/am/pm rows', () => {
    const map = new Map<string, { am: boolean; pm: boolean }>();
    map.set('2026-05-03', { am: true, pm: true });
    map.set('2026-05-02', { am: true, pm: false });
    expect(unavailableSlotMapToSlots(map)).toEqual([
      { date: '2026-05-02', period: 'am' },
      { date: '2026-05-03', period: 'both' },
    ]);
  });
});
