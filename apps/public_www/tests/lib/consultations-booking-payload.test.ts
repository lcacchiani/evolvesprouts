import { describe, expect, it } from 'vitest';

import { buildConsultationEventBookingPayload } from '@/lib/consultations-booking-payload';
import { CONSULTATION_BOOKING_SYSTEM } from '@/lib/events-data';
import { getContent } from '@/content';

describe('buildConsultationEventBookingPayload', () => {
  it('builds event-shaped payload with consultation booking system', () => {
    const content = getContent('en');
    const reservation = content.consultations.booking.reservation;
    const payload = buildConsultationEventBookingPayload(
      'essentials',
      reservation,
      'en',
    );

    expect(payload.variant).toBe('event');
    expect(payload.bookingSystem).toBe(CONSULTATION_BOOKING_SYSTEM);
    expect(payload.title).toBe(reservation.modalTitle);
    expect(payload.originalAmount).toBe(reservation.essentials.priceHkd);
    expect(payload.dateParts).toHaveLength(reservation.essentials.dateParts.length);
    expect(payload.topicsFieldConfig?.required).toBe(true);
  });
});
