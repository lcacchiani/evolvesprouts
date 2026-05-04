import { describe, expect, it } from 'vitest';

import {
  INTRO_CALL_SLOTS_API_PATH,
  buildIntroCallSlotsApiPath,
  ymdFromSiteTimeZoneForIntro,
} from '@/lib/intro-call-slots-api';

describe('intro-call-slots-api', () => {
  it('builds API path with from and to query params', () => {
    expect(
      buildIntroCallSlotsApiPath({ fromYmd: '2026-05-01', toYmd: '2026-05-22' }),
    ).toBe(`${INTRO_CALL_SLOTS_API_PATH}?from=2026-05-01&to=2026-05-22`);
  });

  it('formats YMD in the public site timezone', () => {
    const d = new Date('2026-05-04T16:00:00Z');
    expect(ymdFromSiteTimeZoneForIntro(d)).toBe('2026-05-05');
  });
});
