import type { FormEvent, RefObject } from 'react';

import {
  BOOKING_RESERVATION_FORM_ANALYTICS_ID,
  PAYMENT_METHOD_FREE,
  PAYMENT_METHOD_FPS,
  PAYMENT_METHOD_STRIPE,
  type PaymentMethodOption,
} from '@/components/sections/booking-modal/reservation-form-types';
import { getPaymentMethodLabel } from '@/components/sections/booking-modal/reservation-payment-helpers';
import type { StripePaymentFieldsHandle } from '@/components/sections/booking-modal/stripe-payment-section';
import type {
  BookingThankYouRecapLabelTemplates,
  BookingTopicsFieldConfig,
  ReservationCourseSession,
  ReservationSummary,
} from '@/components/sections/booking-modal/types';
import type { BookingPaymentModalContent, Locale } from '@/content';
import { formatContentTemplate } from '@/content/content-field-utils';
import { trackEcommerceEvent, trackPublicFormOutcome } from '@/lib/analytics';
import type { DiscountRule } from '@/lib/discounts-data';
import {
  submitReservation,
  type ReservationPaymentMethodCode,
  type ReservationSubmissionPayload,
} from '@/lib/reservations-data';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { ServerSubmissionResult } from '@/lib/server-submission-result';
import { getHrefKind } from '@/lib/url-utils';
import { isValidPhoneForRegion } from '@/lib/public-phone-validation';
import { isValidEmail, sanitizeSingleLineValue } from '@/lib/validation';

export interface ReservationSubmitFormState {
  fullName: string;
  email: string;
  phone: string;
  phoneCountry: string;
  interestedTopics: string;
  hasPendingReservationAcknowledgement: boolean;
  hasTermsAgreement: boolean;
  marketingOptIn: boolean;
  captchaToken: string;
  fpsQrImageDataUrl: string;
}

export interface ReservationSubmitContext {
  analyticsSectionId: string;
  bookingSystem: string;
  cohortId: string;
  consultationLevelLabel: string;
  consultationWritingFocusLabel: string;
  content: BookingPaymentModalContent;
  dateEndTime: string;
  discountAmount: number;
  discountRule: DiscountRule | null;
  eventSubtitle: string;
  eventTitle: string;
  isFreeReservation: boolean;
  isStripePaymentIntentLoading: boolean;
  isStripePaymentMethodSelected: boolean;
  isStripeReady: boolean;
  isTopicsFieldRequired: boolean;
  locale: Locale;
  normalizedCohortDate: string;
  paymentMethodForAnalytics: ReservationPaymentMethodCode;
  requiresServiceInstanceSlug: boolean;
  selectedCohortDateLabel: string;
  selectedDateStartTime: string;
  selectedPaymentMethod: PaymentMethodOption;
  selectedServiceTierLabel: string;
  serviceInstanceSlug: string;
  serviceKey: string;
  serviceTypeLabelKey: 'event' | 'training-course' | 'consultation';
  sessionSlots?: ReservationCourseSession[];
  stripePaymentFieldsRef: RefObject<StripePaymentFieldsHandle | null>;
  thankYouRecapLabels?: BookingThankYouRecapLabelTemplates;
  topicsFieldConfig?: BookingTopicsFieldConfig;
  totalAmount: number;
  venueAddress: string;
  venueDirectionHref: string;
  venueName: string;
}

interface UseReservationSubmitOptions {
  clearSubmissionError: () => void;
  isCaptchaUnavailable: boolean;
  isSubmitting: boolean;
  markCaptchaTouched: () => void;
  markFormInteracted: () => void;
  onSubmitReservation: (summary: ReservationSummary) => void;
  onReservationMetaPixelSuccess: (totalAmount: number) => void;
  setIsAcknowledgementsTouched: (value: boolean) => void;
  setIsEmailTouched: (value: boolean) => void;
  setIsFullNameTouched: (value: boolean) => void;
  setIsPhoneTouched: (value: boolean) => void;
  setIsTopicsTouched: (value: boolean) => void;
  setSubmissionError: (message: string) => void;
  withSubmitting: <T>(fn: () => Promise<T>) => Promise<T>;
}

