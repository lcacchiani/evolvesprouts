import type { BookingPaymentModalContent } from '@/content';
import {
  BANK_DETAIL_PLACEHOLDER,
  PAYMENT_METHOD_BANK_TRANSFER,
  PAYMENT_METHOD_STRIPE,
  type PaymentMethodOption,
} from '@/components/sections/booking-modal/reservation-form-types';

const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME ?? '';
const BANK_ACCOUNT_HOLDER = process.env.NEXT_PUBLIC_BANK_ACCOUNT_HOLDER ?? '';
const BANK_ACCOUNT_NUMBER = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER ?? '';

export function getPaymentMethodLabel(
  content: BookingPaymentModalContent,
  selectedPaymentMethod: PaymentMethodOption,
): string {
  if (selectedPaymentMethod === PAYMENT_METHOD_STRIPE) {
    return content.paymentMethodStripeValue;
  }

  if (selectedPaymentMethod === PAYMENT_METHOD_BANK_TRANSFER) {
    return content.paymentMethodBankTransferValue;
  }

  return content.paymentMethodValue;
}

export function getBankTransferDetails(content: BookingPaymentModalContent) {
  return [
    {
      label: content.paymentBankNameLabel,
      value: BANK_NAME.trim() || BANK_DETAIL_PLACEHOLDER,
    },
    {
      label: content.paymentBankAccountHolderLabel,
      value: BANK_ACCOUNT_HOLDER.trim() || BANK_DETAIL_PLACEHOLDER,
    },
    {
      label: content.paymentBankAccountNumberLabel,
      value: BANK_ACCOUNT_NUMBER.trim() || BANK_DETAIL_PLACEHOLDER,
    },
  ];
}

export function getSubmitButtonLabel(
  content: BookingPaymentModalContent,
  selectedPaymentMethod: PaymentMethodOption,
): string {
  if (selectedPaymentMethod === PAYMENT_METHOD_STRIPE) {
    return content.submitStripeLabel;
  }
  return content.submitLabel;
}
