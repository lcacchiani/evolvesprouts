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
import { SubmitButtonLoadingContent } from '@/components/shared/submit-button-loading-content';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type {
  BookingPaymentModalContent,
  CommonAccessibilityContent,
  LandingPageIntroCallContent,
  LandingPageLocaleContent,
  Locale,
  SiteContent,
} from '@/content';
import { getContent } from '@/content';
import {
  trackAnalyticsEvent,
  trackEcommerceEvent,
  trackPublicFormOutcome,
} from '@/lib/analytics';
import {
  buildBookingIcsContent,
  downloadBookingCalendarFile,
} from '@/lib/booking-calendar-download';
import { createPublicCrmApiClient, CrmApiRequestError } from '@/lib/crm-api-client';
import type { IntroCallSlot } from '@/lib/intro-call-slots-api';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import { isValidPhoneForRegion } from '@/lib/public-phone-validation';
import { submitReservation, type ReservationSubmissionPayload } from '@/lib/reservations-data';
import { resolveCaptchaErrorMessage, useFormSubmission } from '@/components/sections/shared/use-form-submission';
import {
  appendTimeZoneLabel,
  formatSiteCompactDate,
  formatSiteTimeOfDay,
  formatSiteTimeZoneShortName,
} from '@/lib/site-datetime';
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

  const slotSummaryText = useMemo(() => {
    if (!selectedSlot) {
      return '';
    }
    const dateLabel = formatSiteCompactDate(selectedSlot.startIso, locale);
    const timeLabel = formatSiteTimeOfDay(selectedSlot.startIso, locale);
    const tz = formatSiteTimeZoneShortName(selectedSlot.startIso, locale);
    return appendTimeZoneLabel(`${dateLabel} · ${timeLabel}`, tz) ?? `${dateLabel} · ${timeLabel}`;
  }, [locale, selectedSlot]);

  const handleSelectSlot = useCallback((slot: IntroCallSlot) => {
    setSelectedSlot(slot);
    setRecentCooldownMessage(false);
    clearSubmissionError();
  }, [clearSubmissionError]);

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

  function handleAddToCalendar() {
    if (!selectedSlot) {
      return;
    }
    const ics = buildBookingIcsContent({
      title: pageTitle,
      dateStartTime: selectedSlot.startIso,
      dateEndTime: selectedSlot.endIso,
      location: 'Online',
    });
    if (ics) {
      downloadBookingCalendarFile(ics, 'evolvesprouts-free-intro-call');
    }
    trackAnalyticsEvent('booking_thank_you_ics_download', {
      sectionId: 'intro-call-booking',
      ctaLocation: 'intro_call_thank_you',
      params: { total_amount: 0 },
    });
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
        {isSuccess && selectedSlot ? (
          <div className='max-w-xl space-y-4 rounded-inner border es-border-panel es-bg-surface-white px-6 py-8'>
            <h3 className='text-2xl font-bold es-text-heading'>
              {introContent.thankYouTitle}
            </h3>
            <p className='es-type-body'>{introContent.thankYouBody}</p>
            <p className='es-type-body font-semibold es-text-heading'>{slotSummaryText}</p>
            <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap'>
              <ButtonPrimitive
                type='button'
                variant='outline'
                className='w-fit'
                onClick={handleAddToCalendar}
              >
                {introContent.addToCalendarLabel}
              </ButtonPrimitive>
              <SectionCtaAnchor href={whatsappHref} variant='primary' className='w-fit'>
                {introContent.whatsappAfterBookLabel}
              </SectionCtaAnchor>
            </div>
          </div>
        ) : (
          <div className='grid gap-10 lg:grid-cols-2 lg:gap-12'>
            <div ref={pickerWrapRef}>
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
            </div>
            <div>
              {recentCooldownMessage ? (
                <p className='mb-4 rounded-inner border border-amber-200 bg-amber-50 px-4 py-3 es-type-body'>
                  {introContent.recentIntroMessage}{' '}
                  <a href={whatsappHref} className='es-focus-ring font-semibold underline'>
                    {introContent.whatsappHelpCtaLabel}
                  </a>
                </p>
              ) : null}
              <form
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
                  onFullNameChange={setFullName}
                  onFullNameBlur={() => setIsFullNameTouched(true)}
                  onEmailChange={setEmail}
                  onEmailBlur={() => setIsEmailTouched(true)}
                  onPhoneCountryChange={setPhoneCountry}
                  onPhoneChange={setPhone}
                  onPhoneBlur={() => setIsPhoneTouched(true)}
                  onTopicsChange={setInterestedTopics}
                  onTopicsBlur={() => {}}
                />
                <MarketingOptInCheckbox
                  checked={marketingOptIn}
                  onChange={setMarketingOptIn}
                  label={paymentModalContent.marketingOptInLabel}
                />
                <label className='flex items-start gap-2 es-type-body'>
                  <input
                    type='checkbox'
                    checked={hasTermsAgreement}
                    onChange={(ev) => setHasTermsAgreement(ev.target.checked)}
                    className='es-focus-ring mt-1'
                    aria-invalid={isAckTouched && !hasTermsAgreement}
                  />
                  <span>
                    {paymentModalContent.termsAgreementLabel}{' '}
                    <a
                      href={paymentModalContent.termsHref}
                      className='es-focus-ring font-semibold underline'
                    >
                      {paymentModalContent.termsLinkLabel}
                    </a>
                  </span>
                </label>
                {isAckTouched && !hasTermsAgreement ? (
                  <p className='es-form-field-error' role='alert'>
                    {paymentModalContent.acknowledgementRequiredError}
                  </p>
                ) : null}
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
                  className='w-fit'
                  state={isSubmitting ? 'inactive' : 'default'}
                  disabled={
                    isSubmitting
                    || isSuccess
                    || isCaptchaUnavailable
                    || !captchaToken
                  }
                >
                  <SubmitButtonLoadingContent
                    isSubmitting={isSubmitting}
                    idleLabel={introContent.submitLabel}
                    submittingLabel={paymentModalContent.submittingLabel}
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
