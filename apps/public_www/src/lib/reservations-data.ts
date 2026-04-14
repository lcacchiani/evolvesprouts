import type { CrmApiClient } from '@/lib/crm-api-client';

export const RESERVATIONS_API_PATH = '/v1/legacy/reservations';

/** Machine code for how the attendee will pay; matches booking modal analytics. */
export type ReservationPaymentMethodCode = 'fps_qr' | 'bank_transfer' | 'stripe';

export interface ReservationSubmissionPayload {
  full_name: string;
  email: string;
  phone_number: string;
  cohort_age: string;
  cohort_date: string;
  comments?: string;
  discount_code?: string;
  price: number;
  reservation_pending_until_payment_confirmed: boolean;
  agreed_to_terms_and_conditions: boolean;
  payment_method: ReservationPaymentMethodCode;
  stripe_payment_intent_id?: string;
  marketing_opt_in?: boolean;
  locale?: string;
  course_label?: string;
  /** Stable id for Mailchimp tag segment (e.g. event or cohort id). */
  service_key?: string;
  /** Stable slug when service_key is not used (e.g. product line). */
  course_slug?: string;
  schedule_date_label?: string;
  schedule_time_label?: string;
  /** Consultation booking: writing focus title for confirmation email Details row. */
  consultation_writing_focus_label?: string;
  /** Consultation booking: level title for confirmation email Details row. */
  consultation_level_label?: string;
  /**
   * Label for the free-text question field (topics / notes). Sent for internal sales recap.
   */
  comments_field_label?: string;
  location_name?: string;
  /** Venue address line for confirmation email (combined with location_name). */
  location_address?: string;
  /**
   * Primary session start as ISO 8601 (e.g. from course session datetime).
   * Used for HKT date/time in the confirmation email when the venue is in Hong Kong.
   */
  primary_session_start_iso?: string;
  /** Primary session end as ISO 8601 when known (e.g. multi-hour session). Used for email .ics DTEND. */
  primary_session_end_iso?: string;
  /**
   * PNG data URL from the same FPS QR as the booking modal; backend inlines it
   * in the confirmation email when payment is pending (fps_qr).
   */
  fps_qr_image_data_url?: string;
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
