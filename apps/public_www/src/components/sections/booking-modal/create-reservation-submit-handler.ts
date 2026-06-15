import type { FormEvent, RefObject } from 'react';

import {
  BOOKING_RESERVATION_FORM_ANALYTICS_ID,
  PAYMENT_METHOD_FPS,
} from '@/components/sections/booking-modal/reservation-form-types';
import type { StripePaymentFieldsHandle } from '@/components/sections/booking-modal/stripe-payment-section';
import {
  buildReservationPayload,
  buildReservationSummary,
  trackSubmitError,
} from '@/components/sections/booking-modal/reservation-submit-helpers';
import type {
  CreateReservationSubmitHandlerOptions,
  ReservationSubmitContext,
  ReservationSubmitFormState,
} from '@/components/sections/booking-modal/reservation-submit-types';
import { trackEcommerceEvent, trackPublicFormOutcome } from '@/lib/analytics';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { submitReservation } from '@/lib/reservations-data';
import { ServerSubmissionResult } from '@/lib/server-submission-result';
import { isValidPhoneForRegion } from '@/lib/public-phone-validation';
import { isValidEmail, sanitizeSingleLineValue } from '@/lib/validation';

export type {
  CreateReservationSubmitHandlerOptions,
  ReservationSubmitContext,
  ReservationSubmitFormState,
} from '@/components/sections/booking-modal/reservation-submit-types';

