'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';
import { forwardRef, useImperativeHandle, type RefObject } from 'react';

import { getStripePromise } from '@/components/sections/booking-modal/use-stripe-payment-intent';

export interface StripePaymentFieldsHandle {
  confirmPayment: () => Promise<
    | {
        paymentIntentId: string;
      }
    | {
        errorMessage: string;
      }
  >;
}

interface StripePaymentFieldsProps {
  fallbackErrorMessage: string;
}

const StripePaymentFields = forwardRef<StripePaymentFieldsHandle, StripePaymentFieldsProps>(
  function StripePaymentFields({ fallbackErrorMessage }, ref) {
    const stripe = useStripe();
    const elements = useElements();

    useImperativeHandle(ref, () => {
      return {
        async confirmPayment() {
          if (!stripe || !elements) {
            return { errorMessage: fallbackErrorMessage };
          }

          const confirmation = await stripe.confirmPayment({
            elements,
            confirmParams: {
              return_url: window.location.href,
            },
            redirect: 'if_required',
          });

          if (confirmation.error) {
            return {
              errorMessage: confirmation.error.message?.trim() || fallbackErrorMessage,
            };
          }

          if (!confirmation.paymentIntent || confirmation.paymentIntent.status !== 'succeeded') {
            return {
              errorMessage: fallbackErrorMessage,
            };
          }

          return {
            paymentIntentId: confirmation.paymentIntent.id,
          };
        },
      };
    }, [elements, fallbackErrorMessage, stripe]);

    return (
      <PaymentElement
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card'],
          wallets: {
            applePay: 'never',
            googlePay: 'never',
          },
        }}
      />
    );
  },
);

interface StripePaymentSectionProps {
  fieldsRef: RefObject<StripePaymentFieldsHandle | null>;
  paymentIntentId: string;
  stripeElementsOptions: StripeElementsOptions;
  fallbackErrorMessage: string;
}

export function StripePaymentSection({
  fieldsRef,
  paymentIntentId,
  stripeElementsOptions,
  fallbackErrorMessage,
}: StripePaymentSectionProps) {
  const stripePromise = getStripePromise();

  if (!stripePromise) {
    return null;
  }

  return (
    <Elements
      key={paymentIntentId}
      stripe={stripePromise}
      options={stripeElementsOptions}
    >
      <StripePaymentFields ref={fieldsRef} fallbackErrorMessage={fallbackErrorMessage} />
    </Elements>
  );
}
