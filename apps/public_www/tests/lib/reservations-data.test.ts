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
        attendeePhone: '85212345678',
        childAgeGroup: '18-24 months',
        packageLabel: 'Standard',
        monthLabel: 'April',
        paymentMethod: 'FPS',
        totalAmount: 9000,
        courseLabel: 'My Best Auntie',
      },
      turnstileToken: 'mock-turnstile-token',
    });

    expect(requestSpy).toHaveBeenCalledWith({
      endpointPath: RESERVATIONS_API_PATH,
      method: 'POST',
      body: expect.objectContaining({
        attendeeName: 'Test User',
        attendeeEmail: 'test@example.com',
      }),
      turnstileToken: 'mock-turnstile-token',
    });
  });
});
