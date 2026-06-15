import { trackAnalyticsEvent, trackEcommerceEvent } from '@/lib/analytics';

interface BookingCheckoutItem {
  item_id: string;
  item_name: string;
  item_category: string;
  price: number;
  quantity: number;
}

interface TrackBookingBeginCheckoutOptions {
  sectionId: string;
  ctaLocation: string;
  value: number;
  items: BookingCheckoutItem[];
  serviceTier?: string;
  cohortLabel?: string;
  cohortDate?: string;
}

export function trackBookingBeginCheckout({
  sectionId,
  ctaLocation,
  value,
  items,
  serviceTier = '',
  cohortLabel = '',
  cohortDate = '',
}: TrackBookingBeginCheckoutOptions) {
  trackAnalyticsEvent('booking_modal_open', {
    sectionId,
    ctaLocation,
    params: {
      service_tier: serviceTier,
      cohort_label: cohortLabel,
      cohort_date: cohortDate,
    },
  });
  trackEcommerceEvent('begin_checkout', {
    value,
    items,
  });
}
