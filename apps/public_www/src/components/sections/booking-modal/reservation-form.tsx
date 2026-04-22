import Image from 'next/image';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js';
import {
  type FormEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ReservationFormDiscountCodeInput } from '@/components/sections/booking-modal/reservation-form-discount-code-input';
import {
  BOOKING_EMAIL_ERROR_MESSAGE_ID,
  BOOKING_FULL_NAME_ERROR_MESSAGE_ID,
  BOOKING_PHONE_ERROR_MESSAGE_ID,
  BOOKING_PHONE_INVALID_COUNTRY_ERROR_MESSAGE_ID,
  BOOKING_TOPICS_ERROR_MESSAGE_ID,
  ReservationFormFields,
} from '@/components/sections/booking-modal/reservation-form-fields';
import { ReservationFormPriceBreakdown } from '@/components/sections/booking-modal/reservation-form-price-breakdown';
import { DiscountBadge, FpsQrCode } from '@/components/sections/booking-modal/shared';
import type {
  BookingThankYouRecapLabelTemplates,
  BookingTopicsFieldConfig,
  ReservationCourseSession,
  ReservationSummary,
} from '@/components/sections/booking-modal/types';
import {
  resolveCaptchaErrorMessage,
  useFormSubmission,
} from '@/components/sections/shared/use-form-submission';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import {
  SubmitButtonLoadingContent,
  submitButtonClassName,
} from '@/components/shared/submit-button-loading-content';
import { SmartLink } from '@/components/shared/smart-link';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import { trackAnalyticsEvent, trackEcommerceEvent, trackPublicFormOutcome } from '@/lib/analytics';
import {
  parseHexColorRgb,
  resolveCssColorToken,
  rgbaFromCssColor,
} from '@/lib/css-token-utils';
import {
  SITE_PRIMARY_FONT_STACK,
  STRIPE_APPEARANCE_CSS_VARS,
  STRIPE_APPEARANCE_FALLBACK_HEX,
} from '@/lib/design-tokens';
import { trackMetaPixelEvent, type MetaPixelContentName } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import { applyDiscount } from '@/components/sections/booking-modal/helpers';
import type { BookingPaymentModalContent, Locale } from '@/content';
import { formatContentTemplate } from '@/content/content-field-utils';
import {
  createPublicApiClient,
  createPublicCrmApiClient,
} from '@/lib/crm-api-client';
import { type DiscountRule, validateDiscountCode } from '@/lib/discounts-data';
import {
  createReservationPaymentIntent,
  type ReservationPaymentIntentResponse,
} from '@/lib/reservation-payments-data';
import {
  resolvePublicBookingPaymentOptionFlags,
  type PublicBookingPaymentOptionFlags,
} from '@/lib/booking-payment-options';
import {
  submitReservation,
  type ReservationPaymentMethodCode,
  type ReservationSubmissionPayload,
} from '@/lib/reservations-data';
import { ServerSubmissionResult } from '@/lib/server-submission-result';
import { getHrefKind } from '@/lib/url-utils';
import { isValidPhoneForRegion } from '@/lib/public-phone-validation';
import { isValidEmail, sanitizeSingleLineValue } from '@/lib/validation';

interface BookingReservationFormProps {
  locale: Locale;
  content: BookingPaymentModalContent;
  eventTitle: string;
  /** Stable id for reservation payload / Mailchimp booking tag (e.g. cohort or event id). */
  reservationServiceKey?: string;
  /** Optional cohort identifier for Stripe metadata (e.g. MBA cohort id). */
  cohortId?: string;
  /** Stable slug when reservationServiceKey is not set (e.g. my-best-auntie, consultation tier). */
  courseSlug?: string;
  eventSubtitle?: string;
  courseSessions?: ReservationCourseSession[];
  selectedAgeGroupLabel: string;
  selectedCohortDateLabel: string;
  selectedDateStartTime: string;
  originalPriceAmount: number;
  venueName?: string;
  venueAddress?: string;
  venueDirectionHref?: string;
  dateEndTime?: string;
  topicsFieldConfig?: BookingTopicsFieldConfig;
  topicsPrefill?: string;
  /** Consultation flow: optional labels for confirmation email Details row. */
  consultationWritingFocusLabel?: string;
  consultationLevelLabel?: string;
  /** Templates for thank-you recap detail lines (from `bookingModal.thankYouModal`). */
  thankYouRecapLabels?: BookingThankYouRecapLabelTemplates;
  descriptionId: string;
  analyticsSectionId?: string;
  metaPixelContentName?: MetaPixelContentName;
  captchaWidgetAction?: string;
  /** When set, included in discount validate API as `service_key` (public slug). */
  discountValidationServiceKey?: string;
  /** Optional Aurora instance UUID for instance-scoped discount redemption. */
  serviceInstanceId?: string | null;
  prefilledDiscountCode?: string;
  referralAppliedNote?: string;
  referralAppliedAnnouncement?: string;
  onSubmitReservation: (summary: ReservationSummary) => void;
}

const CAPTCHA_ERROR_MESSAGE_ID = 'booking-modal-captcha-error-message';
const SUBMIT_ERROR_MESSAGE_ID = 'booking-modal-submit-error-message';
const ACKNOWLEDGEMENT_ERROR_MESSAGE_ID = 'booking-modal-acknowledgement-error-message';
const FPS_ICON_SOURCE = '/images/fps-logo.svg';
const BANK_ICON_SOURCE = '/images/bank.svg';
const STRIPE_CARD_ICON_SOURCE = '/images/credit-cards.svg';
const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME ?? '';
const BANK_ACCOUNT_HOLDER = process.env.NEXT_PUBLIC_BANK_ACCOUNT_HOLDER ?? '';
const BANK_ACCOUNT_NUMBER = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER ?? '';
const BANK_DETAIL_PLACEHOLDER = '--';
const PAYMENT_METHOD_FPS = 'fps_qr';
const PAYMENT_METHOD_BANK_TRANSFER = 'bank_transfer';
const PAYMENT_METHOD_STRIPE = 'stripe';
const PAYMENT_METHOD_FREE = 'free';
const BOOKING_RESERVATION_FORM_ANALYTICS_ID = 'booking-reservation-form';
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise = STRIPE_PUBLISHABLE_KEY.trim()
  ? loadStripe(STRIPE_PUBLISHABLE_KEY.trim())
  : null;