export function createReservationSubmitHandler(
  formState: ReservationSubmitFormState,
  context: ReservationSubmitContext,
  options: CreateReservationSubmitHandlerOptions,
  stripePaymentFieldsRef: RefObject<StripePaymentFieldsHandle | null>,
) {
  const {
    clearSubmissionError,
    isCaptchaUnavailable,
    isSubmitting,
    markCaptchaTouched,
    markFormInteracted,
    onSubmitReservation,
    onReservationMetaPixelSuccess,
    setIsAcknowledgementsTouched,
    setIsEmailTouched,
    setIsFullNameTouched,
    setIsPhoneTouched,
    setIsTopicsTouched,
    setSubmissionError,
    withSubmitting,
  } = options;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setIsFullNameTouched(true);
    setIsEmailTouched(true);
    setIsPhoneTouched(true);
    if (context.isTopicsFieldRequired) {
      setIsTopicsTouched(true);
    }
    setIsAcknowledgementsTouched(true);
    markCaptchaTouched();
    markFormInteracted();
    clearSubmissionError();

    trackPublicFormOutcome('booking_submit_attempt', {
      formKind: 'reservation',
      formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
      sectionId: context.analyticsSectionId,
      ctaLocation: 'reservation_form',
      params: {
        payment_method: context.paymentMethodForAnalytics,
        service_tier: context.selectedServiceTierLabel,
        cohort_date: context.normalizedCohortDate,
        cohort_label: context.selectedCohortDateLabel,
        total_amount: context.totalAmount,
        discount_amount: context.discountRule ? context.discountAmount : undefined,
        discount_type: context.discountRule ? context.discountRule.type : undefined,
      },
    });

    const normalizedFullName = sanitizeSingleLineValue(formState.fullName);
    const normalizedPhone = sanitizeSingleLineValue(formState.phone);
    const submitPhoneDigits = normalizedPhone.replace(/\D/g, '');
    const hasFieldErrors =
      !normalizedFullName ||
      !isValidEmail(formState.email) ||
      !normalizedPhone ||
      submitPhoneDigits.length === 0 ||
      !isValidPhoneForRegion(formState.phone, formState.phoneCountry) ||
      (context.isTopicsFieldRequired && !formState.interestedTopics.trim()) ||
      (!context.isFreeReservation && !formState.hasPendingReservationAcknowledgement) ||
      !formState.hasTermsAgreement;

    if (hasFieldErrors) {
      trackSubmitError(context, 'validation_error');
      return;
    }

    const sanitizedSubmitServiceKey = sanitizeSingleLineValue(context.serviceKey);
    const sanitizedSubmitInstanceSlug = sanitizeSingleLineValue(context.serviceInstanceSlug);
    if (
      !sanitizedSubmitServiceKey ||
      (context.requiresServiceInstanceSlug && !sanitizedSubmitInstanceSlug)
    ) {
      trackSubmitError(context, 'service_key_missing');
      setSubmissionError(context.content.bookingUnavailableLabel);
      return;
    }

    if (isCaptchaUnavailable) {
      trackSubmitError(context, 'service_unavailable');
      return;
    }
    if (!formState.captchaToken) {
      trackSubmitError(context, 'validation_error');
      return;
    }
    if (
      context.isStripePaymentMethodSelected &&
      (context.isStripePaymentIntentLoading || !context.isStripeReady)
    ) {
      trackSubmitError(context, 'validation_error');
      setSubmissionError(context.content.submitErrorMessage);
      return;
    }

    if (!context.selectedCohortDateLabel) {
      trackSubmitError(context, 'validation_error');
      return;
    }

    const reservationSummary = buildReservationSummary(formState, context);
    const resolvedCourseSessions = reservationSummary.sessionSlots ?? [];
    const primarySession = resolvedCourseSessions[0];

    const crmApiClient = createPublicCrmApiClient();
    if (!crmApiClient || !formState.captchaToken) {
      trackSubmitError(context, 'service_unavailable');
      setSubmissionError(context.content.submitErrorMessage);
      return;
    }
    const turnstileToken = formState.captchaToken;

    const reservationPayload = buildReservationPayload(
      formState,
      context,
      reservationSummary,
      resolvedCourseSessions,
      primarySession,
    );

    await withSubmitting(async () => {
      let stripePaymentIntentId: string | undefined;
      if (!context.isFreeReservation && context.isStripePaymentMethodSelected) {
        const stripePaymentFields = stripePaymentFieldsRef.current;
        if (!stripePaymentFields) {
          trackSubmitError(context, 'validation_error');
          setSubmissionError(context.content.submitErrorMessage);
          return;
        }
        const stripeConfirmation = await stripePaymentFields.confirmPayment();
        if ('errorMessage' in stripeConfirmation) {
          trackSubmitError(context, 'payment_error');
          setSubmissionError(stripeConfirmation.errorMessage);
          return;
        }
        stripePaymentIntentId = stripeConfirmation.paymentIntentId;
        reservationPayload.stripePaymentIntentId = stripePaymentIntentId;
      }

      if (
        !context.isFreeReservation &&
        context.selectedPaymentMethod === PAYMENT_METHOD_FPS &&
        !reservationPayload.stripePaymentIntentId &&
        formState.fpsQrImageDataUrl.trim()
      ) {
        reservationPayload.fpsQrImageDataUrl = formState.fpsQrImageDataUrl.trim();
      }

      const submissionResult = await ServerSubmissionResult.resolve({
        request: () =>
          submitReservation(crmApiClient, {
            payload: reservationPayload,
            turnstileToken,
          }),
        failureMessage: context.content.submitErrorMessage,
      });
      if (submissionResult.isSuccess) {
        trackPublicFormOutcome('booking_submit_success', {
          formKind: 'reservation',
          formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
          sectionId: context.analyticsSectionId,
          ctaLocation: 'reservation_form',
          params: {
            payment_method: context.paymentMethodForAnalytics,
            service_tier: context.selectedServiceTierLabel,
            cohort_date: context.normalizedCohortDate,
            cohort_label: context.selectedCohortDateLabel,
            total_amount: context.totalAmount,
            discount_amount: context.discountAmount,
            discount_type: context.discountRule?.type,
          },
        });
        onReservationMetaPixelSuccess(context.isFreeReservation ? 0 : context.totalAmount);
        trackEcommerceEvent('purchase', {
          value: context.isFreeReservation ? 0 : context.totalAmount,
          paymentType: context.paymentMethodForAnalytics,
          transactionId: stripePaymentIntentId ?? `${context.normalizedCohortDate}-${Date.now()}`,
          items: [{
            item_id: `mba-${context.selectedServiceTierLabel}`,
            item_name: context.eventTitle,
            item_category: context.selectedServiceTierLabel,
            price: context.isFreeReservation ? 0 : context.totalAmount,
            quantity: 1,
          }],
        });
        onSubmitReservation(reservationSummary);
        return;
      }

      trackSubmitError(context, 'api_error');
      setSubmissionError(submissionResult.errorMessage);
    });
  }

  return { handleSubmit };
}
