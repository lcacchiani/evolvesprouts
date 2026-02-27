import {
  type FormEvent,
  useMemo,
  useState,
} from 'react';

import type { ReservationSummary } from '@/components/sections/my-best-auntie-booking-modal';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import { SmartLink } from '@/components/shared/smart-link';
import {
  DiscountBadge,
  FpsQrCode,
} from '@/components/sections/booking-modal/shared';
import type { MyBestAuntieBookingContent } from '@/content';
import { applyDiscount } from '@/components/sections/booking-modal/helpers';
import {
  createPublicCrmApiClient,
} from '@/lib/crm-api-client';
import {
  type DiscountRule,
  validateDiscountCode,
} from '@/lib/discounts-data';
import { formatCurrencyHkd } from '@/lib/format';
import {
  submitReservation,
  type ReservationSubmissionPayload,
} from '@/lib/reservations-data';
import { ServerSubmissionResult } from '@/lib/server-submission-result';

interface BookingReservationFormProps {
  content: MyBestAuntieBookingContent['paymentModal'];
  selectedAgeGroupLabel: string;
  selectedCohortDateLabel: string;
  selectedCohortDate: string;
  selectedCohortPrice: number;
  scheduleTimeLabel: string;
  descriptionId: string;
  onSubmitReservation: (summary: ReservationSummary) => void;
}

