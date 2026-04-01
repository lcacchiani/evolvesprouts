const PAYMENT_OPTION_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const PAYMENT_OPTION_FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseBooleanFlag(value: string | undefined): boolean | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (PAYMENT_OPTION_TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (PAYMENT_OPTION_FALSE_VALUES.has(normalized)) {
    return false;
  }
  return null;
}

export type PublicBookingPaymentOptionFlags = {
  fpsQrEnabled: boolean;
  bankTransferEnabled: boolean;
  stripeCardsEnabled: boolean;
};

export type BookingPaymentOptionFlags = {
  fpsQr: boolean;
  bankTransfer: boolean;
  stripeCards: boolean;
};

/**
 * Runtime payment option toggles should be sourced from environment config,
 * not locale content. Any missing/invalid values default to enabled.
 */
export function getBookingPaymentOptionFlags(): BookingPaymentOptionFlags {
  const fpsQr = parseBooleanFlag(process.env.NEXT_PUBLIC_BOOKING_PAYMENT_OPTION_FPS_QR);
  const bankTransfer = parseBooleanFlag(
    process.env.NEXT_PUBLIC_BOOKING_PAYMENT_OPTION_BANK_TRANSFER,
  );
  const stripeCards = parseBooleanFlag(
    process.env.NEXT_PUBLIC_BOOKING_PAYMENT_OPTION_STRIPE_CARDS,
  );

  const flags: BookingPaymentOptionFlags = {
    fpsQr: fpsQr ?? true,
    bankTransfer: bankTransfer ?? true,
    stripeCards: stripeCards ?? true,
  };
  if (!flags.fpsQr && !flags.bankTransfer && !flags.stripeCards) {
    return { fpsQr: true, bankTransfer: true, stripeCards: true };
  }
  return flags;
}

export function resolvePublicBookingPaymentOptionFlags(): PublicBookingPaymentOptionFlags {
  const flags = getBookingPaymentOptionFlags();
  return {
    fpsQrEnabled: flags.fpsQr,
    bankTransferEnabled: flags.bankTransfer,
    stripeCardsEnabled: flags.stripeCards,
  };
}
