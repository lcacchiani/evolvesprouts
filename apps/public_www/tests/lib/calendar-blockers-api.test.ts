import { describe, expect, it } from 'vitest';

import {
  buildConsultationBlockersQueryRange,
  ymdFromSiteTimeZone,
} from '@/lib/calendar-blockers-api';

describe('buildConsultationBlockersQueryRange', () => {
  it('uses Asia/Hong_Kong calendar for Monday anchor and 120-day span (not browser local)', () => {
    // Wednesday 2026-04-08 in HKT (noon), regardless of test runner TZ
    const wedHkt = new Date('2026-04-08T12:00:00+08:00');
    const { fromYmd, toYmd } = buildConsultationBlockersQueryRange(wedHkt);
    expect(fromYmd).toBe('2026-04-06');
    expect(toYmd).toBe('2026-08-03');
  });

  it('maps a UTC instant to the site-zone calendar date', () => {
    const utcMidnightBeforeHktDateRoll = new Date('2026-04-07T16:00:00.000Z');
    expect(ymdFromSiteTimeZone(utcMidnightBeforeHktDateRoll)).toBe('2026-04-08');
  });
});
