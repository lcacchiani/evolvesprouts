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
  location_name?: string;
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
