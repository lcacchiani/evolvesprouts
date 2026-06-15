import { useEffect } from 'react';

import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import { trackAnalyticsEvent } from '@/lib/analytics';

interface UseBookingThankYouViewOptions {
  isOpen: boolean;
  reservationSummary: ReservationSummary | null;
  sectionId: string;
  ctaLocation?: string;
}

export function useBookingThankYouView({
  isOpen,
  reservationSummary,
  sectionId,
  ctaLocation = 'thank_you_modal',
}: UseBookingThankYouViewOptions) {
  useEffect(() => {
    if (!isOpen || !reservationSummary) {
      return;
    }

    trackAnalyticsEvent('booking_thank_you_view', {
      sectionId,
      ctaLocation,
      params: {
        payment_method: reservationSummary.paymentMethod,
        total_amount: reservationSummary.totalAmount,
        service_tier: reservationSummary.serviceTier,
        cohort_date: reservationSummary.dateStartTime?.split('T')[0] ?? '',
      },
    });
  }, [ctaLocation, isOpen, reservationSummary, sectionId]);
}
