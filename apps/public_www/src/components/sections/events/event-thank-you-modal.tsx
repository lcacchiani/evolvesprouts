'use client';

import {
  BookingThankYouModal,
  type BookingThankYouModalProps,
} from '@/components/sections/booking-modal/thank-you-modal';

export type EventThankYouModalProps = Omit<
  BookingThankYouModalProps,
  'analyticsSectionId'
>;

export function EventThankYouModal(props: EventThankYouModalProps) {
  return (
    <BookingThankYouModal
      {...props}
      analyticsSectionId='events-booking'
    />
  );
}
