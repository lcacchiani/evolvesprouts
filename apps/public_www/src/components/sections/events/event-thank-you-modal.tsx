'use client';

import {
  MyBestAuntieThankYouModal,
  type MyBestAuntieThankYouModalProps,
} from '@/components/sections/booking-modal/thank-you-modal';

type EventThankYouModalProps = Omit<
  MyBestAuntieThankYouModalProps,
  'analyticsSectionId'
>;

export function EventThankYouModal(props: EventThankYouModalProps) {
  return (
    <MyBestAuntieThankYouModal
      {...props}
      analyticsSectionId='events-booking'
    />
  );
}
