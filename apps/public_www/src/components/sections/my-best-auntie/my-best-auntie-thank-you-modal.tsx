'use client';

import {
  BookingThankYouModal,
  type BookingThankYouModalProps,
} from '@/components/sections/booking-modal/thank-you-modal';

export type MyBestAuntieThankYouModalProps = Omit<
  BookingThankYouModalProps,
  'analyticsSectionId'
>;

export function MyBestAuntieThankYouModal(props: MyBestAuntieThankYouModalProps) {
  return (
    <BookingThankYouModal
      {...props}
      analyticsSectionId='my-best-auntie-booking'
    />
  );
}
