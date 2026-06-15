import type { ReservationPaymentMethodCode } from '@/lib/reservations-data';

export const CAPTCHA_ERROR_MESSAGE_ID = 'booking-modal-captcha-error-message';
export const SUBMIT_ERROR_MESSAGE_ID = 'booking-modal-submit-error-message';
export const ACKNOWLEDGEMENT_ERROR_MESSAGE_ID = 'booking-modal-acknowledgement-error-message';
export const FPS_ICON_SOURCE = '/images/fps-logo.svg';
export const BANK_ICON_SOURCE = '/images/bank.svg';
export const STRIPE_CARD_ICON_SOURCE = '/images/credit-cards.svg';
export const BANK_DETAIL_PLACEHOLDER = '--';
export const PAYMENT_METHOD_FPS = 'fps_qr';
export const PAYMENT_METHOD_BANK_TRANSFER = 'bank_transfer';
export const PAYMENT_METHOD_STRIPE = 'stripe';
export const PAYMENT_METHOD_FREE = 'free';
export const BOOKING_RESERVATION_FORM_ANALYTICS_ID = 'booking-reservation-form';

export type PaymentMethodOption = ReservationPaymentMethodCode;

export type PaymentMethodFlags = {
  fpsQr: boolean;
  bankTransfer: boolean;
  stripeCards: boolean;
};
