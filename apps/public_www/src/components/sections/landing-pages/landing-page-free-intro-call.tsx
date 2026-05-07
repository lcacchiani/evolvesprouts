'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { ReservationFormFields } from '@/components/sections/booking-modal/reservation-form-fields';
import { IntroCallSlotPicker } from '@/components/sections/landing-pages/intro-call-slot-picker';
import { MarketingOptInCheckbox } from '@/components/shared/marketing-opt-in-checkbox';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import {
  submitButtonClassName,
  SubmitButtonLoadingContent,
} from '@/components/shared/submit-button-loading-content';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { SmartLink } from '@/components/shared/smart-link';
import type {
  BookingPaymentModalContent,
  CommonAccessibilityContent,
  LandingPageIntroCallContent,
  LandingPageLocaleContent,
  Locale,
  SiteContent,
} from '@/content';
import { formatContentTemplate } from '@/content/content-field-utils';
import { getContent } from '@/content';
import {
  trackAnalyticsEvent,
  trackEcommerceEvent,
  trackPublicFormOutcome,
} from '@/lib/analytics';
import { createPublicCrmApiClient, CrmApiRequestError } from '@/lib/crm-api-client';
import type { IntroCallSlot } from '@/lib/public-calendar-availability-api';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import { isValidPhoneForRegion } from '@/lib/public-phone-validation';
import { submitReservation, type ReservationSubmissionPayload } from '@/lib/reservations-data';
import { useFormInteractionGate } from '@/components/sections/shared/use-form-interaction';
import {
  resolveCaptchaErrorMessage,
  useFormSubmission,
} from '@/components/sections/shared/use-form-submission';
import { formatSitePartDate, formatSiteTimeOfDay } from '@/lib/site-datetime';
import { isValidEmail, sanitizeSingleLineValue } from '@/lib/validation';

const INTRO_CALL_FORM_ANALYTICS_ID = 'intro-call-booking-form';

