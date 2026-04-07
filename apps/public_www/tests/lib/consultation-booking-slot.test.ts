import { describe, expect, it } from 'vitest';

import {
  buildConsultationPickerWeeks,
  collectDistinctHkYearMonthsFromYmds,
  CONSULTATION_SLOT_AM_HOUR_HKT,
  CONSULTATION_SLOT_PM_HOUR_HKT,
  formatConsultationPickerMonthHeading,
  getHkMondayOfWeekContaining,
  hktWallClockToUtcIso,
  rebaseConsultationDateParts,
  resolveConsultationSlotStartIso,
} from '@/lib/consultation-booking-slot';

describe('consultation-booking-slot', () => {
  it('getHkMondayOfWeekContaining returns Monday of current HK week', () => {
    const tuesdayHk = new Date('2026-04-07T12:00:00+08:00');
    expect(getHkMondayOfWeekContaining(tuesdayHk)).toBe('2026-04-06');
  });

  it('buildConsultationPickerWeeks lists Mon–Fri for four weeks and disables past HK dates', () => {
    const tuesdayHk = new Date('2026-04-07T12:00:00+08:00');
    const weeks = buildConsultationPickerWeeks(tuesdayHk);
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

    expect(weeks[0]?.days[0]?.isDisabled).toBe(true);
    expect(weeks[0]?.days[1]?.isDisabled).toBe(false);
  });

  it('collectDistinctHkYearMonthsFromYmds returns sorted unique months', () => {
    const pairs = collectDistinctHkYearMonthsFromYmds([
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
    );
    expect(label).toContain('·');
    expect(label.length).toBeGreaterThan(5);
  });

  it('hktWallClockToUtcIso maps HKT wall time to UTC ISO', () => {
    expect(hktWallClockToUtcIso('2026-04-07', 9, 0)).toBe('2026-04-07T01:00:00.000Z');
  });

  it('resolveConsultationSlotStartIso uses AM/PM slot hours', () => {
    expect(resolveConsultationSlotStartIso('2026-04-07', 'am')).toBe(
      hktWallClockToUtcIso('2026-04-07', CONSULTATION_SLOT_AM_HOUR_HKT, 0),
    );
    expect(resolveConsultationSlotStartIso('2026-04-07', 'pm')).toBe(
      hktWallClockToUtcIso('2026-04-07', CONSULTATION_SLOT_PM_HOUR_HKT, 0),
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
    const out = rebaseConsultationDateParts(parts, '2026-04-15', 'am');
    const firstStart = new Date(out[0]!.startDateTime).getTime();
    const secondStart = new Date(out[1]!.startDateTime).getTime();
    expect(secondStart - firstStart).toBe(7 * 86400000);
    const firstDur =
      new Date(out[0]!.endDateTime).getTime() - new Date(out[0]!.startDateTime).getTime();
    expect(firstDur).toBe(3600000);
  });
});
