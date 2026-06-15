import { loadStripe, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getStripePaymentElementAppearance } from '@/components/sections/booking-modal/stripe-appearance';
import type { PaymentMethodFlags } from '@/components/sections/booking-modal/reservation-form-types';
import type { BookingPaymentModalContent } from '@/content';
import { createPublicApiClient } from '@/lib/crm-api-client';
import {
  createReservationPaymentIntent,
  type ReservationPaymentIntentResponse,
} from '@/lib/reservation-payments-data';
import { type DiscountRule } from '@/lib/discounts-data';
import { sanitizeSingleLineValue } from '@/lib/validation';

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

let stripePromiseCache: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> | null {
  const key = STRIPE_PUBLISHABLE_KEY.trim();
  if (!key) {
    return null;
  }
  if (!stripePromiseCache) {
    stripePromiseCache = loadStripe(key);
  }
  return stripePromiseCache;
}

export function isStripeConfigured(): boolean {
  return STRIPE_PUBLISHABLE_KEY.trim().length > 0;
}

export function isStripeUnavailable(): boolean {
  return !isStripeConfigured();
}

interface UseStripePaymentIntentOptions {
  captchaToken: string | null;
  clearSubmissionError: () => void;
  cohortId: string;
  content: BookingPaymentModalContent;
  discountRule: DiscountRule | null;
  isFreeReservation: boolean;
  isStripePaymentMethodSelected: boolean;
  normalizedCohortDate: string;
  paymentIntentServiceKey: string;
  paymentMethodFlags: PaymentMethodFlags;
  selectedServiceTierLabel: string;
  setSubmissionError: (message: string) => void;
  totalAmount: number;
}

export function useStripePaymentIntent({
  captchaToken,
  clearSubmissionError,
  cohortId,
  content,
  discountRule,
  isFreeReservation,
  isStripePaymentMethodSelected,
  normalizedCohortDate,
  paymentIntentServiceKey,
  paymentMethodFlags,
  selectedServiceTierLabel,
  setSubmissionError,
  totalAmount,
}: UseStripePaymentIntentOptions) {
  const [stripePaymentIntent, setStripePaymentIntent] =
    useState<ReservationPaymentIntentResponse | null>(null);
  const [stripePaymentIntentKey, setStripePaymentIntentKey] = useState('');
  const [isStripePaymentIntentLoading, setIsStripePaymentIntentLoading] = useState(false);
  const stripePaymentIntentAbortControllerRef = useRef<AbortController | null>(null);

  const stripePaymentIntentRequestKey = [
    sanitizeSingleLineValue(selectedServiceTierLabel),
    normalizedCohortDate,
    String(totalAmount),
    discountRule?.code ?? '',
    paymentIntentServiceKey,
    sanitizeSingleLineValue(cohortId ?? ''),
  ].join('|');

  const stripeElementsOptions = useMemo<StripeElementsOptions | null>(() => {
    if (!stripePaymentIntent) {
      return null;
    }
    return {
      clientSecret: stripePaymentIntent.client_secret,
      appearance: getStripePaymentElementAppearance(),
    };
  }, [stripePaymentIntent]);

  const isStripeReady = Boolean(
    stripeElementsOptions &&
      stripePaymentIntent &&
      stripePaymentIntentKey === stripePaymentIntentRequestKey,
  );

  useEffect(() => {
    if (isFreeReservation) {
      stripePaymentIntentAbortControllerRef.current?.abort();
      queueMicrotask(() => {
        setStripePaymentIntent(null);
        setStripePaymentIntentKey('');
        setIsStripePaymentIntentLoading(false);
      });
      return;
    }
    if (!paymentMethodFlags.stripeCards) {
      return;
    }
    if (!isStripePaymentMethodSelected) {
      return;
    }
    if (isStripeUnavailable() || !normalizedCohortDate) {
      return;
    }
    if (
      stripePaymentIntent &&
      stripePaymentIntentKey === stripePaymentIntentRequestKey
    ) {
      return;
    }

    const adminApiClient = createPublicApiClient();
    if (!adminApiClient) {
      return;
    }

    stripePaymentIntentAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    stripePaymentIntentAbortControllerRef.current = abortController;
    let isCancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prefetch lifecycle matches legacy reservation form
    setIsStripePaymentIntentLoading(true);
    clearSubmissionError();
    if (!captchaToken) {
      setStripePaymentIntent(null);
      setStripePaymentIntentKey('');
      setIsStripePaymentIntentLoading(false);
      return () => {
        isCancelled = true;
        abortController.abort();
      };
    }
    void createReservationPaymentIntent(adminApiClient, {
      payload: {
        service_tier: sanitizeSingleLineValue(selectedServiceTierLabel) || 'unspecified',
        cohort_date: normalizedCohortDate,
        discount_code: discountRule?.code || undefined,
        service_key: paymentIntentServiceKey,
        cohort_id: sanitizeSingleLineValue(cohortId) || undefined,
        price: totalAmount,
      },
      turnstileToken: captchaToken,
      signal: abortController.signal,
    })
      .then((response) => {
        if (isCancelled) {
          return;
        }
        setStripePaymentIntent(response);
        setStripePaymentIntentKey(stripePaymentIntentRequestKey);
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        setStripePaymentIntent(null);
        setStripePaymentIntentKey('');
        setSubmissionError(content.submitErrorMessage);
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }
        setIsStripePaymentIntentLoading(false);
      });

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [
    captchaToken,
    clearSubmissionError,
    cohortId,
    content.submitErrorMessage,
    discountRule?.code,
    isFreeReservation,
    isStripePaymentMethodSelected,
    normalizedCohortDate,
    paymentIntentServiceKey,
    paymentMethodFlags.stripeCards,
    selectedServiceTierLabel,
    setSubmissionError,
    stripePaymentIntent,
    stripePaymentIntentKey,
    stripePaymentIntentRequestKey,
    totalAmount,
  ]);

  return {
    stripePaymentIntent,
    stripeElementsOptions,
    isStripePaymentIntentLoading,
    isStripeReady,
  };
}