function buildReservationSummary(
  formState: ReservationSubmitFormState,
  context: ReservationSubmitContext,
): ReservationSummary {
  const {
    content,
    bookingSystem,
    consultationLevelLabel,
    consultationWritingFocusLabel,
    dateEndTime,
    eventSubtitle,
    eventTitle,
    isFreeReservation,
    selectedCohortDateLabel,
    selectedDateStartTime,
    selectedPaymentMethod,
    selectedServiceTierLabel,
    serviceKey,
    serviceTypeLabelKey,
    sessionSlots,
    thankYouRecapLabels,
    totalAmount,
    venueAddress,
    venueDirectionHref,
    venueName,
  } = context;

  const resolvedCourseSessions: ReservationCourseSession[] = [];
  if (sessionSlots && sessionSlots.length > 0) {
    for (const session of sessionSlots) {
      const sessionStart = sanitizeSingleLineValue(session.dateStartTime);
      if (!sessionStart) {
        continue;
      }

      const sessionEnd = sanitizeSingleLineValue(session.dateEndTime ?? '');
      resolvedCourseSessions.push({
        dateStartTime: sessionStart,
        dateEndTime: sessionEnd || undefined,
      });
    }
  } else {
    const fallbackStart = sanitizeSingleLineValue(selectedDateStartTime);
    if (fallbackStart) {
      resolvedCourseSessions.push({
        dateStartTime: fallbackStart,
        dateEndTime: sanitizeSingleLineValue(dateEndTime) || undefined,
      });
    }
  }

  const primarySession = resolvedCourseSessions[0];
  const submitPhoneDigits = sanitizeSingleLineValue(formState.phone).replace(/\D/g, '');

  const detailLines: string[] = [];
  if (thankYouRecapLabels) {
    if (bookingSystem === 'my-best-auntie-booking') {
      const cohort = sanitizeSingleLineValue(selectedCohortDateLabel);
      const serviceTierLine = sanitizeSingleLineValue(selectedServiceTierLabel);
      if (cohort) {
        detailLines.push(
          formatContentTemplate(thankYouRecapLabels.detailCohortLineTemplate, {
            cohort,
          }),
        );
      }
      if (serviceTierLine) {
        detailLines.push(
          formatContentTemplate(thankYouRecapLabels.detailServiceTierLineTemplate, {
            serviceTier: serviceTierLine,
          }),
        );
      }
    } else if (bookingSystem === 'consultation-booking') {
      const focus = sanitizeSingleLineValue(consultationWritingFocusLabel);
      const level = sanitizeSingleLineValue(consultationLevelLabel);
      if (focus) {
        detailLines.push(
          formatContentTemplate(thankYouRecapLabels.detailWritingFocusLineTemplate, {
            label: focus,
          }),
        );
      }
      if (level) {
        detailLines.push(
          formatContentTemplate(thankYouRecapLabels.detailLevelLineTemplate, {
            label: level,
          }),
        );
      }
    }
  }

  return {
    attendeeName: sanitizeSingleLineValue(formState.fullName),
    attendeeEmail: sanitizeSingleLineValue(formState.email),
    attendeePhone: submitPhoneDigits,
    attendeeCountry: formState.phoneCountry,
    serviceKey: sanitizeSingleLineValue(serviceKey) || undefined,
    serviceTypeLabelKey,
    bookingSystem: sanitizeSingleLineValue(bookingSystem) || undefined,
    serviceTier: sanitizeSingleLineValue(selectedServiceTierLabel) || undefined,
    cohort: sanitizeSingleLineValue(selectedCohortDateLabel) || undefined,
    paymentMethod: isFreeReservation
      ? ''
      : sanitizeSingleLineValue(getPaymentMethodLabel(content, selectedPaymentMethod)),
    paymentMethodCode: isFreeReservation ? PAYMENT_METHOD_FREE : selectedPaymentMethod,
    totalAmount: isFreeReservation ? 0 : totalAmount,
    eventTitle: sanitizeSingleLineValue(eventTitle),
    dateStartTime: primarySession?.dateStartTime,
    dateEndTime: primarySession?.dateEndTime,
    sessionSlots: resolvedCourseSessions.length > 0 ? resolvedCourseSessions : undefined,
    eventSubtitle: sanitizeSingleLineValue(eventSubtitle) || undefined,
    ...(!isFreeReservation &&
    selectedPaymentMethod === PAYMENT_METHOD_FPS &&
    formState.fpsQrImageDataUrl.trim()
      ? { fpsQrImageDataUrl: formState.fpsQrImageDataUrl.trim() }
      : {}),
    locationName: sanitizeSingleLineValue(venueName) || undefined,
    locationAddress: sanitizeSingleLineValue(venueAddress) || undefined,
    locationDirectionHref: (() => {
      const href = sanitizeSingleLineValue(venueDirectionHref);
      if (!href || href === '#') {
        return undefined;
      }

      return href;
    })(),
    ...(detailLines.length > 0 ? { detailLines } : {}),
  };
}

