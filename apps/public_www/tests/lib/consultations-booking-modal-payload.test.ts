import { describe, expect, it } from 'vitest';

import { buildConsultationsBookingModalPayload } from '@/lib/consultations-booking-modal-payload';
import { CONSULTATION_BOOKING_SYSTEM } from '@/lib/events-data';
import type { ConsultationsBookingReservationContent } from '@/content';
import { getContent } from '@/content';

describe('buildConsultationsBookingModalPayload', () => {
  it('builds consultation payload for essentials tier (en)', () => {
    const content = getContent('en');
    const reservation = content.consultations.booking.reservation;
    const payload = buildConsultationsBookingModalPayload(reservation, 'en');

    expect(payload.variant).toBe('event');
    expect(payload.bookingSystem).toBe(CONSULTATION_BOOKING_SYSTEM);
    expect(payload.title).toBe(reservation.modalTitle);
    expect(payload.originalAmount).toBe(reservation.essentials.priceHkd);
    expect(payload.dateParts).toHaveLength(reservation.essentials.dateParts.length);
    expect(payload.topicsFieldConfig?.required).toBe(true);
    expect(payload.directionHref).toBeUndefined();
  });

  it('uses deep dive tier when bookingTier is deepDive', () => {
    const content = getContent('en');
    const reservation: ConsultationsBookingReservationContent = {
      ...content.consultations.booking.reservation,
      bookingTier: 'deepDive',
    };
    const payload = buildConsultationsBookingModalPayload(reservation, 'en');

    expect(payload.originalAmount).toBe(reservation.deepDive.priceHkd);
    expect(payload.dateParts).toHaveLength(reservation.deepDive.dateParts.length);
  });

  it('includes directionHref only for http(s) URLs', () => {
    const content = getContent('en');
    const base = content.consultations.booking.reservation;
    const withHash: ConsultationsBookingReservationContent = {
      ...base,
      directionHref: '#',
    };
    expect(
      buildConsultationsBookingModalPayload(withHash, 'en').directionHref,
    ).toBeUndefined();

    const mapsUrl = 'https://maps.example.com/place';
    const withMaps: ConsultationsBookingReservationContent = {
      ...base,
      directionHref: mapsUrl,
    };
    expect(buildConsultationsBookingModalPayload(withMaps, 'en').directionHref).toBe(
      mapsUrl,
    );
  });

  it('interpolates price in descriptions for zh-CN and zh-HK', () => {
    const en = getContent('en');
    const zhCn = getContent('zh-CN');
    const zhHk = getContent('zh-HK');
    const enPayload = buildConsultationsBookingModalPayload(
      en.consultations.booking.reservation,
      'en',
    );
    const zhCnPayload = buildConsultationsBookingModalPayload(
      zhCn.consultations.booking.reservation,
      'zh-CN',
    );
    const zhHkPayload = buildConsultationsBookingModalPayload(
      zhHk.consultations.booking.reservation,
      'zh-HK',
    );

    expect(enPayload.dateParts[0]?.description).not.toContain('{price}');
    expect(zhCnPayload.dateParts[0]?.description).not.toContain('{price}');
    expect(zhHkPayload.dateParts[0]?.description).not.toContain('{price}');
  });

  it('uses empty selectedDateStartTime when dateParts is empty', () => {
    const content = getContent('en');
    const reservation: ConsultationsBookingReservationContent = {
      ...content.consultations.booking.reservation,
      essentials: {
        ...content.consultations.booking.reservation.essentials,
        dateParts: [],
      },
    };
    const payload = buildConsultationsBookingModalPayload(reservation, 'en');
    expect(payload.selectedDateStartTime).toBe('');
    expect(payload.dateParts).toHaveLength(0);
  });
});