function getStripePaymentElementAppearance(): NonNullable<StripeElementsOptions['appearance']> {
  const primaryRgbFallback = parseHexColorRgb(STRIPE_APPEARANCE_FALLBACK_HEX.brandOrange) ?? {
    r: 200,
    g: 74,
    b: 22,
  };
  const dangerRgbFallback = parseHexColorRgb(STRIPE_APPEARANCE_FALLBACK_HEX.textDangerStrong) ?? {
    r: 180,
    g: 35,
    b: 24,
  };

  const colorPrimary = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.brandOrange,
    STRIPE_APPEARANCE_FALLBACK_HEX.brandOrange,
  );
  const colorBackground = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.surfaceWhite,
    STRIPE_APPEARANCE_FALLBACK_HEX.surfaceWhite,
  );
  const colorBackgroundMuted = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.surfaceMuted,
    STRIPE_APPEARANCE_FALLBACK_HEX.surfaceMuted,
  );
  const colorText = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.textHeading,
    STRIPE_APPEARANCE_FALLBACK_HEX.textHeading,
  );
  const colorTextSecondary = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.textNeutralStrong,
    STRIPE_APPEARANCE_FALLBACK_HEX.textNeutralStrong,
  );
  const colorTextPlaceholder = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.textPlaceholder,
    STRIPE_APPEARANCE_FALLBACK_HEX.textPlaceholder,
  );
  const colorDanger = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.textDangerStrong,
    STRIPE_APPEARANCE_FALLBACK_HEX.textDangerStrong,
  );
  const borderInput = resolveCssColorToken(
    STRIPE_APPEARANCE_CSS_VARS.borderInput,
    STRIPE_APPEARANCE_FALLBACK_HEX.borderInput,
  );

  const focusRingPrimary = rgbaFromCssColor(colorPrimary, 0.55, primaryRgbFallback);
  const focusRingDanger = rgbaFromCssColor(colorDanger, 0.55, dangerRgbFallback);
  const focusRingPrimaryStrong = rgbaFromCssColor(colorPrimary, 0.65, primaryRgbFallback);

  return {
    theme: 'stripe',
    variables: {
      colorPrimary,
      colorBackground,
      colorText,
      colorTextSecondary,
      colorTextPlaceholder,
      colorDanger,
      fontFamily: SITE_PRIMARY_FONT_STACK,
      fontSizeBase: '14px',
      borderRadius: '10px',
      spacingUnit: '4px',
    },
    rules: {
      '.Label': {
        color: colorText,
        fontWeight: '600',
      },
      '.Input': {
        border: `1px solid ${borderInput}`,
        boxShadow: 'none',
        color: colorText,
      },
      '.Input::placeholder': {
        color: colorTextPlaceholder,
      },
      '.Input:focus': {
        borderColor: colorPrimary,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 3px ${focusRingPrimary}`,
      },
      '.Input:focus-visible': {
        borderColor: colorPrimary,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 3px ${focusRingPrimary}`,
      },
      '.Input--invalid': {
        borderColor: colorDanger,
        boxShadow: 'none',
      },
      '.Input--invalid:focus': {
        borderColor: colorDanger,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 3px ${focusRingDanger}`,
      },
      '.Error': {
        color: colorDanger,
      },
      '.Block': {
        border: 'none',
        boxShadow: 'none',
        backgroundColor: 'transparent',
      },
      '.Tab': {
        border: `1px solid ${borderInput}`,
        backgroundColor: colorBackgroundMuted,
        color: colorText,
      },
      '.Tab:hover': {
        backgroundColor: colorBackground,
        color: colorText,
      },
      '.Tab:focus': {
        borderColor: colorPrimary,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 3px ${focusRingPrimary}`,
      },
      '.Tab:focus-visible': {
        borderColor: colorPrimary,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 3px ${focusRingPrimary}`,
      },
      '.Tab--selected': {
        backgroundColor: colorBackground,
        borderColor: colorPrimary,
        boxShadow: `0 0 0 1px ${colorBackground}, 0 0 0 2px ${focusRingPrimaryStrong}`,
        color: colorText,
      },
      '.TabIcon': {
        color: colorTextSecondary,
      },
      '.TabIcon--selected': {
        color: colorPrimary,
      },
    },
  };
}

type PaymentMethodOption = ReservationPaymentMethodCode;

type PaymentMethodFlags = {
  fpsQr: boolean;
  bankTransfer: boolean;
  stripeCards: boolean;
};

function resolvePaymentMethodFlags(
  flags: PublicBookingPaymentOptionFlags,
): PaymentMethodFlags {
  let fpsQr = flags.fpsQrEnabled;
  let bankTransfer = flags.bankTransferEnabled;
  let stripeCards = flags.stripeCardsEnabled;
  if (!fpsQr && !bankTransfer && !stripeCards) {
    fpsQr = true;
    bankTransfer = true;
    stripeCards = true;
  }
  return { fpsQr, bankTransfer, stripeCards };
}

function getDefaultPaymentMethod(flags: PaymentMethodFlags): PaymentMethodOption {
  if (flags.fpsQr) {
    return PAYMENT_METHOD_FPS;
  }
  if (flags.bankTransfer) {
    return PAYMENT_METHOD_BANK_TRANSFER;
  }
  return PAYMENT_METHOD_STRIPE;
}

function isPaymentMethodAllowed(
  method: PaymentMethodOption,
  flags: PaymentMethodFlags,
): boolean {
  if (method === PAYMENT_METHOD_FPS) {
    return flags.fpsQr;
  }
  if (method === PAYMENT_METHOD_BANK_TRANSFER) {
    return flags.bankTransfer;
  }
  return flags.stripeCards;
}

function getPaymentMethodLabel(
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

function getBankTransferDetails(content: BookingPaymentModalContent) {
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

function getSubmitButtonLabel(
  content: BookingPaymentModalContent,
  selectedPaymentMethod: PaymentMethodOption,
): string {
  if (selectedPaymentMethod === PAYMENT_METHOD_STRIPE) {
    return content.submitStripeLabel;
  }
  return content.submitLabel;
}

interface StripePaymentFieldsProps {
  fallbackErrorMessage: string;
}

interface StripePaymentFieldsHandle {
  confirmPayment: () => Promise<{
    paymentIntentId: string;
  } | {
    errorMessage: string;
  }>;
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

export function BookingReservationForm({
  locale,
  content,
  eventTitle,
  reservationServiceKey,
  cohortId = '',
  courseSlug,
  eventSubtitle = '',
  courseSessions,
  selectedAgeGroupLabel,
  selectedCohortDateLabel,
  selectedDateStartTime,
  originalPriceAmount,
  venueName = '',
  venueAddress = '',
  venueDirectionHref = '',
  dateEndTime = '',
  topicsFieldConfig,
  topicsPrefill = '',
  consultationWritingFocusLabel = '',
  consultationLevelLabel = '',
  thankYouRecapLabels,
  descriptionId,
  analyticsSectionId = 'my-best-auntie-booking',
  metaPixelContentName = PIXEL_CONTENT_NAME.my_best_auntie,
  captchaWidgetAction = 'mba_reservation_submit',
  discountValidationServiceKey,
  serviceInstanceId,
  prefilledDiscountCode = '',
  referralAppliedNote = '',
  referralAppliedAnnouncement = '',
  onSubmitReservation,
}: BookingReservationFormProps) {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isFullNameTouched, setIsFullNameTouched] = useState(false);
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState('HK');
  const [phone, setPhone] = useState('');
  const [isPhoneTouched, setIsPhoneTouched] = useState(false);
  const [isTopicsTouched, setIsTopicsTouched] = useState(false);
  const [isAcknowledgementsTouched, setIsAcknowledgementsTouched] = useState(false);
  const [interestedTopics, setInterestedTopics] = useState(() => topicsPrefill.trim());
  const lastAppliedTopicsPrefillRef = useRef(topicsPrefill.trim());
  const [discountCode, setDiscountCode] = useState('');
  const [discountRule, setDiscountRule] = useState<DiscountRule | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [autoAppliedFromReferral, setAutoAppliedFromReferral] = useState(false);
  const [referralAnnouncement, setReferralAnnouncement] = useState('');
  const [isDiscountValidationSubmitting, setIsDiscountValidationSubmitting] =
    useState(false);
  const autoApplyAttemptedRef = useRef(false);
  const [hasPendingReservationAcknowledgement, setHasPendingReservationAcknowledgement] =
    useState(false);
  const [hasTermsAgreement, setHasTermsAgreement] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [fpsQrImageDataUrl, setFpsQrImageDataUrl] = useState('');
  const {
    captchaToken,
    clearSubmissionError,
    handleCaptchaLoadError,
    handleCaptchaTokenChange,
    hasCaptchaLoadError,
    hasCaptchaValidationError,
    isCaptchaConfigured,
    isCaptchaUnavailable,
    isSubmitting,
    markCaptchaTouched,
    setSubmissionError,
    submitErrorMessage,
    withSubmitting,
  } = useFormSubmission({
    turnstileSiteKey,
  });
  const paymentMethodFlags = useMemo(() => {
    return resolvePaymentMethodFlags(resolvePublicBookingPaymentOptionFlags());
  }, []);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodOption>(
    () => {
      return getDefaultPaymentMethod(
        resolvePaymentMethodFlags(resolvePublicBookingPaymentOptionFlags()),
      );
    },
  );
  const showPaymentMethodPickers =
    (paymentMethodFlags.fpsQr ? 1 : 0) +
      (paymentMethodFlags.bankTransfer ? 1 : 0) +
      (paymentMethodFlags.stripeCards ? 1 : 0) >
    1;

  useEffect(() => {
    setSelectedPaymentMethod((current) => {
      if (isPaymentMethodAllowed(current, paymentMethodFlags)) {
        return current;
      }
      return getDefaultPaymentMethod(paymentMethodFlags);
    });
  }, [paymentMethodFlags]);

  useEffect(() => {
    const next = topicsPrefill.trim();
    if (!next) {
      return;
    }
    if (next === lastAppliedTopicsPrefillRef.current) {
      return;
    }
    lastAppliedTopicsPrefillRef.current = next;
    setInterestedTopics(next);
  }, [topicsPrefill]);

  const [stripePaymentIntent, setStripePaymentIntent] =
    useState<ReservationPaymentIntentResponse | null>(null);
  const [stripePaymentIntentKey, setStripePaymentIntentKey] = useState('');
  const [isStripePaymentIntentLoading, setIsStripePaymentIntentLoading] = useState(false);
  const stripePaymentFieldsRef = useRef<StripePaymentFieldsHandle | null>(null);
  const stripePaymentIntentAbortControllerRef = useRef<AbortController | null>(null);

  const totalAmount = useMemo(() => {
    return applyDiscount(originalPriceAmount, discountRule);
  }, [discountRule, originalPriceAmount]);
  const isFreeReservation = totalAmount <= 0;

  const prevIsFreeReservationRef = useRef(isFreeReservation);
  useEffect(() => {
    if (prevIsFreeReservationRef.current && !isFreeReservation) {
      setSelectedPaymentMethod(getDefaultPaymentMethod(paymentMethodFlags));
    }
    prevIsFreeReservationRef.current = isFreeReservation;
  }, [isFreeReservation, paymentMethodFlags]);

  useEffect(() => {
    setFpsQrImageDataUrl('');
  }, [totalAmount, selectedPaymentMethod]);
  const discountAmount = Math.max(0, originalPriceAmount - totalAmount);
  const hasEmailError = isEmailTouched && !isValidEmail(email);
  const hasFullNameError = isFullNameTouched && !sanitizeSingleLineValue(fullName);
  const normalizedPhoneForValidation = sanitizeSingleLineValue(phone);
  const phoneNationalDigits = normalizedPhoneForValidation.replace(/\D/g, '');
  const hasPhoneError =
    isPhoneTouched &&
    (!normalizedPhoneForValidation || phoneNationalDigits.length === 0);
  const hasPhoneInvalidForCountry =
    isPhoneTouched &&
    phoneNationalDigits.length > 0 &&
    !isValidPhoneForRegion(phone, phoneCountry);
  const isTopicsFieldRequired = topicsFieldConfig?.required ?? false;
  const hasTopicsError =
    isTopicsTouched && isTopicsFieldRequired && !interestedTopics.trim();
  const hasAcknowledgementsError = isFreeReservation
    ? isAcknowledgementsTouched && !hasTermsAgreement
    : isAcknowledgementsTouched &&
      (!hasPendingReservationAcknowledgement || !hasTermsAgreement);
  const normalizedStartDateTime = sanitizeSingleLineValue(selectedDateStartTime);
  const normalizedCohortDate =
    (normalizedStartDateTime.split('T')[0] ?? '') ||
    sanitizeSingleLineValue(selectedCohortDateLabel);
  const paymentIntentServiceKey =
    sanitizeSingleLineValue(discountValidationServiceKey ?? '') ||
    sanitizeSingleLineValue(courseSlug ?? '');
  const stripePaymentIntentRequestKey = [
    sanitizeSingleLineValue(selectedAgeGroupLabel),
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
  const isStripePaymentMethodSelected = selectedPaymentMethod === PAYMENT_METHOD_STRIPE;
  const reservationSubmitIdleLabel =
    isFreeReservation || !isStripePaymentMethodSelected
      ? content.submitLabel
      : content.submitStripeLabel;
  const isStripeUnavailable = stripePromise === null;
  const isStripeReady = Boolean(
    stripeElementsOptions &&
      stripePaymentIntent &&
      stripePaymentIntentKey === stripePaymentIntentRequestKey,
  );
  const captchaErrorMessage = resolveCaptchaErrorMessage(
    {
      isCaptchaConfigured,
      hasCaptchaLoadError,
      hasCaptchaValidationError,
    },
    {
      requiredError: content.captchaRequiredError,
      loadError: content.captchaLoadError,
      unavailableError: content.captchaUnavailableError,
    },
  );
  const submitButtonDescribedByParts = [
    hasFullNameError ? BOOKING_FULL_NAME_ERROR_MESSAGE_ID : null,
    hasEmailError ? BOOKING_EMAIL_ERROR_MESSAGE_ID : null,
    hasPhoneError ? BOOKING_PHONE_ERROR_MESSAGE_ID : null,
    hasPhoneInvalidForCountry && !hasPhoneError
      ? BOOKING_PHONE_INVALID_COUNTRY_ERROR_MESSAGE_ID
      : null,
    hasTopicsError ? BOOKING_TOPICS_ERROR_MESSAGE_ID : null,
    hasAcknowledgementsError ? ACKNOWLEDGEMENT_ERROR_MESSAGE_ID : null,
    captchaErrorMessage ? CAPTCHA_ERROR_MESSAGE_ID : null,
    submitErrorMessage ? SUBMIT_ERROR_MESSAGE_ID : null,
  ].filter((id): id is string => id !== null);
  const submitButtonDescribedBy =
    submitButtonDescribedByParts.length > 0
      ? submitButtonDescribedByParts.join(' ')
      : undefined;
  const isSubmitDisabled =
    isCaptchaUnavailable ||
    (!isFreeReservation &&
      isStripePaymentMethodSelected &&
      (isStripePaymentIntentLoading || !isStripeReady)) ||
    isSubmitting;

  const paymentMethodForAnalytics: ReservationPaymentMethodCode = isFreeReservation
    ? PAYMENT_METHOD_FREE
    : selectedPaymentMethod;

  useEffect(() => {
    if (isFreeReservation) {
      stripePaymentIntentAbortControllerRef.current?.abort();
      setStripePaymentIntent(null);
      setStripePaymentIntentKey('');
      setIsStripePaymentIntentLoading(false);
      return;
    }
    if (!paymentMethodFlags.stripeCards) {
      return;
    }
    if (!isStripePaymentMethodSelected) {
      return;
    }
    if (isStripeUnavailable || !normalizedCohortDate) {
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
    setIsStripePaymentIntentLoading(true);
    clearSubmissionError();
    if (!captchaToken) {
      setStripePaymentIntent(null);
      setStripePaymentIntentKey('');
      setIsStripePaymentIntentLoading(false);
      return;
    }
    void createReservationPaymentIntent(adminApiClient, {
      payload: {
        cohort_age: sanitizeSingleLineValue(selectedAgeGroupLabel) || 'unspecified',
        cohort_date: normalizedCohortDate,
        discount_code: discountRule?.code || undefined,
        service_key: paymentIntentServiceKey || undefined,
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
    clearSubmissionError,
    content.submitErrorMessage,
    discountRule?.code,
    cohortId,
    courseSlug,
    discountValidationServiceKey,
    paymentIntentServiceKey,
    captchaToken,
    paymentMethodFlags.stripeCards,
    isStripePaymentMethodSelected,
    isFreeReservation,
    isStripeUnavailable,
    normalizedCohortDate,
    selectedAgeGroupLabel,
    setSubmissionError,
    stripePaymentIntent,
    stripePaymentIntentKey,
    stripePaymentIntentRequestKey,
    totalAmount,
  ]);

  const applyDiscountFromCode = useCallback(
    async (
      rawCode: string,
      options: { ctaLocation: string; autoApply: boolean },
    ): Promise<void> => {
      if (discountRule) {
        return;
      }

      const normalizedCode = rawCode.trim().toUpperCase();
      if (!normalizedCode) {
        if (options.autoApply) {
          trackAnalyticsEvent('booking_discount_autoapply_error', {
            sectionId: analyticsSectionId,
            ctaLocation: options.ctaLocation,
            params: {
              error_type: 'invalid_code',
            },
          });
        } else {
          trackAnalyticsEvent('booking_discount_apply_error', {
            sectionId: analyticsSectionId,
            ctaLocation: options.ctaLocation,
            params: {
              error_type: 'invalid_code',
            },
          });
        }
        setDiscountRule(null);
        if (!options.autoApply) {
          setDiscountError(content.invalidDiscountLabel);
        }
        return;
      }

      const crmApiClient = createPublicCrmApiClient();
      if (!crmApiClient) {
        if (options.autoApply) {
          trackAnalyticsEvent('booking_discount_autoapply_error', {
            sectionId: analyticsSectionId,
            ctaLocation: options.ctaLocation,
            params: {
              error_type: 'service_unavailable',
            },
          });
        } else {
          trackAnalyticsEvent('booking_discount_apply_error', {
            sectionId: analyticsSectionId,
            ctaLocation: options.ctaLocation,
            params: {
              error_type: 'service_unavailable',
            },
          });
        }
        setDiscountRule(null);
        if (!options.autoApply) {
          setDiscountError(content.invalidDiscountLabel);
        }
        return;
      }

      const scopeKey =
        sanitizeSingleLineValue(discountValidationServiceKey ?? '') ||
        sanitizeSingleLineValue(courseSlug ?? '');

      setIsDiscountValidationSubmitting(true);
      if (!options.autoApply) {
        setDiscountError('');
      }
      try {
        const instanceForValidate = sanitizeSingleLineValue(serviceInstanceId ?? '');
        const validatedRule = await validateDiscountCode(crmApiClient, {
          code: normalizedCode,
          serviceKey: scopeKey || undefined,
          serviceInstanceId: instanceForValidate || undefined,
        });
        if (!validatedRule) {
          if (options.autoApply) {
            trackAnalyticsEvent('booking_discount_autoapply_error', {
              sectionId: analyticsSectionId,
              ctaLocation: options.ctaLocation,
              params: {
                error_type: 'invalid_code',
              },
            });
          } else {
            trackAnalyticsEvent('booking_discount_apply_error', {
              sectionId: analyticsSectionId,
              ctaLocation: options.ctaLocation,
              params: {
                error_type: 'invalid_code',
              },
            });
          }
          setDiscountRule(null);
          if (!options.autoApply) {
            setDiscountError(content.invalidDiscountLabel);
          }
          return;
        }

        setDiscountCode(normalizedCode);
        setDiscountRule(validatedRule);
        if (options.autoApply) {
          trackAnalyticsEvent('booking_discount_autoapply_success', {
            sectionId: analyticsSectionId,
            ctaLocation: options.ctaLocation,
            params: {
              discount_type: validatedRule.type,
              discount_amount: Math.max(
                0,
                originalPriceAmount - applyDiscount(originalPriceAmount, validatedRule),
              ),
            },
          });
        } else {
          trackAnalyticsEvent('booking_discount_apply_success', {
            sectionId: analyticsSectionId,
            ctaLocation: options.ctaLocation,
            params: {
              discount_type: validatedRule.type,
              discount_amount: Math.max(
                0,
                originalPriceAmount - applyDiscount(originalPriceAmount, validatedRule),
              ),
            },
          });
        }
        if (options.autoApply) {
          setAutoAppliedFromReferral(true);
          if (referralAppliedAnnouncement.trim()) {
            setReferralAnnouncement(referralAppliedAnnouncement.trim());
          }
        }
      } catch {
        if (options.autoApply) {
          trackAnalyticsEvent('booking_discount_autoapply_error', {
            sectionId: analyticsSectionId,
            ctaLocation: options.ctaLocation,
            params: {
              error_type: 'api_error',
            },
          });
        } else {
          trackAnalyticsEvent('booking_discount_apply_error', {
            sectionId: analyticsSectionId,
            ctaLocation: options.ctaLocation,
            params: {
              error_type: 'api_error',
            },
          });
        }
        setDiscountRule(null);
        if (!options.autoApply) {
          setDiscountError(content.invalidDiscountLabel);
        }
      } finally {
        setIsDiscountValidationSubmitting(false);
      }
    },
    [
      analyticsSectionId,
      content.invalidDiscountLabel,
      courseSlug,
      discountRule,
      discountValidationServiceKey,
      serviceInstanceId,
      originalPriceAmount,
      referralAppliedAnnouncement,
    ],
  );

  useEffect(() => {
    if (autoApplyAttemptedRef.current) {
      return;
    }
    const raw = prefilledDiscountCode?.trim() ?? '';
    if (!raw) {
      return;
    }
    if (discountRule) {
      return;
    }
    autoApplyAttemptedRef.current = true;
    void applyDiscountFromCode(raw, { ctaLocation: 'referral_auto', autoApply: true });
  }, [applyDiscountFromCode, discountRule, prefilledDiscountCode]);

  async function handleApplyDiscount() {
    const normalizedCode = discountCode.trim().toUpperCase();
    await applyDiscountFromCode(normalizedCode, { ctaLocation: 'discount_code', autoApply: false });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setIsFullNameTouched(true);
    setIsEmailTouched(true);
    setIsPhoneTouched(true);
    if (isTopicsFieldRequired) {
      setIsTopicsTouched(true);
    }
    setIsAcknowledgementsTouched(true);
    markCaptchaTouched();
    clearSubmissionError();

    trackPublicFormOutcome('booking_submit_attempt', {
      formKind: 'reservation',
      formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
      sectionId: analyticsSectionId,
      ctaLocation: 'reservation_form',
      params: {
        payment_method: paymentMethodForAnalytics,
        age_group: selectedAgeGroupLabel,
        cohort_date: normalizedCohortDate,
        cohort_label: selectedCohortDateLabel,
        total_amount: totalAmount,
        discount_amount: discountRule ? discountAmount : undefined,
        discount_type: discountRule ? discountRule.type : undefined,
      },
    });

    const normalizedFullName = sanitizeSingleLineValue(fullName);
    const normalizedPhone = sanitizeSingleLineValue(phone);
    const submitPhoneDigits = normalizedPhone.replace(/\D/g, '');
    const hasFieldErrors =
      !normalizedFullName ||
      !isValidEmail(email) ||
      !normalizedPhone ||
      submitPhoneDigits.length === 0 ||
      !isValidPhoneForRegion(phone, phoneCountry) ||
      (isTopicsFieldRequired && !interestedTopics.trim()) ||
      (!isFreeReservation && !hasPendingReservationAcknowledgement) ||
      !hasTermsAgreement;

    if (hasFieldErrors) {
      trackPublicFormOutcome('booking_submit_error', {
        formKind: 'reservation',
        formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
        sectionId: analyticsSectionId,
        ctaLocation: 'reservation_form',
        params: {
          payment_method: paymentMethodForAnalytics,
          age_group: selectedAgeGroupLabel,
          cohort_date: normalizedCohortDate,
          total_amount: totalAmount,
          error_type: 'validation_error',
        },
      });
      return;
    }

    if (isCaptchaUnavailable) {
      trackPublicFormOutcome('booking_submit_error', {
        formKind: 'reservation',
        formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
        sectionId: analyticsSectionId,
        ctaLocation: 'reservation_form',
        params: {
          payment_method: paymentMethodForAnalytics,
          age_group: selectedAgeGroupLabel,
          cohort_date: normalizedCohortDate,
          total_amount: totalAmount,
          error_type: 'service_unavailable',
        },
      });
      return;
    }
    if (!captchaToken) {
      trackPublicFormOutcome('booking_submit_error', {
        formKind: 'reservation',
        formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
        sectionId: analyticsSectionId,
        ctaLocation: 'reservation_form',
        params: {
          payment_method: paymentMethodForAnalytics,
          age_group: selectedAgeGroupLabel,
          cohort_date: normalizedCohortDate,
          total_amount: totalAmount,
          error_type: 'validation_error',
        },
      });
      return;
    }
    if (isStripePaymentMethodSelected && (isStripePaymentIntentLoading || !isStripeReady)) {
      trackPublicFormOutcome('booking_submit_error', {
        formKind: 'reservation',
        formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
        sectionId: analyticsSectionId,
        ctaLocation: 'reservation_form',
        params: {
          payment_method: paymentMethodForAnalytics,
          age_group: selectedAgeGroupLabel,
          cohort_date: normalizedCohortDate,
          total_amount: totalAmount,
          error_type: 'validation_error',
        },
      });
      setSubmissionError(content.submitErrorMessage);
      return;
    }

    if (!selectedCohortDateLabel) {
      trackPublicFormOutcome('booking_submit_error', {
        formKind: 'reservation',
        formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
        sectionId: analyticsSectionId,
        ctaLocation: 'reservation_form',
        params: {
          payment_method: paymentMethodForAnalytics,
          age_group: selectedAgeGroupLabel,
          cohort_date: normalizedCohortDate,
          total_amount: totalAmount,
          error_type: 'validation_error',
        },
      });
      return;
    }

    const resolvedCourseSessions: ReservationCourseSession[] = [];
    if (courseSessions && courseSessions.length > 0) {
      for (const session of courseSessions) {
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

    const detailLines: string[] = [];
    if (thankYouRecapLabels) {
      const flowSlug = sanitizeSingleLineValue(courseSlug ?? '').toLowerCase();
      if (flowSlug === 'my-best-auntie') {
        const cohort = sanitizeSingleLineValue(selectedCohortDateLabel);
        const age = sanitizeSingleLineValue(selectedAgeGroupLabel);
        if (cohort) {
          detailLines.push(
            formatContentTemplate(thankYouRecapLabels.detailCohortLineTemplate, {
              cohort,
            }),
          );
        }
        if (age) {
          detailLines.push(
            formatContentTemplate(thankYouRecapLabels.detailAgeGroupLineTemplate, {
              ageGroup: age,
            }),
          );
        }
      } else if (flowSlug === 'consultation-booking') {
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

    const reservationSummary: ReservationSummary = {
      attendeeName: sanitizeSingleLineValue(fullName),
      attendeeEmail: sanitizeSingleLineValue(email),
      attendeePhone: submitPhoneDigits,
      attendeeCountry: phoneCountry,
      ageGroup: sanitizeSingleLineValue(selectedAgeGroupLabel) || undefined,
      cohort: sanitizeSingleLineValue(selectedCohortDateLabel) || undefined,
      paymentMethod: isFreeReservation
        ? ''
        : sanitizeSingleLineValue(
            getPaymentMethodLabel(content, selectedPaymentMethod),
          ),
      paymentMethodCode: isFreeReservation ? PAYMENT_METHOD_FREE : selectedPaymentMethod,
      totalAmount: isFreeReservation ? 0 : totalAmount,
      eventTitle: sanitizeSingleLineValue(eventTitle),
      courseSlug: sanitizeSingleLineValue(courseSlug ?? '') || undefined,
      dateStartTime: primarySession?.dateStartTime,
      dateEndTime: primarySession?.dateEndTime,
      courseSessions:
        resolvedCourseSessions.length > 0 ? resolvedCourseSessions : undefined,
      eventSubtitle: sanitizeSingleLineValue(eventSubtitle) || undefined,
      ...(!isFreeReservation &&
      selectedPaymentMethod === 'fps_qr' &&
      fpsQrImageDataUrl.trim()
        ? { fpsQrImageDataUrl: fpsQrImageDataUrl.trim() }
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
    const crmApiClient = createPublicCrmApiClient();
    if (!crmApiClient || !captchaToken) {
      trackPublicFormOutcome('booking_submit_error', {
        formKind: 'reservation',
        formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
        sectionId: analyticsSectionId,
        ctaLocation: 'reservation_form',
        params: {
          payment_method: paymentMethodForAnalytics,
          age_group: selectedAgeGroupLabel,
          cohort_date: normalizedCohortDate,
          total_amount: totalAmount,
          error_type: 'service_unavailable',
        },
      });
      setSubmissionError(content.submitErrorMessage);
      return;
    }
    const scheduleTimeLabel = (() => {
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

    const reservationPayload: ReservationSubmissionPayload = {
      attendeeName: reservationSummary.attendeeName,
      attendeeEmail: reservationSummary.attendeeEmail,
      attendeePhone: reservationSummary.attendeePhone,
      attendeeCountry: reservationSummary.attendeeCountry,
      childAgeGroup: reservationSummary.ageGroup ?? '',
      cohortDate: normalizedCohortDate,
      interestedTopics: sanitizeSingleLineValue(interestedTopics) || undefined,
      discountCode: discountRule?.code || undefined,
      totalAmount: isFreeReservation ? 0 : totalAmount,
      reservationPendingUntilPaymentConfirmed: isFreeReservation
        ? false
        : hasPendingReservationAcknowledgement,
      agreedToTermsAndConditions: hasTermsAgreement,
      paymentMethod: isFreeReservation ? PAYMENT_METHOD_FREE : selectedPaymentMethod,
      stripePaymentIntentId: undefined,
      marketingOptIn: marketingOptIn,
      locale,
      courseLabel: sanitizeSingleLineValue(eventTitle) || undefined,
      ...(() => {
        const sanitizedServiceKey = sanitizeSingleLineValue(reservationServiceKey ?? '');
        const sanitizedCourseSlug = sanitizeSingleLineValue(courseSlug ?? '');
        const instanceUuid = sanitizeSingleLineValue(serviceInstanceId ?? '');
        return {
          ...(sanitizedServiceKey ? { serviceKey: sanitizedServiceKey } : {}),
          ...(sanitizedCourseSlug ? { courseSlug: sanitizedCourseSlug } : {}),
          ...(instanceUuid ? { serviceInstanceId: instanceUuid } : {}),
        };
      })(),
      scheduleDateLabel: sanitizeSingleLineValue(selectedCohortDateLabel) || undefined,
      scheduleTimeLabel: scheduleTimeLabel,
      locationName: sanitizeSingleLineValue(venueName) || undefined,
      locationAddress: sanitizeSingleLineValue(venueAddress) || undefined,
      primarySessionStartIso: sanitizeSingleLineValue(primarySession?.dateStartTime)
        || undefined,
      primarySessionEndIso: sanitizeSingleLineValue(primarySession?.dateEndTime ?? '')
        || undefined,
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
          courseSessions: resolvedCourseSessions.map((s) => {
            return {
              startIso: s.dateStartTime,
              ...(s.dateEndTime ? { endIso: s.dateEndTime } : {}),
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

    await withSubmitting(async () => {
      let stripePaymentIntentId: string | undefined;
      if (!isFreeReservation && isStripePaymentMethodSelected) {
        const stripePaymentFields = stripePaymentFieldsRef.current;
        if (!stripePaymentFields) {
          trackPublicFormOutcome('booking_submit_error', {
            formKind: 'reservation',
            formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
            sectionId: analyticsSectionId,
            ctaLocation: 'reservation_form',
            params: {
              payment_method: paymentMethodForAnalytics,
              age_group: selectedAgeGroupLabel,
              cohort_date: normalizedCohortDate,
              total_amount: totalAmount,
              error_type: 'validation_error',
            },
          });
          setSubmissionError(content.submitErrorMessage);
          return;
        }
        const stripeConfirmation = await stripePaymentFields.confirmPayment();
        if ('errorMessage' in stripeConfirmation) {
          trackPublicFormOutcome('booking_submit_error', {
            formKind: 'reservation',
            formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
            sectionId: analyticsSectionId,
            ctaLocation: 'reservation_form',
            params: {
              payment_method: paymentMethodForAnalytics,
              age_group: selectedAgeGroupLabel,
              cohort_date: normalizedCohortDate,
              total_amount: totalAmount,
              error_type: 'payment_error',
            },
          });
          setSubmissionError(stripeConfirmation.errorMessage);
          return;
        }
        stripePaymentIntentId = stripeConfirmation.paymentIntentId;
        reservationPayload.stripePaymentIntentId = stripePaymentIntentId;
      }

      if (
        !isFreeReservation &&
        selectedPaymentMethod === PAYMENT_METHOD_FPS &&
        !reservationPayload.stripePaymentIntentId &&
        fpsQrImageDataUrl.trim()
      ) {
        reservationPayload.fpsQrImageDataUrl = fpsQrImageDataUrl.trim();
      }

      const submissionResult = await ServerSubmissionResult.resolve({
        request: () =>
          submitReservation(crmApiClient, {
            payload: reservationPayload,
            turnstileToken: captchaToken,
          }),
        failureMessage: content.submitErrorMessage,
      });
      if (submissionResult.isSuccess) {
        trackPublicFormOutcome('booking_submit_success', {
          formKind: 'reservation',
          formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
          sectionId: analyticsSectionId,
          ctaLocation: 'reservation_form',
          params: {
            payment_method: paymentMethodForAnalytics,
            age_group: selectedAgeGroupLabel,
            cohort_date: normalizedCohortDate,
            cohort_label: selectedCohortDateLabel,
            total_amount: totalAmount,
            discount_amount: discountAmount,
            discount_type: discountRule?.type,
          },
        });
        trackMetaPixelEvent('Schedule', {
          content_name: metaPixelContentName,
          value: isFreeReservation ? 0 : totalAmount,
          currency: 'HKD',
        });
        trackMetaPixelEvent('Purchase', {
          content_name: metaPixelContentName,
          value: isFreeReservation ? 0 : totalAmount,
          currency: 'HKD',
        });
        trackEcommerceEvent('purchase', {
          value: isFreeReservation ? 0 : totalAmount,
          paymentType: paymentMethodForAnalytics,
          transactionId: stripePaymentIntentId ?? `${normalizedCohortDate}-${Date.now()}`,
          items: [{
            item_id: `mba-${selectedAgeGroupLabel}`,
            item_name: eventTitle,
            item_category: selectedAgeGroupLabel,
            price: isFreeReservation ? 0 : totalAmount,
            quantity: 1,
          }],
        });
        onSubmitReservation(reservationSummary);
        return;
      }

      trackPublicFormOutcome('booking_submit_error', {
        formKind: 'reservation',
        formId: BOOKING_RESERVATION_FORM_ANALYTICS_ID,
        sectionId: analyticsSectionId,
        ctaLocation: 'reservation_form',
        params: {
          payment_method: paymentMethodForAnalytics,
          age_group: selectedAgeGroupLabel,
          cohort_date: normalizedCohortDate,
          total_amount: totalAmount,
          error_type: 'api_error',
        },
      });
      setSubmissionError(submissionResult.errorMessage);
    });
  }

  return (
    <div className='w-full lg:w-[calc(50%-20px)]'>
      <section className='es-my-best-auntie-booking-modal-reservation-panel relative overflow-visible rounded-inner border es-border-panel es-bg-surface-muted px-5 py-7 sm:px-7'>
        <h3 className='relative z-10 text-[30px] font-bold leading-none es-text-heading'>
          {content.reservationTitle}
        </h3>
        <p id={descriptionId} className='sr-only'>
          {content.reservationDescription}
        </p>

        <form
          noValidate
          className='relative z-10 mt-4 space-y-3'
          onSubmit={handleSubmit}
        >
          <ReservationFormFields
            content={content}
            fullName={fullName}
            email={email}
            phoneCountry={phoneCountry}
            phone={phone}
            interestedTopics={interestedTopics}
            hasFullNameError={hasFullNameError}
            hasEmailError={hasEmailError}
            hasPhoneError={hasPhoneError}
            hasPhoneInvalidForCountry={hasPhoneInvalidForCountry}
            hasTopicsError={hasTopicsError}
            topicsFieldConfig={topicsFieldConfig}
            onFullNameChange={setFullName}
            onFullNameBlur={() => {
              setIsFullNameTouched(true);
            }}
            onEmailChange={setEmail}
            onEmailBlur={() => {
              setIsEmailTouched(true);
            }}
            onPhoneCountryChange={setPhoneCountry}
            onPhoneChange={setPhone}
            onPhoneBlur={() => {
              setIsPhoneTouched(true);
            }}
            onTopicsChange={setInterestedTopics}
            onTopicsBlur={() => {
              setIsTopicsTouched(true);
            }}
          />

          <ReservationFormDiscountCodeInput
            content={content}
            discountCode={discountCode}
            discountError={discountError}
            hasDiscountRule={Boolean(discountRule)}
            isDiscountValidationSubmitting={isDiscountValidationSubmitting}
            onDiscountCodeChange={(value) => {
              setDiscountCode(value);
              setDiscountError('');
            }}
            onApplyDiscount={handleApplyDiscount}
          />

          {referralAnnouncement ? (
            <p className='sr-only' role='status' aria-live='polite'>
              {referralAnnouncement}
            </p>
          ) : null}

          {autoAppliedFromReferral && referralAppliedNote.trim() ? (
            <p className='text-sm es-text-neutral-strong'>{referralAppliedNote.trim()}</p>
          ) : null}

          {discountRule ? <DiscountBadge label={content.discountAppliedLabel} /> : null}

          <ReservationFormPriceBreakdown
            content={content}
            locale={locale}
            originalAmount={originalPriceAmount}
            discountAmount={discountAmount}
            totalAmount={totalAmount}
          />

          {!isFreeReservation ? (
          <div data-booking-payment='true' className='w-full space-y-2 py-1'>
            <p className='text-sm font-semibold es-text-heading'>
              {content.paymentMethodLabel}
            </p>
            <div
              data-booking-payment-options='true'
              className='flex min-h-[244px] flex-col rounded-[14px] border es-border-input es-bg-surface-white p-[10px]'
            >
              <p
                data-booking-payment-confirmation-note='true'
                className='pb-2 text-sm leading-[1.45] es-text-heading'
              >
                {content.paymentConfirmationNote}
              </p>
              <div
                data-booking-payment-options-columns='true'
                className={`grid min-h-0 flex-1 gap-3 ${
                  showPaymentMethodPickers ? 'grid-cols-5' : 'grid-cols-1'
                }`}
              >
                {showPaymentMethodPickers ? (
                  <div
                    data-booking-payment-options-column-left='true'
                    className='col-span-1'
                  >
                    <div className='flex h-full flex-col justify-start gap-2 pt-1'>
                      {paymentMethodFlags.fpsQr ? (
                        <label
                          className={`es-focus-ring flex h-[53px] w-full cursor-pointer items-center justify-center rounded-lg border p-2 ${
                            selectedPaymentMethod === PAYMENT_METHOD_FPS
                              ? 'border-black/20 es-bg-surface-muted'
                              : 'border-transparent'
                          }`}
                        >
                          <input
                            type='radio'
                            name='booking-payment-method'
                            value={PAYMENT_METHOD_FPS}
                            checked={selectedPaymentMethod === PAYMENT_METHOD_FPS}
                            onChange={() => {
                              setSelectedPaymentMethod(PAYMENT_METHOD_FPS);
                              trackAnalyticsEvent('booking_payment_method_selected', {
                                sectionId: analyticsSectionId,
                                ctaLocation: 'payment_method',
                                params: {
                                  payment_method: PAYMENT_METHOD_FPS,
                                },
                              });
                              trackEcommerceEvent('add_payment_info', {
                                value: totalAmount,
                                paymentType: PAYMENT_METHOD_FPS,
                                items: [{
                                  item_id: `mba-${selectedAgeGroupLabel}`,
                                  item_name: eventTitle,
                                  item_category: selectedAgeGroupLabel,
                                  price: totalAmount,
                                  quantity: 1,
                                }],
                              });
                            }}
                            className='sr-only'
                          />
                          <span className='sr-only'>{content.paymentMethodValue}</span>
                          <Image
                            src={FPS_ICON_SOURCE}
                            alt=''
                            data-booking-fps-icon='true'
                            aria-hidden='true'
                            width={32}
                            height={18}
                            className='h-[36px] w-auto shrink-0'
                          />
                        </label>
                      ) : null}
                      {paymentMethodFlags.bankTransfer ? (
                        <label
                          className={`es-focus-ring flex h-[53px] w-full cursor-pointer items-center justify-center rounded-lg border p-2 ${
                            selectedPaymentMethod === PAYMENT_METHOD_BANK_TRANSFER
                              ? 'border-black/20 es-bg-surface-muted'
                              : 'border-transparent'
                          }`}
                        >
                          <input
                            type='radio'
                            name='booking-payment-method'
                            value={PAYMENT_METHOD_BANK_TRANSFER}
                            checked={selectedPaymentMethod === PAYMENT_METHOD_BANK_TRANSFER}
                            onChange={() => {
                              setSelectedPaymentMethod(PAYMENT_METHOD_BANK_TRANSFER);
                              trackAnalyticsEvent('booking_payment_method_selected', {
                                sectionId: analyticsSectionId,
                                ctaLocation: 'payment_method',
                                params: {
                                  payment_method: PAYMENT_METHOD_BANK_TRANSFER,
                                },
                              });
                              trackEcommerceEvent('add_payment_info', {
                                value: totalAmount,
                                paymentType: PAYMENT_METHOD_BANK_TRANSFER,
                                items: [{
                                  item_id: `mba-${selectedAgeGroupLabel}`,
                                  item_name: eventTitle,
                                  item_category: selectedAgeGroupLabel,
                                  price: totalAmount,
                                  quantity: 1,
                                }],
                              });
                            }}
                            className='sr-only'
                          />
                          <span className='sr-only'>
                            {content.paymentMethodBankTransferValue}
                          </span>
                          <Image
                            src={BANK_ICON_SOURCE}
                            alt=''
                            data-booking-bank-icon='true'
                            aria-hidden='true'
                            width={20}
                            height={20}
                            className='h-6 w-6 shrink-0'
                          />
                        </label>
                      ) : null}
                      {paymentMethodFlags.stripeCards ? (
                        <label
                          className={`es-focus-ring flex h-[53px] w-full cursor-pointer items-center justify-center rounded-lg border p-2 ${
                            selectedPaymentMethod === PAYMENT_METHOD_STRIPE
                              ? 'border-black/20 es-bg-surface-muted'
                              : 'border-transparent'
                          }`}
                        >
                          <input
                            type='radio'
                            name='booking-payment-method'
                            value={PAYMENT_METHOD_STRIPE}
                            checked={selectedPaymentMethod === PAYMENT_METHOD_STRIPE}
                            onChange={() => {
                              setSelectedPaymentMethod(PAYMENT_METHOD_STRIPE);
                              trackAnalyticsEvent('booking_payment_method_selected', {
                                sectionId: analyticsSectionId,
                                ctaLocation: 'payment_method',
                                params: {
                                  payment_method: PAYMENT_METHOD_STRIPE,
                                },
                              });
                              trackEcommerceEvent('add_payment_info', {
                                value: totalAmount,
                                paymentType: PAYMENT_METHOD_STRIPE,
                                items: [{
                                  item_id: `mba-${selectedAgeGroupLabel}`,
                                  item_name: eventTitle,
                                  item_category: selectedAgeGroupLabel,
                                  price: totalAmount,
                                  quantity: 1,
                                }],
                              });
                            }}
                            className='sr-only'
                          />
                          <span className='sr-only'>
                            {content.paymentMethodStripeValue}
                          </span>
                          <Image
                            src={STRIPE_CARD_ICON_SOURCE}
                            alt=''
                            data-booking-stripe-icon='true'
                            aria-hidden='true'
                            width={24}
                            height={24}
                            className='h-6 w-6 shrink-0'
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div
                  data-booking-payment-options-column-right='true'
                  className={`flex h-full items-center ${
                    showPaymentMethodPickers ? 'col-span-4' : 'col-span-1'
                  }`}
                >
                  {selectedPaymentMethod === PAYMENT_METHOD_FPS ? (
                    <div
                      data-booking-payment-details='fps'
                      className='flex h-full w-full flex-col items-center justify-center gap-2'
                    >
                      <FpsQrCode
                        amount={totalAmount}
                        label={content.fpsQrCodeLabel}
                        onDataUrlChange={setFpsQrImageDataUrl}
                      />
                      <p
                        data-booking-payment-fps-copy='true'
                        className='text-center text-sm leading-[1.45] es-text-heading'
                      >
                        {content.paymentFpsQrInstruction}
                      </p>
                    </div>
                  ) : selectedPaymentMethod === PAYMENT_METHOD_BANK_TRANSFER ? (
                    <div
                      data-booking-payment-details='bank-transfer'
                      className='flex h-full w-full flex-col items-center justify-center'
                    >
                      <dl className='space-y-2 text-center'>
                        {getBankTransferDetails(content).map((bankDetail, bankDetailIndex) => (
                          <div key={bankDetail.label} className='flex flex-col items-center space-y-0.5'>
                            <dt
                              className={`text-xs font-semibold uppercase tracking-wide es-text-heading ${
                                bankDetailIndex > 0 ? 'pt-[10px]' : ''
                              }`}
                            >
                              {bankDetail.label}
                            </dt>
                            <dd className='text-sm font-semibold es-text-heading'>
                              {bankDetail.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : (
                    <div
                      data-booking-payment-details='stripe'
                      className='w-full'
                    >
                      {isStripeUnavailable ? (
                        <p className='text-sm font-semibold es-text-danger-strong'>
                          {content.paymentMethodStripeUnavailableLabel}
                        </p>
                      ) : isStripeReady && stripeElementsOptions ? (
                        <Elements
                          key={stripePaymentIntent?.payment_intent_id}
                          stripe={stripePromise}
                          options={stripeElementsOptions}
                        >
                          <StripePaymentFields
                            ref={stripePaymentFieldsRef}
                            fallbackErrorMessage={content.submitErrorMessage}
                          />
                        </Elements>
                      ) : (
                        <p className='text-sm es-text-heading'>
                          {content.paymentMethodStripeLoadingLabel}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          ) : null}

          <div data-booking-acknowledgements='true' className='space-y-2'>
            {!isFreeReservation ? (
            <label className='flex cursor-pointer items-start gap-2.5 py-1'>
              <input
                type='checkbox'
                required
                checked={hasPendingReservationAcknowledgement}
                onChange={(event) => {
                  setHasPendingReservationAcknowledgement(event.target.checked);
                }}
                className='es-focus-ring mt-1 h-4 w-4 shrink-0 es-accent-brand'
              />
              <span className='text-sm leading-[1.45] es-text-heading'>
                {content.pendingReservationAcknowledgementLabel}
                <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
                  *
                </span>
              </span>
            </label>
            ) : null}

            <label className='flex cursor-pointer items-start gap-2.5 py-1'>
              <input
                type='checkbox'
                required
                checked={hasTermsAgreement}
                onChange={(event) => {
                  setHasTermsAgreement(event.target.checked);
                }}
                className='es-focus-ring mt-1 h-4 w-4 shrink-0 es-accent-brand'
              />
              <span className='text-sm leading-[1.45] es-text-heading'>
                {content.termsAgreementLabel}{' '}
                <SmartLink
                  href={content.termsHref}
                  openInNewTab
                  className='es-focus-ring rounded-[2px] es-text-brand underline underline-offset-4'
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {content.termsLinkLabel}
                </SmartLink>
                <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
                  *
                </span>
              </span>
            </label>
            {hasAcknowledgementsError ? (
              <p
                id={ACKNOWLEDGEMENT_ERROR_MESSAGE_ID}
                className='es-form-field-error'
                role='alert'
              >
                {content.acknowledgementRequiredError}
              </p>
            ) : null}

            <label className='flex cursor-pointer items-start gap-2.5 py-1'>
              <input
                type='checkbox'
                checked={marketingOptIn}
                onChange={(event) => {
                  setMarketingOptIn(event.target.checked);
                }}
                className='es-focus-ring mt-1 h-4 w-4 shrink-0 es-accent-brand'
              />
              <span className='text-sm leading-[1.45] es-text-heading'>
                {content.marketingOptInLabel}
              </span>
            </label>
          </div>

          <label className='relative z-20 block overflow-visible'>
            <span className='mb-1 block text-sm font-semibold es-text-heading'>
              {content.captchaLabel}
            </span>
            <TurnstileCaptcha
              siteKey={turnstileSiteKey}
              widgetAction={captchaWidgetAction}
              onTokenChange={handleCaptchaTokenChange}
              onLoadError={handleCaptchaLoadError}
            />
          </label>
          {captchaErrorMessage ? (
            <p
              id={CAPTCHA_ERROR_MESSAGE_ID}
              className='es-form-submit-error'
              role='alert'
            >
              {captchaErrorMessage}
            </p>
          ) : null}
          {submitErrorMessage ? (
            <p
              id={SUBMIT_ERROR_MESSAGE_ID}
              className='es-form-submit-error'
              role='alert'
            >
              {submitErrorMessage}
            </p>
          ) : null}

          <ButtonPrimitive
            variant='primary'
            type='submit'
            disabled={isSubmitDisabled}
            aria-describedby={submitButtonDescribedBy}
            className={submitButtonClassName(isSubmitting, 'mt-1')}
          >
            <SubmitButtonLoadingContent
              isSubmitting={isSubmitting}
              submittingLabel={content.submittingLabel}
              idleLabel={reservationSubmitIdleLabel}
              loadingGearTestId='booking-reservation-submit-loading-gear'
            />
          </ButtonPrimitive>
        </form>
      </section>
    </div>
  );
}
