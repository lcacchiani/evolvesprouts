import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyDiscount,
  escapeHtml,
  extractIsoDateFromPartDate,
  extractTimeRangeFromPartDate,
  resolveLocalizedDate,
} from '@/components/sections/booking-modal/helpers';

describe('booking modal helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies percentage and fixed discounts with a zero floor', () => {
    expect(applyDiscount(9000, null)).toBe(9000);
    expect(
      applyDiscount(9000, {
        code: 'SAVE10',
        type: 'percent',
        value: 10,
      }),
    ).toBe(8100);
    expect(
      applyDiscount(9000, {
        code: 'FLAT900',
        type: 'amount',
        value: 900,
      }),
    ).toBe(8100);
    expect(
      applyDiscount(500, {
        code: 'FLAT999',
        type: 'amount',
        value: 999,
      }),
    ).toBe(0);
  });

  it('escapes HTML-sensitive characters for safe text insertion', () => {
    expect(escapeHtml(`<script>alert("x") & "y"</script>'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;) &amp; &quot;y&quot;&lt;/script&gt;&#39;',
    );
  });

  it('extracts and normalizes the time range from a part date string', () => {
    expect(extractTimeRangeFromPartDate('Apr 08 @ 12:00 pm - 2:00 pm')).toBe(
      '12:00 pm - 2:00 pm',
    );
    expect(extractTimeRangeFromPartDate('Apr 08')).toBe('');
  });

  it('extracts a cohort ISO date from the part date and month label', () => {
    expect(extractIsoDateFromPartDate('Apr 08 @ 12:00 pm - 2:00 pm', 'Apr, 2026')).toBe(
      '2026-04-08',
    );
    expect(extractIsoDateFromPartDate('Invalid', 'Apr, 2026')).toBe('');
  });

  it('formats localized transaction dates from the current time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-19T08:00:00.000Z'));

    const expected = new Intl.DateTimeFormat('en', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    expect(resolveLocalizedDate('en')).toBe(expected);
    expect(resolveLocalizedDate('zh-HK')).toContain('2026');
  });
});