function buildReservationPayload(
  formState: ReservationSubmitFormState,
  context: ReservationSubmitContext,
  reservationSummary: ReservationSummary,
  resolvedCourseSessions: ReservationCourseSession[],
  primarySession: ReservationCourseSession | undefined,
): ReservationSubmissionPayload {
  const {
    bookingSystem,
    consultationLevelLabel,
    consultationWritingFocusLabel,
    content,
    discountRule,
    eventTitle,
    isFreeReservation,
    locale,
    normalizedCohortDate,
    selectedCohortDateLabel,
    selectedDateStartTime,
    selectedPaymentMethod,
    selectedServiceTierLabel,
    serviceInstanceSlug,
    serviceKey,
    topicsFieldConfig,
    totalAmount,
    venueAddress,
    venueDirectionHref,
    venueName,
  } = context;

  const scheduleTime = (() => {
    if (!primarySession) {
      return sanitizeSingleLineValue(selectedDateStartTime) || undefined;
    }
    const start = sanitizeSingleLineValue(primarySession.dateStartTime);
    const end = sanitizeSingleLineValue(primarySession.dateEndTime ?? '');
    if (!start) {
      return undefined;
    }
    return end ? `${start} - ${end}` : start;
  })();

  return {
    attendeeName: reservationSummary.attendeeName,
    attendeeEmail: reservationSummary.attendeeEmail,
    attendeePhone: reservationSummary.attendeePhone,
    attendeeCountry: reservationSummary.attendeeCountry,
    ...(reservationSummary.serviceTier ? { serviceTier: reservationSummary.serviceTier } : {}),
    ...(normalizedCohortDate ? { cohortDate: normalizedCohortDate } : {}),
    interestedTopics: sanitizeSingleLineValue(formState.interestedTopics) || undefined,
    discountCode: discountRule?.code || undefined,
    totalAmount: isFreeReservation ? 0 : totalAmount,
    reservationPendingUntilPaymentConfirmed: isFreeReservation
      ? false
      : formState.hasPendingReservationAcknowledgement,
    agreedToTermsAndConditions: formState.hasTermsAgreement,
    paymentMethod: isFreeReservation ? PAYMENT_METHOD_FREE : selectedPaymentMethod,
    stripePaymentIntentId: undefined,
    marketingOptIn: formState.marketingOptIn,
    locale,
    title: sanitizeSingleLineValue(eventTitle) || undefined,
    ...(() => {
      const sanitizedServiceKey = sanitizeSingleLineValue(serviceKey);
      const instanceSlug = sanitizeSingleLineValue(serviceInstanceSlug);
      return {
        serviceKey: sanitizedServiceKey,
        bookingSystem: sanitizeSingleLineValue(bookingSystem) || undefined,
        ...(instanceSlug ? { serviceInstanceSlug: instanceSlug } : {}),
        ...(sanitizeSingleLineValue(selectedCohortDateLabel)
          ? {
              serviceInstanceCohort: sanitizeSingleLineValue(selectedCohortDateLabel),
            }
          : {}),
      };
    })(),
    scheduleDate: sanitizeSingleLineValue(selectedCohortDateLabel) || undefined,
    scheduleTime,
    locationName: sanitizeSingleLineValue(venueName) || undefined,
    locationAddress: sanitizeSingleLineValue(venueAddress) || undefined,
    primarySessionStartIso:
      sanitizeSingleLineValue(primarySession?.dateStartTime) || undefined,
    primarySessionEndIso:
      sanitizeSingleLineValue(primarySession?.dateEndTime ?? '') || undefined,
    ...(() => {
      const focus = sanitizeSingleLineValue(consultationWritingFocusLabel);
      const level = sanitizeSingleLineValue(consultationLevelLabel);
      const questionLabel = sanitizeSingleLineValue(
        topicsFieldConfig?.label ?? content.topicsInterestLabel,
      );
      return {
        ...(focus ? { consultationWritingFocusLabel: focus } : {}),
        ...(level ? { consultationLevelLabel: level } : {}),
        ...(questionLabel ? { commentsFieldLabel: questionLabel } : {}),
      };
    })(),
    ...(() => {
      if (resolvedCourseSessions.length === 0) {
        return {};
      }

      return {
        sessionSlots: resolvedCourseSessions.map((session) => {
          return {
            startIso: session.dateStartTime,
            ...(session.dateEndTime ? { endIso: session.dateEndTime } : {}),
          };
        }),
      };
    })(),
    ...(() => {
      const href = sanitizeSingleLineValue(venueDirectionHref);
      if (!href || href === '#' || getHrefKind(href) !== 'http') {
        return {};
      }

      return { locationUrl: href };
    })(),
  };
}

function trackSubmitError(
  context: ReservationSubmitContext,
  errorType: string,
) {
  trackPublicFormOutcome('booking_submit_error', {
    formKind: 'reservation',
    formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
    sectionId: context.analyticsSectionId,
    ctaLocation: 'reservation_form',
    params: {
      payment_method: context.paymentMethodForAnalytics,
      service_tier: context.selectedServiceTierLabel,
      cohort_date: context.normalizedCohortDate,
      total_amount: context.totalAmount,
      error_type: errorType,
    },
  });
}

export function useReservationSubmit(
  formState: ReservationSubmitFormState,
  context: ReservationSubmitContext,
  options: UseReservationSubmitOptions,
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
        const stripePaymentFields = context.stripePaymentFieldsRef.current;
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
            turnstileToken: formState.captchaToken,
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
