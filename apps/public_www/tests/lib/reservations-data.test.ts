import { describe, expect, it, vi } from 'vitest';

import {
  RESERVATIONS_API_PATH,
  submitReservation,
} from '@/lib/reservations-data';

describe('reservations-data', () => {
  it('submits reservation payload with turnstile token', async () => {
    const requestSpy = vi.fn().mockResolvedValue({ status: 'ok' });
    const client = {
      request: requestSpy,
    };

    await submitReservation(client, {
      payload: {
        full_name: 'Test User',
        email: 'test@example.com',
        phone_number: '85212345678',
        cohort_age: '18-24 months',
        cohort_date: '2026-04-08',
        comments: 'Please share more details.',
        discount_code: 'SPRING10',
        price: 9000,
        reservation_pending_until_payment_confirmed: true,
        agreed_to_terms_and_conditions: true,
      },
      turnstileToken: 'mock-turnstile-token',
    });

    expect(requestSpy).toHaveBeenCalledWith({
      endpointPath: RESERVATIONS_API_PATH,
      method: 'POST',
      body: expect.objectContaining({
        full_name: 'Test User',
        email: 'test@example.com',
      }),
      turnstileToken: 'mock-turnstile-token',
      expectedSuccessStatuses: [200, 202],
    });
  });
});
