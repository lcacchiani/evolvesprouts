import { describe, expect, it, vi } from 'vitest';

import {
  RESERVATION_PAYMENT_INTENT_API_PATH,
  createReservationPaymentIntent,
} from '@/lib/reservation-payments-data';

describe('reservation-payments-data', () => {
  it('creates reservation payment intent with turnstile token header', async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      payment_intent_id: 'pi_test_123',
      client_secret: 'pi_test_123_secret_abc',
    });
    const client = {
      request: requestSpy,
    };

    await expect(createReservationPaymentIntent(client, {
      payload: {
        service_tier: '18-24 months',
        cohort_date: '2026-04-08',
        discount_code: 'SPRING10',
        price: 9000,
      },
      turnstileToken: 'mock-turnstile-token',
    })).resolves.toEqual({
      payment_intent_id: 'pi_test_123',
      client_secret: 'pi_test_123_secret_abc',
    });

    expect(requestSpy).toHaveBeenCalledWith({
      endpointPath: RESERVATION_PAYMENT_INTENT_API_PATH,
      method: 'POST',
      body: {
        service_tier: '18-24 months',
        cohort_date: '2026-04-08',
        discount_code: 'SPRING10',
        price: 9000,
      },
      turnstileToken: 'mock-turnstile-token',
      signal: undefined,
      expectedSuccessStatuses: [200],
    });
  });
});
