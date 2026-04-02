import { describe, expect, it } from 'vitest';

import { buildConsultationsBookingModalPayload } from '@/lib/consultations-booking-modal-payload';
import { CONSULTATION_BOOKING_SYSTEM } from '@/lib/events-data';
import { getContent } from '@/content';

describe('buildConsultationsBookingModalPayload', () => {
  it('builds event-shaped payload for configured booking tier', () => {
    const content = getContent('en');
    const reservation = content.consultations.booking.reservation;
    const payload = buildConsultationsBookingModalPayload(reservation, 'en');

    expect(payload.variant).toBe('event');
    expect(payload.bookingSystem).toBe(CONSULTATION_BOOKING_SYSTEM);
    expect(payload.title).toBe(reservation.modalTitle);
    const tier =
      reservation.bookingTier === 'essentials'
        ? reservation.essentials
        : reservation.deepDive;
    expect(payload.originalAmount).toBe(tier.priceHkd);
    expect(payload.dateParts).toHaveLength(tier.dateParts.length);
    expect(payload.topicsFieldConfig?.required).toBe(true);
  });
});
