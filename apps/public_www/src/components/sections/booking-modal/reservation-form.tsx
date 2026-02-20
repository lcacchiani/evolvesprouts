import Image from 'next/image';
import {
  type FormEvent,
  useEffect,
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
  isAbortRequestError,
} from '@/lib/crm-api-client';
import {
  type DiscountRule,
  fetchDiscountRules,
} from '@/lib/discounts-data';
import { formatCurrencyHkd } from '@/lib/format';

interface BookingReservationFormProps {
  content: MyBestAuntieBookingContent['paymentModal'];
  selectedAgeGroupLabel: string;
  selectedMonthLabel: string;
  selectedPackageLabel: string;
  selectedPackagePrice: number;
  scheduleTimeLabel: string;
  descriptionId: string;
  onSubmitReservation: (summary: ReservationSummary) => void;
}

const DISCOUNT_ERROR_MESSAGE_ID = 'booking-modal-discount-error-message';
const CAPTCHA_ERROR_MESSAGE_ID = 'booking-modal-captcha-error-message';

function sanitizeSingleLineValue(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}

export function BookingReservationForm({
  content,
  selectedAgeGroupLabel,
  selectedMonthLabel,
  selectedPackageLabel,
  selectedPackagePrice,
  scheduleTimeLabel,
  descriptionId,
  onSubmitReservation,
}: BookingReservationFormProps) {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [interestedTopics, setInterestedTopics] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
  const [discountRule, setDiscountRule] = useState<DiscountRule | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [hasPendingReservationAcknowledgement, setHasPendingReservationAcknowledgement] =
    useState(false);
  const [hasTermsAgreement, setHasTermsAgreement] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaTouched, setIsCaptchaTouched] = useState(false);
  const [hasCaptchaLoadError, setHasCaptchaLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const crmApiClient = createPublicCrmApiClient();

    if (!crmApiClient) {
      return () => {
        controller.abort();
      };
    }

    fetchDiscountRules(crmApiClient, controller.signal)
      .then((remoteRules) => {
        setDiscountRules(remoteRules);
      })
      .catch((error) => {
        if (isAbortRequestError(error)) {
          return;
        }

        setDiscountRules([]);
      });

    return () => {
      controller.abort();
    };
  }, []);

  const originalAmount = selectedPackagePrice;
  const totalAmount = useMemo(() => {
    return applyDiscount(originalAmount, discountRule);
  }, [discountRule, originalAmount]);
  const discountAmount = Math.max(0, originalAmount - totalAmount);
  const hasDiscount = discountAmount > 0;
  const hasConfirmedPriceDifference = totalAmount !== originalAmount;
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
    !phone.trim() ||
    !hasPendingReservationAcknowledgement ||
    !hasTermsAgreement ||
    !captchaToken ||
    isCaptchaUnavailable;

  function handleApplyDiscount() {
    if (discountRule) {
      return;
    }

    const normalizedCode = discountCode.trim().toUpperCase();
    if (!normalizedCode) {
      setDiscountRule(null);
      setDiscountError(content.invalidDiscountLabel);
      return;
    }

    const matchedRule = discountRules.find(
      (entry) => entry.code.toUpperCase() === normalizedCode,
    );

    if (!matchedRule) {
      setDiscountRule(null);
      setDiscountError(content.invalidDiscountLabel);
      return;
    }

    setDiscountRule(matchedRule);
    setDiscountError('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCaptchaTouched(true);
    if (
      !selectedPackageLabel ||
      !selectedMonthLabel ||
      isSubmitDisabled
    ) {
      return;
    }

    onSubmitReservation({
      attendeeName: sanitizeSingleLineValue(fullName),
      attendeeEmail: sanitizeSingleLineValue(email),
      attendeePhone: sanitizeSingleLineValue(phone),
      childAgeGroup: sanitizeSingleLineValue(selectedAgeGroupLabel),
      packageLabel: sanitizeSingleLineValue(selectedPackageLabel),
      monthLabel: sanitizeSingleLineValue(selectedMonthLabel),
      paymentMethod: sanitizeSingleLineValue(content.paymentMethodValue),
      totalAmount,
      courseLabel: sanitizeSingleLineValue(content.title),
      scheduleDateLabel: sanitizeSingleLineValue(selectedMonthLabel),
      scheduleTimeLabel: sanitizeSingleLineValue(scheduleTimeLabel),
    });
  }

  return (
    <div className='w-full lg:w-[calc(50%-20px)]'>
      <section className='relative overflow-visible rounded-input border es-border-panel es-bg-surface-muted px-5 py-7 sm:px-7'>
        <Image
          src='/images/evolvesprouts-logo.svg'
          alt=''
          width={276}
          height={267}
          className='pointer-events-none absolute -right-5 -top-6 hidden w-[220px] sm:block'
          aria-hidden='true'
        />

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
              className='es-focus-ring es-form-input w-full rounded-input border px-4 py-3 text-[16px] font-semibold'
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
              className='es-focus-ring es-form-input w-full rounded-input border px-4 py-3 text-[16px] font-semibold'
            />
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
              className='es-focus-ring es-form-input w-full rounded-input border px-4 py-3 text-[16px] font-semibold'
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
              className='es-focus-ring es-form-input w-full resize-y rounded-input border px-4 py-3 text-[16px] font-semibold'
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
                className='es-focus-ring es-form-input w-full rounded-input border px-4 py-3 text-[16px] font-semibold'
              />
            </label>
            <ButtonPrimitive
              variant='outline'
              onClick={handleApplyDiscount}
              disabled={Boolean(discountRule)}
              className='mt-6 h-size-50 rounded-button px-4 text-sm font-semibold'
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
            className='space-y-2 py-1'
          >
            <div className='flex items-center justify-between text-sm font-semibold es-text-body'>
              <span>Price</span>
              <span>{formatCurrencyHkd(originalAmount)}</span>
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
                  className='es-focus-ring rounded-sm es-text-brand underline underline-offset-4'
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

          <ButtonPrimitive
            variant='primary'
            type='submit'
            disabled={isSubmitDisabled}
            aria-describedby={captchaErrorMessage ? CAPTCHA_ERROR_MESSAGE_ID : undefined}
            className='mt-1 w-full'
          >
            {content.submitLabel}
          </ButtonPrimitive>
        </form>
      </section>
    </div>
  );
}
