import {
  BOOKING_RESERVATION_FORM_ANALYTICS_ID,
  PAYMENT_METHOD_FREE,
  PAYMENT_METHOD_FPS,
} from '@/components/sections/booking-modal/reservation-form-types';
import { getPaymentMethodLabel } from '@/components/sections/booking-modal/reservation-payment-helpers';
import type {
  ReservationSubmitContext,
  ReservationSubmitFormState,
} from '@/components/sections/booking-modal/reservation-submit-types';
import type {
  ReservationCourseSession,
  ReservationSummary,
} from '@/components/sections/booking-modal/types';
import { formatContentTemplate } from '@/content/content-field-utils';
import { trackPublicFormOutcome } from '@/lib/analytics';
import type { ReservationSubmissionPayload } from '@/lib/reservations-data';
import { getHrefKind } from '@/lib/url-utils';
import { sanitizeSingleLineValue } from '@/lib/validation';

export function buildReservationSummary(
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

export function buildReservationPayload(
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
      sanitizeSingleLineValue(primarySession?.dateStartTime ?? '') || undefined,
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

export function trackSubmitError(
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
