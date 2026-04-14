import type { CrmApiClient } from '@/lib/crm-api-client';

export const RESERVATIONS_API_PATH = '/v1/reservations';

/** Machine code for how the attendee will pay; matches booking modal analytics. */
export type ReservationPaymentMethodCode = 'fps_qr' | 'bank_transfer' | 'stripe';

export interface ReservationSubmissionPayload {
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  childAgeGroup: string;
  cohortDate: string;
  interestedTopics?: string;
  discountCode?: string;
  totalAmount: number;
  reservationPendingUntilPaymentConfirmed: boolean;
  agreedToTermsAndConditions: boolean;
  paymentMethod: ReservationPaymentMethodCode;
  stripePaymentIntentId?: string;
  marketingOptIn?: boolean;
  locale?: string;
  courseLabel?: string;
  /** Stable id for Mailchimp tag segment (e.g. event or cohort id). */
  serviceKey?: string;
  /** Stable slug when serviceKey is not used (e.g. product line). */
  courseSlug?: string;
  scheduleDateLabel?: string;
  scheduleTimeLabel?: string;
  /** Consultation booking: writing focus title for confirmation email Details row. */
  consultationWritingFocusLabel?: string;
  /** Consultation booking: level title for confirmation email Details row. */
  consultationLevelLabel?: string;
  /**
   * Label for the free-text question field (topics / notes). Sent for internal sales recap.
   */
  commentsFieldLabel?: string;
  locationName?: string;
  /** Venue address line for confirmation email (combined with locationName). */
  locationAddress?: string;
  /**
   * Primary session start as ISO 8601 (e.g. from course session datetime).
   * Used for HKT date/time in the confirmation email when the venue is in Hong Kong.
   */
  primarySessionStartIso?: string;
  /** Primary session end as ISO 8601 when known (e.g. multi-hour session). Used for email .ics DTEND. */
  primarySessionEndIso?: string;
  /** All session parts for multi-line schedule in confirmation email (MBA, etc.). */
  courseSessions?: Array<{ startIso: string; endIso?: string }>;
  /** Maps URL for optional "Get directions" link in confirmation email. */
  locationUrl?: string;
  /**
   * PNG data URL from the same FPS QR as the booking modal; backend inlines it
   * in the confirmation email when payment is pending (fps_qr).
   */
  fpsQrImageDataUrl?: string;
}

interface SubmitReservationOptions {
  payload: ReservationSubmissionPayload;
  turnstileToken: string;
}

export async function submitReservation(
  crmApiClient: CrmApiClient,
  options: SubmitReservationOptions,
): Promise<void> {
  await crmApiClient.request({
    endpointPath: RESERVATIONS_API_PATH,
    method: 'POST',
    body: options.payload,
    turnstileToken: options.turnstileToken,
    expectedSuccessStatuses: [200, 202],
  });
}