const DISCOUNT_ERROR_MESSAGE_ID = 'booking-modal-discount-error-message';
const CAPTCHA_ERROR_MESSAGE_ID = 'booking-modal-captcha-error-message';
const SUBMIT_ERROR_MESSAGE_ID = 'booking-modal-submit-error-message';
const EMAIL_ERROR_MESSAGE_ID = 'booking-modal-email-error-message';
const RESERVATION_SUBMIT_ERROR_MESSAGE =
  'Unable to submit reservation right now. Please try again.';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeSingleLineValue(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function BookingReservationForm({
  content,
  selectedAgeGroupLabel,
  selectedCohortDateLabel,
  selectedCohortDate,
  selectedCohortPrice,
  scheduleTimeLabel,
  descriptionId,
  onSubmitReservation,
}: BookingReservationFormProps) {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [phone, setPhone] = useState('');
  const [interestedTopics, setInterestedTopics] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountRule, setDiscountRule] = useState<DiscountRule | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [isDiscountValidationSubmitting, setIsDiscountValidationSubmitting] =
    useState(false);
  const [hasPendingReservationAcknowledgement, setHasPendingReservationAcknowledgement] =
    useState(false);
  const [hasTermsAgreement, setHasTermsAgreement] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaTouched, setIsCaptchaTouched] = useState(false);
  const [hasCaptchaLoadError, setHasCaptchaLoadError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const originalAmount = selectedCohortPrice;
  const totalAmount = useMemo(() => {
    return applyDiscount(originalAmount, discountRule);
  }, [discountRule, originalAmount]);
  const discountAmount = Math.max(0, originalAmount - totalAmount);
  const hasDiscount = discountAmount > 0;
  const hasConfirmedPriceDifference = totalAmount !== originalAmount;
  const hasEmailError = isEmailTouched && !isValidEmail(email);
  const hasCaptchaValidationError = isCaptchaTouched && !captchaToken;
  const isCaptchaConfigured = turnstileSiteKey.trim() !== '';
  const isCaptchaUnavailable = !isCaptchaConfigured || hasCaptchaLoadError;
  const captchaErrorMessage = !isCaptchaConfigured
    ? content.captchaUnavailableError
    : hasCaptchaLoadError
      ? content.captchaLoadError
      : hasCaptchaValidationError
        ? content.captchaRequiredError
        : '';
  const isSubmitDisabled =
    !fullName.trim() ||
    !email.trim() ||
    hasEmailError ||
    !phone.trim() ||
    !hasPendingReservationAcknowledgement ||
    !hasTermsAgreement ||
    !captchaToken ||
    isCaptchaUnavailable ||
    isSubmitting;

  async function handleApplyDiscount() {
    if (discountRule) {
      return;
    }

    const normalizedCode = discountCode.trim().toUpperCase();
    if (!normalizedCode) {
      setDiscountRule(null);
      setDiscountError(content.invalidDiscountLabel);
      return;
    }

    const crmApiClient = createPublicCrmApiClient();
    if (!crmApiClient) {
      setDiscountRule(null);
      setDiscountError(content.invalidDiscountLabel);
      return;
    }

    setIsDiscountValidationSubmitting(true);
    setDiscountError('');
    try {
      const validatedRule = await validateDiscountCode(
        crmApiClient,
        normalizedCode,
      );
      if (!validatedRule) {
        setDiscountRule(null);
        setDiscountError(content.invalidDiscountLabel);
        return;
      }

      setDiscountCode(normalizedCode);
      setDiscountRule(validatedRule);
    } catch {
      setDiscountRule(null);
      setDiscountError(content.invalidDiscountLabel);
    } finally {
      setIsDiscountValidationSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsEmailTouched(true);
    setIsCaptchaTouched(true);
    setSubmitError('');
    if (!isValidEmail(email)) {
      return;
    }
    if (
      !selectedCohortDateLabel ||
      isSubmitDisabled
    ) {
      return;
    }

    const reservationSummary: ReservationSummary = {
      attendeeName: sanitizeSingleLineValue(fullName),
      attendeeEmail: sanitizeSingleLineValue(email),
      attendeePhone: sanitizeSingleLineValue(phone),
      childAgeGroup: sanitizeSingleLineValue(selectedAgeGroupLabel),
      paymentMethod: sanitizeSingleLineValue(content.paymentMethodValue),
      totalAmount,
      courseLabel: sanitizeSingleLineValue(content.title),
      scheduleDateLabel: sanitizeSingleLineValue(selectedCohortDateLabel),
      scheduleTimeLabel: sanitizeSingleLineValue(scheduleTimeLabel),
    };
    const crmApiClient = createPublicCrmApiClient();
    if (!crmApiClient || !captchaToken) {
      setSubmitError(RESERVATION_SUBMIT_ERROR_MESSAGE);
      return;
    }

    const normalizedCohortDate =
      sanitizeSingleLineValue(selectedCohortDate) ||
      sanitizeSingleLineValue(selectedCohortDateLabel);
    const reservationPayload: ReservationSubmissionPayload = {
      full_name: reservationSummary.attendeeName,
      email: reservationSummary.attendeeEmail,
      phone_number: reservationSummary.attendeePhone,
      cohort_age: reservationSummary.childAgeGroup,
      cohort_date: normalizedCohortDate,
      comments: sanitizeSingleLineValue(interestedTopics) || undefined,
      discount_code: discountRule?.code || undefined,
      price: totalAmount,
      reservation_pending_until_payment_confirmed:
        hasPendingReservationAcknowledgement,
      agreed_to_terms_and_conditions: hasTermsAgreement,
    };

    setIsSubmitting(true);
    const submissionResult = await ServerSubmissionResult.resolve({
      request: () =>
        submitReservation(crmApiClient, {
          payload: reservationPayload,
          turnstileToken: captchaToken,
        }),
      failureMessage: RESERVATION_SUBMIT_ERROR_MESSAGE,
    });
    if (submissionResult.isSuccess) {
      onSubmitReservation(reservationSummary);
    } else {
      setSubmitError(submissionResult.errorMessage);
    }
    setIsSubmitting(false);
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

        <form className='relative z-10 mt-4 space-y-3' onSubmit={handleSubmit}>
          <label className='block'>
            <span className='mb-1 block text-sm font-semibold es-text-heading'>
              {content.fullNameLabel}
              <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
                *
              </span>
            </span>
            <input
              type='text'
              required
              autoComplete='name'
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
              }}
              className='es-focus-ring es-form-input'
            />
          </label>
          <label className='block'>
            <span className='mb-1 block text-sm font-semibold es-text-heading'>
              {content.emailLabel}
              <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
                *
              </span>
            </span>
            <input
              type='email'
              required
              autoComplete='email'
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              onBlur={() => {
                setIsEmailTouched(true);
              }}
              className={`es-focus-ring es-form-input ${hasEmailError ? 'es-form-input-error' : ''}`}
              aria-invalid={hasEmailError}
              aria-describedby={hasEmailError ? EMAIL_ERROR_MESSAGE_ID : undefined}
            />
            {hasEmailError ? (
              <p
                id={EMAIL_ERROR_MESSAGE_ID}
                className='text-sm font-semibold es-text-danger-strong'
                role='alert'
              >
                Please enter a valid email address.
              </p>
            ) : null}
          </label>
          <label className='block'>
            <span className='mb-1 block text-sm font-semibold es-text-heading'>
              {content.phoneLabel}
              <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
                *
              </span>
            </span>
            <input
              type='tel'
              required
              autoComplete='tel'
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
              }}
              className='es-focus-ring es-form-input'
            />
          </label>
          <label className='block'>
            <span className='mb-1 block text-sm font-semibold es-text-heading'>
              {content.topicsInterestLabel}
            </span>
            <textarea
              value={interestedTopics}
              onChange={(event) => {
                setInterestedTopics(event.target.value);
              }}
              placeholder={content.topicsInterestPlaceholder}
              rows={3}
              className='es-focus-ring es-form-input resize-y'
            />
          </label>

          <div className='grid grid-cols-[1fr_auto] gap-2'>
            <label>
              <span className='mb-1 block text-sm font-semibold es-text-heading'>
                {content.discountCodeLabel}
              </span>
              <input
                type='text'
                value={discountCode}
                disabled={Boolean(discountRule)}
                aria-invalid={Boolean(discountError)}
                aria-describedby={discountError ? DISCOUNT_ERROR_MESSAGE_ID : undefined}
                onChange={(event) => {
                  setDiscountCode(event.target.value);
                  setDiscountError('');
                }}
                placeholder={content.discountCodePlaceholder}
                className='es-focus-ring es-form-input'
              />
            </label>
            <ButtonPrimitive
              variant='outline'
              onClick={handleApplyDiscount}
              disabled={Boolean(discountRule) || isDiscountValidationSubmitting}
              className='mt-6 h-[50px] rounded-control px-4 text-sm font-semibold'
            >
              {content.applyDiscountLabel}
            </ButtonPrimitive>
          </div>

          {discountRule ? (
            <DiscountBadge label={content.discountAppliedLabel} />
          ) : null}
          {discountError ? (
            <p
              id={DISCOUNT_ERROR_MESSAGE_ID}
              className='text-sm font-semibold es-text-danger-strong'
              role='alert'
            >
              {discountError}
            </p>
          ) : null}

          <div
            data-booking-price-breakdown='true'
            className='my-3 space-y-2 py-1'
          >
            <div className='flex items-center justify-between text-sm font-semibold es-text-body'>
              <span>Price</span>
              <span className='font-bold es-text-heading'>{formatCurrencyHkd(originalAmount)}</span>
            </div>
            {hasDiscount ? (
              <div className='flex items-center justify-between text-sm font-semibold es-text-success'>
                <span>Discount</span>
                <span>-{formatCurrencyHkd(discountAmount)}</span>
              </div>
            ) : null}
            {hasConfirmedPriceDifference ? (
              <div className='flex items-center justify-between border-t es-border-divider pt-2 text-sm font-bold es-text-heading'>
                <span>Confirmed Price</span>
                <span>{formatCurrencyHkd(totalAmount)}</span>
              </div>
            ) : null}
          </div>

          <div data-booking-fps-block='true' className='w-full space-y-2 py-1'>
            <p className='text-sm font-semibold es-text-heading'>
              {content.paymentMethodLabel}
            </p>
            <FpsQrCode amount={totalAmount} />
          </div>

          <div data-booking-acknowledgements='true' className='space-y-2'>
            <label className='flex items-start gap-2.5 py-1'>
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

            <label className='flex items-start gap-2.5 py-1'>
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
          </div>

          <label className='relative z-20 block overflow-visible'>
            <span className='mb-1 block text-sm font-semibold es-text-heading'>
              {content.captchaLabel}
            </span>
            <TurnstileCaptcha
              siteKey={turnstileSiteKey}
              widgetAction='mba_reservation_submit'
              size='normal'
              onTokenChange={(token) => {
                setCaptchaToken(token);
                if (token) {
                  setIsCaptchaTouched(false);
                  setHasCaptchaLoadError(false);
                }
              }}
              onLoadError={() => {
                setHasCaptchaLoadError(true);
              }}
            />
          </label>
          {captchaErrorMessage ? (
            <p
              id={CAPTCHA_ERROR_MESSAGE_ID}
              className='text-sm font-semibold es-text-danger-strong'
              role='alert'
            >
              {captchaErrorMessage}
            </p>
          ) : null}
          {submitError ? (
            <p
              id={SUBMIT_ERROR_MESSAGE_ID}
              className='text-sm font-semibold es-text-danger-strong'
              role='alert'
            >
              {submitError}
            </p>
          ) : null}

          <ButtonPrimitive
            variant='primary'
            type='submit'
            disabled={isSubmitDisabled}
            aria-describedby={
              captchaErrorMessage
                ? CAPTCHA_ERROR_MESSAGE_ID
                : submitError
                  ? SUBMIT_ERROR_MESSAGE_ID
                  : undefined
            }
            className='mt-1 w-full'
          >
            {content.submitLabel}
          </ButtonPrimitive>
        </form>
      </section>
    </div>
  );
}
