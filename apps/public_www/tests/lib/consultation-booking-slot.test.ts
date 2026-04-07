import { describe, expect, it } from 'vitest';

import { buildUnavailableSlotMap } from '@/lib/calendar-availability';
import {
  buildConsultationPickerWeeks,
  collectDistinctYearMonthsFromYmds,
  CONSULTATION_SLOT_AM_HOUR_LOCAL,
  CONSULTATION_SLOT_PM_HOUR_LOCAL,
  firstSelectableConsultationPeriod,
  formatConsultationPickerMonthHeading,
  getMondayOfWeekContainingInZone,
  pickDefaultConsultationSelection,
  rebaseConsultationDateParts,
  resolveConsultationSlotStartIso,
  zoneWallClockYmdToUtcIso,
} from '@/lib/consultation-booking-slot';

const HK = 'Asia/Hong_Kong';

const emptyUnavailable = new Map<string, { am: boolean; pm: boolean }>();

describe('consultation-booking-slot', () => {
  it('getMondayOfWeekContainingInZone returns Monday of current week in zone', () => {
    const tuesdayHk = new Date('2026-04-07T12:00:00+08:00');
    expect(getMondayOfWeekContainingInZone(tuesdayHk, HK)).toBe('2026-04-06');
  });

  it('buildConsultationPickerWeeks lists Mon–Fri for four weeks and disables past dates in zone', () => {
    const tuesdayHk = new Date('2026-04-07T12:00:00+08:00');
    const weeks = buildConsultationPickerWeeks(HK, emptyUnavailable, tuesdayHk);
    expect(weeks).toHaveLength(4);
    for (const row of weeks) {
      expect(row.days).toHaveLength(5);
    }

    expect(weeks[0]?.days.map((c) => c.ymd)).toEqual([
      '2026-04-06',
      '2026-04-07',
      '2026-04-08',
      '2026-04-09',
      '2026-04-10',
    ]);

    expect(weeks[0]?.days[0]?.isPast).toBe(true);
    expect(weeks[0]?.days[0]?.isDisabled).toBe(true);
    expect(weeks[0]?.days[1]?.isDisabled).toBe(false);
  });

  it('disables a day when both am and pm are unavailable', () => {
    const tuesdayHk = new Date('2026-04-07T12:00:00+08:00');
    const map = buildUnavailableSlotMap([
      { date: '2026-04-08', period: 'am' },
      { date: '2026-04-08', period: 'pm' },
    ]);
    const weeks = buildConsultationPickerWeeks(HK, map, tuesdayHk);
    const apr8 = weeks[0]?.days.find((c) => c.ymd === '2026-04-08');
    expect(apr8?.isDisabled).toBe(true);
  });

  it('firstSelectableConsultationPeriod picks pm when only am is blocked', () => {
    const map = buildUnavailableSlotMap([{ date: '2026-04-09', period: 'am' }]);
    expect(firstSelectableConsultationPeriod('2026-04-09', map)).toBe('pm');
    expect(firstSelectableConsultationPeriod('2026-04-10', map)).toBe('am');
  });

  it('pickDefaultConsultationSelection skips fully blocked days', () => {
    const tuesdayHk = new Date('2026-04-07T12:00:00+08:00');
    const map = buildUnavailableSlotMap([
      { date: '2026-04-07', period: 'both' },
      { date: '2026-04-08', period: 'both' },
    ]);
    const weeks = buildConsultationPickerWeeks(HK, map, tuesdayHk);
    const sel = pickDefaultConsultationSelection(weeks, map);
    expect(sel?.ymd).toBe('2026-04-09');
  });

  it('collectDistinctYearMonthsFromYmds returns sorted unique months', () => {
    const pairs = collectDistinctYearMonthsFromYmds([
      '2026-04-28',
      '2026-04-30',
      '2026-05-01',
    ]);
    expect(pairs).toEqual([
      { year: 2026, month: 4 },
      { year: 2026, month: 5 },
    ]);
  });

  it('formatConsultationPickerMonthHeading joins with joiner', () => {
    const label = formatConsultationPickerMonthHeading(
      [
        { year: 2026, month: 4 },
        { year: 2026, month: 5 },
      ],
      'en',
      ' · ',
      HK,
    );
    expect(label).toContain('·');
    expect(label.length).toBeGreaterThan(5);
  });

  it('zoneWallClockYmdToUtcIso maps zone wall time to UTC ISO (Hong Kong)', () => {
    expect(zoneWallClockYmdToUtcIso('2026-04-07', 9, 0, HK)).toBe('2026-04-07T01:00:00.000Z');
  });

  it('resolveConsultationSlotStartIso uses AM/PM slot hours in zone', () => {
    expect(resolveConsultationSlotStartIso('2026-04-07', 'am', HK)).toBe(
      zoneWallClockYmdToUtcIso('2026-04-07', CONSULTATION_SLOT_AM_HOUR_LOCAL, 0, HK),
    );
    expect(resolveConsultationSlotStartIso('2026-04-07', 'pm', HK)).toBe(
      zoneWallClockYmdToUtcIso('2026-04-07', CONSULTATION_SLOT_PM_HOUR_LOCAL, 0, HK),
    );
  });

  it('rebaseConsultationDateParts preserves relative spacing from first start', () => {
    const parts = [
      {
        id: 'a',
        startDateTime: '2026-06-01T01:00:00.000Z',
        endDateTime: '2026-06-01T02:00:00.000Z',
        description: 'first',
      },
      {
        id: 'b',
        startDateTime: '2026-06-08T01:00:00.000Z',
        endDateTime: '2026-06-08T01:30:00.000Z',
        description: 'second',
      },
    ];
    const out = rebaseConsultationDateParts(parts, '2026-04-15', 'am', HK);
    const firstStart = new Date(out[0]!.startDateTime).getTime();
    const secondStart = new Date(out[1]!.startDateTime).getTime();
    expect(secondStart - firstStart).toBe(7 * 86400000);
    const firstDur =
      new Date(out[0]!.endDateTime).getTime() - new Date(out[0]!.startDateTime).getTime();
    expect(firstDur).toBe(3600000);
  });
});
