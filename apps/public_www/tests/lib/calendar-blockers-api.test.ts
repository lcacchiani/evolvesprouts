import { describe, expect, it } from 'vitest';

import { buildConsultationBlockersQueryRange } from '@/lib/calendar-blockers-api';

describe('buildConsultationBlockersQueryRange', () => {
  it('aligns from to Monday of the local week and spans 120 inclusive days', () => {
    // Wednesday 2026-04-08 local
    const wed = new Date(2026, 3, 8, 15, 0, 0);
    const { fromYmd, toYmd } = buildConsultationBlockersQueryRange(wed);
    expect(fromYmd).toBe('2026-04-06'); // Monday
    expect(toYmd).toBe('2026-08-03'); // Monday + 119 days
  });
});
