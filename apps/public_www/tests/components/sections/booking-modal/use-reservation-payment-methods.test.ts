import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  getDefaultPaymentMethod,
  resolvePaymentMethodFlags,
  useReservationPaymentMethods,
} from '@/components/sections/booking-modal/use-reservation-payment-methods';

describe('useReservationPaymentMethods', () => {
  it('defaults to fps when all payment options are enabled', () => {
    const flags = resolvePaymentMethodFlags({
      fpsQrEnabled: true,
      bankTransferEnabled: true,
      stripeCardsEnabled: true,
    });

    expect(getDefaultPaymentMethod(flags)).toBe('fps_qr');
  });

  it('resets to default when reservation becomes paid after being free', () => {
    const { result, rerender } = renderHook(
      ({ isFreeReservation }) => useReservationPaymentMethods({ isFreeReservation }),
      { initialProps: { isFreeReservation: true } },
    );

    act(() => {
      result.current.setSelectedPaymentMethod('stripe');
    });
    expect(result.current.selectedPaymentMethod).toBe('stripe');

    rerender({ isFreeReservation: false });
    expect(result.current.selectedPaymentMethod).toBe('fps_qr');
  });
});

describe('resolvePaymentMethodFlags', () => {
  it('enables all methods when none are configured', () => {
    expect(
      resolvePaymentMethodFlags({
        fpsQrEnabled: false,
        bankTransferEnabled: false,
        stripeCardsEnabled: false,
      }),
    ).toEqual({
      fpsQr: true,
      bankTransfer: true,
      stripeCards: true,
    });
  });
});
