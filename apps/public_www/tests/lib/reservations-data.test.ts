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
        attendeeName: 'Test User',
        attendeeEmail: 'test@example.com',
        attendeePhone: '91234567',
        attendeeCountry: 'HK',
        serviceTier: '18-24 months',
        cohortDate: '2026-04-08',
        interestedTopics: 'Please share more details.',
        discountCode: 'SPRING10',
        totalAmount: 9000,
        reservationPendingUntilPaymentConfirmed: true,
        agreedToTermsAndConditions: true,
        paymentMethod: 'stripe',
        stripePaymentIntentId: 'pi_test_123',
        serviceKey: 'cohort-or-event-id',
      },
      turnstileToken: 'mock-turnstile-token',
    });

    expect(requestSpy).toHaveBeenCalledWith({
      endpointPath: RESERVATIONS_API_PATH,
      method: 'POST',
      body: expect.objectContaining({
        attendeeName: 'Test User',
        attendeeEmail: 'test@example.com',
        stripePaymentIntentId: 'pi_test_123',
        serviceKey: 'cohort-or-event-id',
      }),
      turnstileToken: 'mock-turnstile-token',
      expectedSuccessStatuses: [200, 202],
    });
  });

  it('submits reservation without serviceTier when omitted from payload', async () => {
    const requestSpy = vi.fn().mockResolvedValue({ status: 'ok' });
    const client = { request: requestSpy };

    await submitReservation(client, {
      payload: {
        attendeeName: 'Test User',
        attendeeEmail: 'test@example.com',
        attendeePhone: '91234567',
        cohortDate: '2026-04-08',
        totalAmount: 100,
        reservationPendingUntilPaymentConfirmed: false,
        agreedToTermsAndConditions: true,
        paymentMethod: 'free',
      },
      turnstileToken: 'mock-turnstile-token',
    });

    const call = requestSpy.mock.calls[0]?.[0] as { body: Record<string, unknown> };
    expect(call.body).not.toHaveProperty('serviceTier');
  });
});
