import type { CrmApiClient } from '@/lib/crm-api-client';

export const RESERVATIONS_API_PATH = '/v1/reservations';

export interface ReservationSubmissionPayload {
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  childAgeGroup: string;
  packageLabel: string;
  monthLabel: string;
  paymentMethod: string;
  totalAmount: number;
  courseLabel: string;
  scheduleDateLabel?: string;
  scheduleTimeLabel?: string;
  interestedTopics?: string;
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
  });
}
