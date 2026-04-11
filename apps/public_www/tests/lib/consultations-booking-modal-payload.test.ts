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
    expect(payload.topicsPrefill).toBeUndefined();
  });

  it('includes topicsPrefill when focus and level labels are provided', () => {
    const content = getContent('en');
    const reservation = content.consultations.booking.reservation;
    const payload = buildConsultationsBookingModalPayload(reservation, 'en', {
      focusLabel: 'Home Assessment',
      levelLabel: 'Deep Dive',
    });

    expect(payload.topicsPrefill).toBe('Home Assessment — Deep Dive');
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

  it('does not include directionHref in consultations payload', () => {
    const content = getContent('en');
    const base = content.consultations.booking.reservation;
    const payload = buildConsultationsBookingModalPayload(base, 'en');
    expect(payload.directionHref).toBeUndefined();

    const withUnexpectedDirection: ConsultationsBookingReservationContent & {
      directionHref: string;
    } = {
      ...base,
      directionHref: 'https://maps.example.com/place',
    };
    expect(
      buildConsultationsBookingModalPayload(withUnexpectedDirection, 'en').directionHref,
    ).toBeUndefined();
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