function parseMarketingAttributionFromSearch(search: string): ReservationSubmissionPayload['marketingAttribution'] {
  const params = new URLSearchParams(search);
  const utm_source = params.get('utm_source')?.trim();
  const utm_medium = params.get('utm_medium')?.trim();
  const utm_campaign = params.get('utm_campaign')?.trim();
  const utm_content = params.get('utm_content')?.trim();
  const referrer =
    typeof document !== 'undefined' && document.referrer
      ? document.referrer.trim()
      : undefined;
  const out: NonNullable<ReservationSubmissionPayload['marketingAttribution']> = {};
  if (utm_source) {
    out.utm_source = utm_source;
  }
  if (utm_medium) {
    out.utm_medium = utm_medium;
  }
  if (utm_campaign) {
    out.utm_campaign = utm_campaign;
  }
  if (utm_content) {
    out.utm_content = utm_content;
  }
  if (referrer) {
    out.referrer = referrer;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function reservationErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const err = (payload as { error?: unknown }).error;
  return typeof err === 'string' ? err : undefined;
}

interface LandingPageFreeIntroCallProps {
  locale: Locale;
  pageTitle: string;
  introContent: LandingPageIntroCallContent;
  paymentModalContent: BookingPaymentModalContent;
  commonAccessibility: CommonAccessibilityContent;
  captchaContent: SiteContent['common']['captcha'];
  whatsappHref: string;
}

export function LandingPageFreeIntroCall({
  locale,
  pageTitle,
  introContent,
  paymentModalContent,
  commonAccessibility,
  captchaContent,
  whatsappHref,
}: LandingPageFreeIntroCallProps) {
  const dialCodeOptionTemplate = getContent(locale).common.phoneDialCodeOptionTemplate;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const marketingAttributionRef = useRef<
    ReservationSubmissionPayload['marketingAttribution'] | undefined
  >(undefined);
  const pickerWrapRef = useRef<HTMLDivElement | null>(null);
  const [slotRefreshToken, setSlotRefreshToken] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<IntroCallSlot | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('HK');
  const [phone, setPhone] = useState('');
  const [interestedTopics, setInterestedTopics] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [isFullNameTouched, setIsFullNameTouched] = useState(false);
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [isPhoneTouched, setIsPhoneTouched] = useState(false);
  const [hasTermsAgreement, setHasTermsAgreement] = useState(false);
  const [isAckTouched, setIsAckTouched] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [recentCooldownMessage, setRecentCooldownMessage] = useState(false);

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
  } = useFormSubmission({ turnstileSiteKey });
  const { hasFormInteracted, markFormInteracted, formInteractionProps } =
    useFormInteractionGate();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    marketingAttributionRef.current = parseMarketingAttributionFromSearch(window.location.search);
  }, []);

  const normalizedFullName = useMemo(
    () => sanitizeSingleLineValue(fullName),
    [fullName],
  );
  const normalizedPhone = useMemo(() => sanitizeSingleLineValue(phone), [phone]);
  const submitPhoneDigits = normalizedPhone.replace(/\D/g, '');
  const hasFullNameError = isFullNameTouched && !normalizedFullName;
  const hasEmailError = isEmailTouched && !isValidEmail(email);
  const phoneFilled = submitPhoneDigits.length > 0;
  const hasPhoneError = isPhoneTouched && phoneFilled && !normalizedPhone;
  const hasPhoneInvalidForCountry =
    isPhoneTouched && phoneFilled && !isValidPhoneForRegion(phone, phoneCountry);
  const hasTopicsError = false;

  const selectedSlotCardSecondLine = useMemo(() => {
    if (!selectedSlot) {
      return '';
    }
    const dateLabel = formatSitePartDate(selectedSlot.startIso, locale);
    const timeLabel = formatSiteTimeOfDay(selectedSlot.startIso, locale);
    return formatContentTemplate(introContent.selectedSlotSummaryTemplate, {
      date: dateLabel,
      time: timeLabel,
    });
  }, [introContent.selectedSlotSummaryTemplate, locale, selectedSlot]);

  const handleSelectSlot = useCallback((slot: IntroCallSlot | null) => {
    markFormInteracted();
    setSelectedSlot(slot);
    setRecentCooldownMessage(false);
    clearSubmissionError();
  }, [clearSubmissionError, markFormInteracted]);

  const captchaInlineError = resolveCaptchaErrorMessage(
    {
      isCaptchaConfigured,
      hasCaptchaLoadError,
      hasCaptchaValidationError,
    },
    captchaContent,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    markFormInteracted();
    if (isSubmitting || isSuccess) {
      return;
    }
    setIsFullNameTouched(true);
    setIsEmailTouched(true);
    setIsPhoneTouched(true);
    setIsAckTouched(true);
    markCaptchaTouched();
    clearSubmissionError();
    setRecentCooldownMessage(false);

    trackPublicFormOutcome('booking_submit_attempt', {
      formKind: 'reservation',
      formId: INTRO_CALL_FORM_ANALYTICS_ID,
      sectionId: 'intro-call-booking',
      ctaLocation: 'intro_call_form',
      params: {
        payment_method: 'free',
        service_tier: 'intro_call',
        cohort_date: '',
        total_amount: 0,
      },
    });

    const hasSlot = Boolean(selectedSlot);
    const phoneOk =
      !phoneFilled
      || (normalizedPhone && isValidPhoneForRegion(phone, phoneCountry));
    const hasFieldErrors =
      !normalizedFullName
      || !isValidEmail(email)
      || !hasSlot
      || !phoneOk
      || !hasTermsAgreement;

    if (hasFieldErrors) {
      trackPublicFormOutcome('booking_submit_error', {
        formKind: 'reservation',
        formId: INTRO_CALL_FORM_ANALYTICS_ID,
        sectionId: 'intro-call-booking',
        ctaLocation: 'intro_call_form',
        params: {
          payment_method: 'free',
          service_tier: 'intro_call',
          cohort_date: '',
          total_amount: 0,
          error_type: 'validation_error',
        },
      });
      return;
    }

    if (isCaptchaUnavailable) {
      trackPublicFormOutcome('booking_submit_error', {
        formKind: 'reservation',
        formId: INTRO_CALL_FORM_ANALYTICS_ID,
        sectionId: 'intro-call-booking',
        ctaLocation: 'intro_call_form',
        params: {
          payment_method: 'free',
          service_tier: 'intro_call',
          cohort_date: '',
          total_amount: 0,
          error_type: 'service_unavailable',
        },
      });
      return;
    }
    if (!captchaToken) {
      trackPublicFormOutcome('booking_submit_error', {
        formKind: 'reservation',
        formId: INTRO_CALL_FORM_ANALYTICS_ID,
        sectionId: 'intro-call-booking',
        ctaLocation: 'intro_call_form',
        params: {
          payment_method: 'free',
          service_tier: 'intro_call',
          cohort_date: '',
          total_amount: 0,
          error_type: 'validation_error',
        },
      });
      return;
    }

    const crmApiClient = createPublicCrmApiClient();
    if (!crmApiClient || !selectedSlot) {
      trackPublicFormOutcome('booking_submit_error', {
        formKind: 'reservation',
        formId: INTRO_CALL_FORM_ANALYTICS_ID,
        sectionId: 'intro-call-booking',
        ctaLocation: 'intro_call_form',
        params: {
          payment_method: 'free',
          service_tier: 'intro_call',
          cohort_date: '',
          total_amount: 0,
          error_type: 'service_unavailable',
        },
      });
      setSubmissionError(paymentModalContent.submitErrorMessage);
      return;
    }

    const payload: ReservationSubmissionPayload = {
      attendeeName: normalizedFullName,
      attendeeEmail: email.trim(),
      attendeePhone: phoneFilled ? normalizedPhone : '',
      attendeeCountry: phoneFilled ? phoneCountry : undefined,
      interestedTopics: interestedTopics.trim() || undefined,
      commentsFieldLabel: introContent.topicsFieldLabel,
      totalAmount: 0,
      reservationPendingUntilPaymentConfirmed: false,
      agreedToTermsAndConditions: true,
      paymentMethod: 'free',
      marketingOptIn,
      locale,
      title: pageTitle,
      serviceKey: 'intro-call',
      bookingSystem: 'intro-call-booking',
      serviceInstanceSlug: 'intro-call-free-15min',
      primarySessionStartIso: selectedSlot.startIso,
      primarySessionEndIso: selectedSlot.endIso,
      marketingAttribution: marketingAttributionRef.current,
    };

    let submissionSucceeded = false;
    await withSubmitting(async () => {
      try {
        await submitReservation(crmApiClient, {
          payload,
          turnstileToken: captchaToken,
        });
        submissionSucceeded = true;
      } catch (error) {
        if (error instanceof CrmApiRequestError && error.statusCode === 409) {
          const code = reservationErrorCode(error.payload);
          if (code === 'recent_intro_call_exists') {
            setRecentCooldownMessage(true);
            trackPublicFormOutcome('booking_submit_error', {
              formKind: 'reservation',
              formId: INTRO_CALL_FORM_ANALYTICS_ID,
              sectionId: 'intro-call-booking',
              ctaLocation: 'intro_call_form',
              params: {
                payment_method: 'free',
                service_tier: 'intro_call',
                cohort_date: '',
                total_amount: 0,
                error_type: 'recent_intro_call_exists',
              },
            });
            return;
          }
          if (code === 'slot_unavailable') {
            setSubmissionError(introContent.slotUnavailableMessage);
            setSlotRefreshToken((t) => t + 1);
            pickerWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            trackPublicFormOutcome('booking_submit_error', {
              formKind: 'reservation',
              formId: INTRO_CALL_FORM_ANALYTICS_ID,
              sectionId: 'intro-call-booking',
              ctaLocation: 'intro_call_form',
              params: {
                payment_method: 'free',
                service_tier: 'intro_call',
                cohort_date: '',
                total_amount: 0,
                error_type: 'slot_unavailable',
              },
            });
            return;
          }
        }
        trackPublicFormOutcome('booking_submit_error', {
          formKind: 'reservation',
          formId: INTRO_CALL_FORM_ANALYTICS_ID,
          sectionId: 'intro-call-booking',
          ctaLocation: 'intro_call_form',
          params: {
            payment_method: 'free',
            service_tier: 'intro_call',
            cohort_date: '',
            total_amount: 0,
            error_type: 'api_error',
          },
        });
        setSubmissionError(paymentModalContent.submitErrorMessage);
      }
    });

    if (!submissionSucceeded) {
      return;
    }

    trackPublicFormOutcome('booking_submit_success', {
      formKind: 'reservation',
      formId: INTRO_CALL_FORM_ANALYTICS_ID,
      sectionId: 'intro-call-booking',
      ctaLocation: 'intro_call_form',
      params: {
        payment_method: 'free',
        service_tier: 'intro_call',
        cohort_date: '',
        total_amount: 0,
      },
    });
    trackMetaPixelEvent('Schedule', {
      content_name: PIXEL_CONTENT_NAME.public_www_free_intro_call,
      value: 0,
      currency: 'HKD',
    });
    trackMetaPixelEvent('Purchase', {
      content_name: PIXEL_CONTENT_NAME.public_www_free_intro_call,
      value: 0,
      currency: 'HKD',
    });
    trackEcommerceEvent('purchase', {
      value: 0,
      paymentType: 'free',
      transactionId: `intro-call-${selectedSlot.startIso}`,
      items: [{
        item_id: 'intro-call',
        item_name: 'Free Intro Call',
        item_category: 'intro_call',
        price: 0,
        quantity: 1,
      }],
    });
    trackAnalyticsEvent('book_free_call_click', {
      sectionId: 'intro-call-booking',
      ctaLocation: 'intro_call_form',
      params: { cta_location: 'intro_call_submit_success' },
    });
    setIsSuccess(true);
  }

  return (
    <SectionShell
      id='intro-call-booking'
      ariaLabel={introContent.bookingSectionTitle}
      dataFigmaNode='intro-call-booking'
      className='es-book-a-free-call-booking-section'
    >
      <SectionContainer className='py-12 lg:py-16'>
        <SectionHeader
          titleId='intro-call-booking-heading'
          title={introContent.bookingSectionTitle}
          align='left'
          className='mb-8 max-w-2xl'
        />
        {isSuccess ? (
          <div className='max-w-xl space-y-4 rounded-inner border es-border-panel es-bg-surface-white px-6 py-8'>
            <h3 className='text-2xl font-bold es-text-heading'>
              {introContent.thankYouTitle}
            </h3>
            <p className='es-type-body'>{introContent.thankYouBody}</p>
          </div>
        ) : (
          <div className='grid min-w-0 gap-8 lg:grid-cols-2 lg:gap-12'>
            <div ref={pickerWrapRef} className='min-w-0'>
              <IntroCallSlotPicker
                locale={locale}
                commonAccessibility={commonAccessibility}
                pickerContent={introContent}
                whatsappHref={whatsappHref}
                onSelect={handleSelectSlot}
                refreshToken={slotRefreshToken}
              />
              <p className='mt-4 es-type-body-sm text-neutral-600'>
                {introContent.emptySlotsMessagePrefix}{' '}
                <a
                  href={whatsappHref}
                  className='es-focus-ring font-semibold underline'
                  onClick={() => {
                    trackAnalyticsEvent('book_free_call_click', {
                      sectionId: 'intro-call-booking',
                      ctaLocation: 'intro_call_whatsapp_help',
                      params: { cta_location: 'whatsapp_help_empty' },
                    });
                  }}
                >
                  {introContent.whatsappAfterBookLabel}
                </a>
              </p>
              {selectedSlot ? (
                <div className='pt-3'>
                  <div
                    data-testid='intro-call-selected-slot-card'
                    className='w-full max-w-[410px] rounded-inner border es-border-warm-2 es-bg-surface-soft px-5 py-4'
                  >
                    <p className='text-base font-semibold es-text-brand'>
                      {introContent.selectedSlotSummaryHeading}
                    </p>
                    <p className='es-type-subtitle-lg mt-1 es-text-heading'>
                      {selectedSlotCardSecondLine}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className='min-w-0'>
              {recentCooldownMessage ? (
                <p className='mb-4 rounded-inner border border-amber-200 bg-amber-50 px-4 py-3 es-type-body'>
                  {introContent.recentIntroMessage}{' '}
                  <a href={whatsappHref} className='es-focus-ring font-semibold underline'>
                    {introContent.whatsappHelpCtaLabel}
                  </a>
                </p>
              ) : null}
              <form
                {...formInteractionProps}
                id='intro-call-booking-form'
                aria-labelledby='intro-call-booking-heading'
                noValidate
                onSubmit={(e) => {
                  void handleSubmit(e);
                }}
                className='space-y-4'
              >
                <ReservationFormFields
                  content={{
                    ...paymentModalContent,
                    phoneLabel: introContent.phoneFieldLabel,
                    ...(introContent.fullNameFieldLabel
                      ? { fullNameLabel: introContent.fullNameFieldLabel }
                      : {}),
                    ...(introContent.emailFieldLabel
                      ? { emailLabel: introContent.emailFieldLabel }
                      : {}),
                  }}
                  optionalPhone
                  dialCodeOptionTemplate={dialCodeOptionTemplate}
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
                  topicsFieldConfig={{
                    label: introContent.topicsFieldLabel,
                    placeholder: introContent.topicsFieldPlaceholder,
                    required: false,
                  }}
                  onFullNameChange={(v) => {
                    markFormInteracted();
                    setFullName(v);
                  }}
                  onFullNameBlur={() => setIsFullNameTouched(true)}
                  onEmailChange={(v) => {
                    markFormInteracted();
                    setEmail(v);
                  }}
                  onEmailBlur={() => setIsEmailTouched(true)}
                  onPhoneCountryChange={(v) => {
                    markFormInteracted();
                    setPhoneCountry(v);
                  }}
                  onPhoneChange={(v) => {
                    markFormInteracted();
                    setPhone(v);
                  }}
                  onPhoneBlur={() => setIsPhoneTouched(true)}
                  onTopicsChange={(v) => {
                    markFormInteracted();
                    setInterestedTopics(v);
                  }}
                  onTopicsBlur={() => {}}
                />
                <label className='flex cursor-pointer items-start gap-2.5 py-1'>
                  <input
                    type='checkbox'
                    required
                    checked={hasTermsAgreement}
                    onChange={(event) => {
                      markFormInteracted();
                      setHasTermsAgreement(event.target.checked);
                    }}
                    className='es-focus-ring mt-1 h-4 w-4 shrink-0 es-accent-brand'
                    aria-invalid={isAckTouched && !hasTermsAgreement}
                  />
                  <span className='text-sm leading-[1.45] es-text-heading'>
                    {paymentModalContent.termsAgreementLabel}{' '}
                    <SmartLink
                      href={paymentModalContent.termsHref}
                      openInNewTab
                      className='es-focus-ring rounded-[2px] es-text-brand underline underline-offset-4'
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      {paymentModalContent.termsLinkLabel}
                    </SmartLink>
                    <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
                      *
                    </span>
                  </span>
                </label>
                {isAckTouched && !hasTermsAgreement ? (
                  <p className='es-form-field-error' role='alert'>
                    {paymentModalContent.acknowledgementRequiredError}
                  </p>
                ) : null}
                <MarketingOptInCheckbox
                  checked={marketingOptIn}
                  onChange={(checked) => {
                    markFormInteracted();
                    setMarketingOptIn(checked);
                  }}
                  label={paymentModalContent.marketingOptInLabel}
                />
                {hasFormInteracted ? (
                  <label className='block'>
                    <span className='mb-1 block text-sm font-semibold es-text-heading'>
                      {captchaContent.captchaLabel}
                    </span>
                    <TurnstileCaptcha
                      siteKey={turnstileSiteKey}
                      widgetAction='intro_call_booking_submit'
                      onTokenChange={handleCaptchaTokenChange}
                      onLoadError={handleCaptchaLoadError}
                    />
                  </label>
                ) : null}
                {captchaInlineError ? (
                  <p className='es-form-field-error' role='alert'>
                    {captchaInlineError}
                  </p>
                ) : null}
                {submitErrorMessage ? (
                  <p className='es-form-field-error' role='alert'>
                    {submitErrorMessage}
                  </p>
                ) : null}
                <ButtonPrimitive
                  type='submit'
                  variant='primary'
                  className={submitButtonClassName(isSubmitting)}
                  state={isSubmitting ? 'inactive' : 'default'}
                  disabled={
                    isSubmitting
                    || isSuccess
                    || isCaptchaUnavailable
                  }
                >
                  <SubmitButtonLoadingContent
                    isSubmitting={isSubmitting}
                    idleLabel={introContent.submitLabel}
                    submittingLabel={paymentModalContent.submittingLabel}
                    loadingGearTestId='intro-call-submit-loading-gear'
                  />
                </ButtonPrimitive>
              </form>
            </div>
          </div>
        )}
      </SectionContainer>
    </SectionShell>
  );
}
