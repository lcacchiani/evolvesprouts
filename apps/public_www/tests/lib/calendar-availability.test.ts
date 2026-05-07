import { describe, expect, it } from 'vitest';

import {
  buildUnavailableSlotMap,
  deriveHalfDayBlockersFromSlots,
  normalizeAvailabilityYmd,
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

  it('deriveHalfDayBlockersFromSlots AM available, PM blocked on a weekday', () => {
    const slots = [{ startIso: '2026-05-18T01:00:00Z' }];
    const out = deriveHalfDayBlockersFromSlots(slots, 'Asia/Hong_Kong', {
      fromYmd: '2026-05-18',
      toYmd: '2026-05-18',
    });
    const pmOnly = out.filter((r) => r.date === '2026-05-18' && r.period === 'pm');
    const amOnly = out.filter((r) => r.date === '2026-05-18' && r.period === 'am');
    expect(amOnly).toHaveLength(0);
    expect(pmOnly).toHaveLength(1);
  });

  it('deriveHalfDayBlockersFromSlots blocks weekends entirely', () => {
    const out = deriveHalfDayBlockersFromSlots([], 'Asia/Hong_Kong', {
      fromYmd: '2026-05-16',
      toYmd: '2026-05-17',
    });
    expect(out).toEqual(
      expect.arrayContaining([
        { date: '2026-05-16', period: 'am' },
        { date: '2026-05-16', period: 'pm' },
        { date: '2026-05-17', period: 'am' },
        { date: '2026-05-17', period: 'pm' },
      ]),
    );
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
