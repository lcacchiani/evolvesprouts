import { describe, expect, it } from 'vitest';

import {
  INTRO_CALL_SLOTS_API_PATH,
  PUBLIC_CALENDAR_AVAILABILITY_API_PATH,
  buildConsultationBlockersQueryRange,
  buildIntroCallSlotsApiPath,
  ymdFromSiteTimeZone,
  ymdFromSiteTimeZoneForIntro,
} from '@/lib/public-calendar-availability-api';

describe('buildConsultationBlockersQueryRange', () => {
  it('uses Asia/Hong_Kong calendar for Monday anchor and 120-day span (not browser local)', () => {
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

describe('intro-call availability API paths', () => {
  it('builds API path with purpose, from and to query params', () => {
    expect(
      buildIntroCallSlotsApiPath({ fromYmd: '2026-05-01', toYmd: '2026-05-22' }),
    ).toBe(
      `${PUBLIC_CALENDAR_AVAILABILITY_API_PATH}?purpose=intro_call_booking&from=2026-05-01&to=2026-05-22`,
    );
  });

  it('aliases INTRO_CALL_SLOTS_API_PATH to the unified availability path', () => {
    expect(INTRO_CALL_SLOTS_API_PATH).toBe(PUBLIC_CALENDAR_AVAILABILITY_API_PATH);
  });

  it('formats YMD in the public site timezone', () => {
    const d = new Date('2026-05-04T16:00:00Z');
    expect(ymdFromSiteTimeZoneForIntro(d)).toBe('2026-05-05');
  });
});
