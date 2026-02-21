import type { CrmApiClient } from '@/lib/crm-api-client';

export const RESERVATIONS_API_PATH = '/v1/reservations';

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
