import { describe, expect, it } from 'vitest';

import {
  buildBookingConfirmationTableRows,
  formatBookingDatetimeDisplay,
  locationSuggestsHongKong,
} from '@/lib/booking-confirmation-table';

const tableLabels = {
  service: 'Service',
  datetime: 'Date & time',
  location: 'Location',
  details: 'Details',
  payment: 'Payment method',
  total: 'Total',
};

const detailsPrefixes = {
  cohort: 'Cohort',
  ageGroup: 'Age group',
  writingFocus: 'Focus',
  level: 'Level',
};

describe('booking-confirmation-table', () => {
  it('detects Hong Kong from venue text', () => {
    expect(locationSuggestsHongKong('Evolve Sprouts', "Queen's Road West, Sheung Wan")).toBe(
      true,
    );
    expect(locationSuggestsHongKong('Online', undefined)).toBe(false);
  });

  it('formats HKT line from primary session ISO when location is HK', () => {
    const line = formatBookingDatetimeDisplay({
      primarySessionIso: '2026-04-19T01:00:00Z',
      scheduleDateLabel: 'Apr, 2026',
      scheduleTimeLabel: 'ignored when iso parses',
      locationUseHkt: true,
    });
    expect(line).toBe('19 April @ 09:00 HKT');
  });

  it('builds MBA-style details and rows', () => {
    const rows = buildBookingConfirmationTableRows({
      courseLabel: 'My Best Auntie Training Course',
      labels: tableLabels,
      detailsPrefixes,
      courseSlug: 'my-best-auntie',
      scheduleDateLabel: 'Apr, 2026',
      scheduleTimeLabel: '2026-04-19T01:00:00Z – 2026-04-19T03:00:00Z',
      primarySessionIso: '2026-04-19T01:00:00Z',
      ageGroupLabel: '1-3',
      consultationWritingFocusLabel: undefined,
      consultationLevelLabel: undefined,
      locationName: 'Evolve Sprouts',
      locationAddress: 'Sheung Wan',
      paymentMethodCode: 'fps_qr',
      totalAmountFormatted: 'HK$9,000',
    });

    expect(rows.map((r) => r.label)).toEqual([
      'Service',
      'Details',
      'Date & time',
      'Location',
      'Payment method',
      'Total',
    ]);
    expect(rows[1].multiline).toBe(true);
    expect(rows[1].value).toContain('Cohort: Apr, 2026');
    expect(rows[1].value).toContain('Age group: 1-3');
    expect(rows.find((r) => r.label === 'Date & time')?.value).toBe('19 April @ 09:00 HKT');
    expect(rows.find((r) => r.label === 'Payment method')?.value).toBe('FPS');
  });
});
