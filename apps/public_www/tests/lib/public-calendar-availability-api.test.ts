import { describe, expect, it, vi } from 'vitest';

import {
  INTRO_CALL_SLOTS_API_PATH,
  PUBLIC_CALENDAR_AVAILABILITY_API_PATH,
  buildConsultationBlockersQueryRange,
  buildIntroCallSlotsApiPath,
  fetchConsultationCalendarAvailability,
  fetchPublicCalendarAvailability,
  ymdFromSiteTimeZone,
  ymdFromSiteTimeZoneForIntro,
} from '@/lib/public-calendar-availability-api';

vi.mock('@/lib/crm-api-client', () => ({
  createPublicCrmApiClient: vi.fn(),
}));

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

describe('fetchPublicCalendarAvailability', () => {
  it('resolves with fetchFailed true when the CRM client is missing', async () => {
    const { createPublicCrmApiClient } = await import('@/lib/crm-api-client');
    vi.mocked(createPublicCrmApiClient).mockReturnValue(null);

    const result = await fetchPublicCalendarAvailability({
      purpose: 'consultation_booking',
      fromYmd: '2026-05-01',
      toYmd: '2026-05-22',
      signal: new AbortController().signal,
    });

    expect(result).toEqual({
      slots: [],
      meta: null,
      fetchFailed: true,
    });
  });

  it('resolves with fetchFailed false and parsed slots on HTTP success', async () => {
    const { createPublicCrmApiClient } = await import('@/lib/crm-api-client');
    vi.mocked(createPublicCrmApiClient).mockReturnValue({
      request: vi.fn().mockResolvedValue({
        slots: [{ start_iso: '2026-05-04T01:00:00Z', end_iso: '2026-05-04T04:00:00Z' }],
        meta: {
          purpose: 'consultation_booking',
          from: '2026-05-01',
          to: '2026-08-03',
          wall_time_zone: 'Asia/Hong_Kong',
          default_horizon_days: 120,
          max_horizon_days: 120,
          lead_calendar_days: 2,
        },
      }),
    });

    const result = await fetchPublicCalendarAvailability({
      purpose: 'consultation_booking',
      fromYmd: '2026-05-01',
      toYmd: '2026-08-03',
      signal: new AbortController().signal,
    });

    expect(result.fetchFailed).toBe(false);
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0]).toEqual({
      startIso: '2026-05-04T01:00:00Z',
      endIso: '2026-05-04T04:00:00Z',
    });
    expect(result.meta?.wallTimeZone).toBe('Asia/Hong_Kong');
  });
});

describe('fetchConsultationCalendarAvailability', () => {
  it('returns fetchFailed true when meta omits wall_time_zone', async () => {
    const { createPublicCrmApiClient } = await import('@/lib/crm-api-client');
    vi.mocked(createPublicCrmApiClient).mockReturnValue({
      request: vi.fn().mockResolvedValue({
        slots: [{ start_iso: '2026-05-04T01:00:00Z', end_iso: '2026-05-04T04:00:00Z' }],
        meta: {
          purpose: 'consultation_booking',
          from: '2026-05-01',
          to: '2026-08-03',
          wall_time_zone: '',
          default_horizon_days: 120,
          max_horizon_days: 120,
          lead_calendar_days: 2,
        },
      }),
    });

    const out = await fetchConsultationCalendarAvailability(new AbortController().signal);
    expect(out.fetchFailed).toBe(true);
    expect(out.slots).toEqual([]);
  });
});
