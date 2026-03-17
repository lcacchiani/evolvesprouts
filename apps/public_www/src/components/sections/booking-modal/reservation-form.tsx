import Image from 'next/image';
import { type FormEvent, useMemo, useState } from 'react';

import { ReservationFormDiscountCodeInput } from '@/components/sections/booking-modal/reservation-form-discount-code-input';
import { ReservationFormFields } from '@/components/sections/booking-modal/reservation-form-fields';
import { ReservationFormPriceBreakdown } from '@/components/sections/booking-modal/reservation-form-price-breakdown';
import { DiscountBadge, FpsQrCode } from '@/components/sections/booking-modal/shared';
import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import { useFormSubmission } from '@/components/sections/shared/use-form-submission';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { SmartLink } from '@/components/shared/smart-link';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import { applyDiscount } from '@/components/sections/booking-modal/helpers';
import type { BookingPaymentModalContent, Locale } from '@/content';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { type DiscountRule, validateDiscountCode } from '@/lib/discounts-data';
import {
  submitReservation,
  type ReservationSubmissionPayload,
} from '@/lib/reservations-data';
import { ServerSubmissionResult } from '@/lib/server-submission-result';
import { isValidEmail, sanitizeSingleLineValue } from '@/lib/validation';

interface BookingReservationFormProps {
  locale: Locale;
  content: BookingPaymentModalContent;
  eventTitle: string;
  selectedAgeGroupLabel: string;
  selectedCohortDateLabel: string;
  selectedDateStartTime: string;
  selectedCohortPrice: number;
  descriptionId: string;
  onSubmitReservation: (summary: ReservationSummary) => void;
}

const CAPTCHA_ERROR_MESSAGE_ID = 'booking-modal-captcha-error-message';
const SUBMIT_ERROR_MESSAGE_ID = 'booking-modal-submit-error-message';
const FPS_ICON_SOURCE = '/images/fps-logo.svg';
const BANK_ICON_SOURCE = '/images/bank.svg';
const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME ?? '';
const BANK_ACCOUNT_HOLDER = process.env.NEXT_PUBLIC_BANK_ACCOUNT_HOLDER ?? '';
const BANK_ACCOUNT_NUMBER = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER ?? '';
const BANK_DETAIL_PLACEHOLDER = '--';
const PAYMENT_METHOD_FPS = 'fps_qr';
const PAYMENT_METHOD_BANK_TRANSFER = 'bank_transfer';

type PaymentMethodOption =
  | typeof PAYMENT_METHOD_FPS
  | typeof PAYMENT_METHOD_BANK_TRANSFER;

