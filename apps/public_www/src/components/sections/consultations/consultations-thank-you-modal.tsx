'use client';

import {
  BookingThankYouModal,
  type BookingThankYouModalProps,
} from '@/components/sections/booking-modal/thank-you-modal';

export type ConsultationsThankYouModalProps = Omit<
  BookingThankYouModalProps,
  'analyticsSectionId'
>;

export function ConsultationsThankYouModal(
  props: ConsultationsThankYouModalProps,
) {
  return (
    <BookingThankYouModal
      {...props}
      analyticsSectionId='consultations-booking'
    />
  );
}