function getPaymentMethodLabel(
  content: BookingPaymentModalContent,
  selectedPaymentMethod: PaymentMethodOption,
): string {
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

export function BookingReservationForm({
  locale,
  content,
  eventTitle,
  selectedAgeGroupLabel,
  selectedCohortDateLabel,
  selectedDateStartTime,
  selectedCohortPrice,
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodOption>(
    PAYMENT_METHOD_FPS,
  );

  const originalAmount = selectedCohortPrice;
  const totalAmount = useMemo(() => {
    return applyDiscount(originalAmount, discountRule);
  }, [discountRule, originalAmount]);
  const discountAmount = Math.max(0, originalAmount - totalAmount);
  const hasEmailError = isEmailTouched && !isValidEmail(email);
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
      const validatedRule = await validateDiscountCode(crmApiClient, normalizedCode);
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
    markCaptchaTouched();
    clearSubmissionError();
    if (!isValidEmail(email)) {
      return;
    }
    if (!selectedCohortDateLabel || isSubmitDisabled) {
      return;
    }

    const reservationSummary: ReservationSummary = {
      attendeeName: sanitizeSingleLineValue(fullName),
      attendeeEmail: sanitizeSingleLineValue(email),
      attendeePhone: sanitizeSingleLineValue(phone),
      ageGroup: sanitizeSingleLineValue(selectedAgeGroupLabel) || undefined,
      cohort: sanitizeSingleLineValue(selectedCohortDateLabel) || undefined,
      paymentMethod: sanitizeSingleLineValue(
        getPaymentMethodLabel(content, selectedPaymentMethod),
      ),
      totalAmount,
      eventTitle: sanitizeSingleLineValue(eventTitle),
      dateStartTime: sanitizeSingleLineValue(selectedDateStartTime) || undefined,
    };
    const crmApiClient = createPublicCrmApiClient();
    if (!crmApiClient || !captchaToken) {
      setSubmissionError(content.submitErrorMessage);
      return;
    }

    const normalizedStartDateTime = sanitizeSingleLineValue(selectedDateStartTime);
    const normalizedCohortDate =
      (normalizedStartDateTime.split('T')[0] ?? '') ||
      sanitizeSingleLineValue(selectedCohortDateLabel);
    const reservationPayload: ReservationSubmissionPayload = {
      full_name: reservationSummary.attendeeName,
      email: reservationSummary.attendeeEmail,
      phone_number: reservationSummary.attendeePhone,
      cohort_age: reservationSummary.ageGroup ?? '',
      cohort_date: normalizedCohortDate,
      comments: sanitizeSingleLineValue(interestedTopics) || undefined,
      discount_code: discountRule?.code || undefined,
      price: totalAmount,
      reservation_pending_until_payment_confirmed:
        hasPendingReservationAcknowledgement,
      agreed_to_terms_and_conditions: hasTermsAgreement,
    };

    await withSubmitting(async () => {
      const submissionResult = await ServerSubmissionResult.resolve({
        request: () =>
          submitReservation(crmApiClient, {
            payload: reservationPayload,
            turnstileToken: captchaToken,
          }),
        failureMessage: content.submitErrorMessage,
      });
      if (submissionResult.isSuccess) {
        onSubmitReservation(reservationSummary);
        return;
      }

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

        <form className='relative z-10 mt-4 space-y-3' onSubmit={handleSubmit}>
          <ReservationFormFields
            content={content}
            fullName={fullName}
            email={email}
            phone={phone}
            interestedTopics={interestedTopics}
            hasEmailError={hasEmailError}
            onFullNameChange={setFullName}
            onEmailChange={setEmail}
            onEmailBlur={() => {
              setIsEmailTouched(true);
            }}
            onPhoneChange={setPhone}
            onTopicsChange={setInterestedTopics}
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

          {discountRule ? <DiscountBadge label={content.discountAppliedLabel} /> : null}

          <ReservationFormPriceBreakdown
            content={content}
            locale={locale}
            originalAmount={originalAmount}
            discountAmount={discountAmount}
            totalAmount={totalAmount}
          />

          <div data-booking-payment='true' className='w-full space-y-2 py-1'>
            <p className='text-sm font-semibold es-text-heading'>
              {content.paymentMethodLabel}
            </p>
            <div
              data-booking-payment-options='true'
              className='flex h-[244px] flex-col rounded-[14px] border es-border-input es-bg-surface-white p-[10px]'
            >
              <p
                data-booking-payment-confirmation-note='true'
                className='pb-2 text-sm leading-[1.45] es-text-heading'
              >
                {content.paymentConfirmationNote}
              </p>
              <div
                data-booking-payment-options-columns='true'
                className='grid h-full min-h-0 flex-1 grid-cols-5 gap-3'
              >
                <div
                  data-booking-payment-options-column-left='true'
                  className='col-span-1'
                >
                  <div className='flex h-full flex-col justify-start gap-2 pt-1'>
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
                  </div>
                </div>
                <div
                  data-booking-payment-options-column-right='true'
                  className='col-span-4 flex h-full items-center'
                >
                  {selectedPaymentMethod === PAYMENT_METHOD_FPS ? (
                    <div
                      data-booking-payment-details='fps'
                      className='flex h-full w-full flex-col items-center justify-center gap-2'
                    >
                      <FpsQrCode
                        amount={totalAmount}
                        label={content.fpsQrCodeLabel}
                      />
                      <p
                        data-booking-payment-fps-copy='true'
                        className='text-center text-sm leading-[1.45] es-text-heading'
                      >
                        {content.paymentFpsQrInstruction}
                      </p>
                    </div>
                  ) : (
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
                  )}
                </div>
              </div>
            </div>
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
              onTokenChange={handleCaptchaTokenChange}
              onLoadError={handleCaptchaLoadError}
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
          {submitErrorMessage ? (
            <p
              id={SUBMIT_ERROR_MESSAGE_ID}
              className='text-sm font-semibold es-text-danger-strong'
              role='alert'
            >
              {submitErrorMessage}
            </p>
          ) : null}

          <ButtonPrimitive
            variant='primary'
            type='submit'
            disabled={isSubmitDisabled}
            aria-describedby={
              captchaErrorMessage
                ? CAPTCHA_ERROR_MESSAGE_ID
                : submitErrorMessage
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
