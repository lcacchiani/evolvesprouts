'use client';

import Image from 'next/image';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import { useFormSubmission } from '@/components/sections/shared/use-form-submission';
import type { EventsContent, SproutsSquadCommunityContent } from '@/content';
import {
  createPublicCrmApiClient,
  isAbortRequestError,
} from '@/lib/crm-api-client';
import {
  type EventCardData,
  fetchEventsPayload,
  normalizeEvents,
  sortPastEvents,
} from '@/lib/events-data';
import { ServerSubmissionResult } from '@/lib/server-submission-result';
import { isValidEmail } from '@/lib/validation';

interface PastEventsProps {
  content: EventsContent;
  newsletterContent: SproutsSquadCommunityContent;
  locale?: string;
}

interface LoadingGearIconProps {
  className?: string;
}

const CALENDAR_ICON_SRC = '/images/calendar.svg';
const CLOCK_ICON_SRC = '/images/clock.svg';
const LOCATION_ICON_SRC = '/images/location.svg';
const CONTACT_US_API_PATH = '/v1/contact-us';
const PAST_EVENTS_EMAIL_ERROR_ID = 'past-events-email-error';
const PAST_EVENTS_CAPTCHA_ERROR_ID = 'past-events-captcha-error';
const PAST_EVENTS_SUBMIT_ERROR_ID = 'past-events-submit-error';
const FALLBACK_CAPTCHA_REQUIRED_ERROR =
  'Please complete CAPTCHA verification before submitting.';
const FALLBACK_CAPTCHA_LOAD_ERROR = 'CAPTCHA failed to load. Please refresh and try again.';
const FALLBACK_CAPTCHA_UNAVAILABLE_ERROR =
  'CAPTCHA is temporarily unavailable. Please try again later.';

function LoadingGearIcon({ className }: LoadingGearIconProps) {
  return (
    <svg
      data-testid='past-events-loading-gear'
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={`es-events-loading-gear ${className ?? ''}`.trim()}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <circle cx='12' cy='12' r='3.25' stroke='currentColor' strokeWidth='1.8' />
      <path d='M12 2.75V5.25' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      <path d='M12 18.75V21.25' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      <path d='M2.75 12H5.25' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      <path d='M18.75 12H21.25' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      <path
        d='M5.46 5.46L7.23 7.23'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <path
        d='M16.77 16.77L18.54 18.54'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <path
        d='M5.46 18.54L7.23 16.77'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <path
        d='M16.77 7.23L18.54 5.46'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
    </svg>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className='flex flex-col items-center gap-3 py-6 text-center sm:py-8'>
      <span
        role='status'
        aria-label={label}
        className='inline-flex h-12 w-12 items-center justify-center rounded-full border es-border-soft es-events-loading-bubble'
      >
        <LoadingGearIcon className='h-7 w-7 animate-spin' />
      </span>
      <p className='es-events-card-body'>{label}</p>
    </div>
  );
}

function EventCardsList({
  content,
  events,
}: {
  content: EventsContent;
  events: EventCardData[];
}) {
  return (
    <ul className='space-y-6'>
      {events.map((eventCard) => (
        <li key={eventCard.id}>
          <article className='rounded-panel es-bg-surface-event-card p-5 sm:p-6 lg:flex lg:items-start lg:justify-between lg:gap-7 lg:p-8'>
            <div className='w-full lg:max-w-[720px]'>
              <div className='flex flex-wrap items-center gap-2'>
                {eventCard.tags.map((tag) => (
                  <span
                    key={`${eventCard.id}-${tag}`}
                    className='inline-flex rounded-3xl border es-border-soft es-bg-peach-glass px-[13px] py-[7px] es-events-card-tag'
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <h3 className='mt-4 text-balance es-events-card-title'>
                {eventCard.title}
              </h3>

              {eventCard.summary && (
                <p className='mt-2 es-events-card-body'>
                  {eventCard.summary}
                </p>
              )}

              <ul className='mt-5 flex flex-wrap items-center gap-2'>
                {eventCard.dateLabel && (
                  <li
                    className='inline-flex items-center gap-1.5 rounded-3xl bg-white px-3 py-[7px] es-events-detail-chip'
                  >
                    <Image
                      src={CALENDAR_ICON_SRC}
                      alt=''
                      aria-hidden='true'
                      width={14}
                      height={14}
                      className='h-3.5 w-3.5'
                    />
                    <span>
                      {content.card.dateLabel}: {eventCard.dateLabel}
                    </span>
                  </li>
                )}
                {eventCard.timeLabel && (
                  <li
                    className='inline-flex items-center gap-1.5 rounded-3xl bg-white px-3 py-[7px] es-events-detail-chip'
                  >
                    <Image
                      src={CLOCK_ICON_SRC}
                      alt=''
                      aria-hidden='true'
                      width={14}
                      height={14}
                      className='h-3.5 w-3.5'
                    />
                    <span>
                      {content.card.timeLabel}: {eventCard.timeLabel}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <aside className='mt-6 w-full rounded-lg bg-white px-4 py-5 lg:mt-0 lg:max-w-[335px]'>
              <h4 className='es-events-location-heading'>
                {content.card.locationLabel}
              </h4>
              <p className='mt-2 es-events-location-text'>
                {eventCard.locationName ?? content.card.emptyLocationLabel}
              </p>
              {eventCard.locationAddress && (
                <p className='mt-1 es-events-location-text'>
                  {eventCard.locationAddress}
                </p>
              )}

              <div className='mt-5'>
                {eventCard.status === 'fully_booked' ? (
                  <span
                    className='inline-flex items-center gap-1 rounded-3xl es-bg-surface-danger-soft px-3 py-[9px] es-events-detail-chip es-events-detail-chip-danger'
                  >
                    <Image
                      src={LOCATION_ICON_SRC}
                      alt=''
                      aria-hidden='true'
                      width={14}
                      height={14}
                      className='h-3.5 w-3.5'
                    />
                    <span>{content.card.fullyBookedLabel}</span>
                  </span>
                ) : (
                  eventCard.ctaHref && (
                    <SectionCtaAnchor
                      href={eventCard.ctaHref}
                      className='w-full'
                    >
                      {eventCard.ctaLabel}
                    </SectionCtaAnchor>
                  )
                )}
              </div>
            </aside>
          </article>
        </li>
      ))}
    </ul>
  );
}

export function PastEvents({
  content,
  newsletterContent,
  locale = 'en',
}: PastEventsProps) {
  const crmApiClient = useMemo(() => createPublicCrmApiClient(), []);
  const [events, setEvents] = useState<EventCardData[]>([]);
  const [isLoading, setIsLoading] = useState(() => crmApiClient !== null);
  const [hasRequestError, setHasRequestError] = useState(() => crmApiClient === null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [isNotifyEmailTouched, setIsNotifyEmailTouched] = useState(false);
  const [isNotifyFormVisible, setIsNotifyFormVisible] = useState(false);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const {
    captchaToken: notifyCaptchaToken,
    clearSubmissionError: clearNotifySubmissionError,
    handleCaptchaLoadError: handleNotifyCaptchaLoadError,
    handleCaptchaTokenChange: handleNotifyCaptchaTokenChange,
    hasCaptchaLoadError: hasNotifyCaptchaLoadError,
    hasCaptchaValidationError: hasNotifyCaptchaValidationError,
    hasSuccessfulSubmission: hasNotifySuccessfulSubmission,
    isCaptchaConfigured: isNotifyCaptchaConfigured,
    isCaptchaUnavailable: isNotifyCaptchaUnavailable,
    isSubmitting: isNotifySubmitting,
    markCaptchaTouched: markNotifyCaptchaTouched,
    markSubmissionSuccess: markNotifySubmissionSuccess,
    setSubmissionError: setNotifySubmissionError,
    submitErrorMessage: notifySubmitErrorMessage,
    withSubmitting: withNotifySubmitting,
  } = useFormSubmission({
    turnstileSiteKey,
  });

  useEffect(() => {
    const controller = new AbortController();

    if (!crmApiClient) {
      return () => {
        controller.abort();
      };
    }

    fetchEventsPayload(crmApiClient, controller.signal)
      .then((payload) => {
        const normalizedEvents = normalizeEvents(payload, content, locale);
        setHasRequestError(false);
        setEvents(normalizedEvents);
      })
      .catch((error) => {
        if (isAbortRequestError(error)) {
          return;
        }

        setEvents([]);
        setHasRequestError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [content, locale, crmApiClient]);

  const visibleEvents = useMemo(() => {
    return sortPastEvents(events);
  }, [events]);

  const hasNotifyEmailError = isNotifyEmailTouched && !isValidEmail(notifyEmail);
  const notifySubmitLabel = content.past.notifyCtaLabel;
  const notifyCaptchaErrorMessage = (() => {
    if (hasNotifyCaptchaValidationError) {
      return newsletterContent.captchaRequiredError ?? FALLBACK_CAPTCHA_REQUIRED_ERROR;
    }
    if (hasNotifyCaptchaLoadError) {
      return newsletterContent.captchaLoadError ?? FALLBACK_CAPTCHA_LOAD_ERROR;
    }
    if (!isNotifyCaptchaConfigured) {
      return newsletterContent.captchaUnavailableError ?? FALLBACK_CAPTCHA_UNAVAILABLE_ERROR;
    }

    return '';
  })();

  async function handleNotifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotifySubmissionError();
    setIsNotifyEmailTouched(true);
    markNotifyCaptchaTouched();

    if (!isValidEmail(notifyEmail) || !notifyCaptchaToken) {
      return;
    }
    if (!crmApiClient || isNotifyCaptchaUnavailable) {
      setNotifySubmissionError(newsletterContent.submitErrorMessage);
      return;
    }

    const normalizedEmail = notifyEmail.trim();
    if (!normalizedEmail) {
      return;
    }

    await withNotifySubmitting(async () => {
      const submissionResult = await ServerSubmissionResult.resolve({
        request: () =>
          crmApiClient.request({
            endpointPath: CONTACT_US_API_PATH,
            method: 'POST',
            body: {
              email_address: normalizedEmail,
              message: newsletterContent.prefilledMessage,
            },
            turnstileToken: notifyCaptchaToken,
            expectedSuccessStatuses: [200, 202],
          }),
        failureMessage: newsletterContent.submitErrorMessage,
      });
      if (submissionResult.isSuccess) {
        markNotifySubmissionSuccess();
        return;
      }

      setNotifySubmissionError(submissionResult.errorMessage);
    });
  }

  return (
    <SectionShell
      id='past-events'
      ariaLabel={content.past.title}
      dataFigmaNode='past-events'
      className='es-events-section pt-0 sm:pt-[60px]'
    >
      <SectionContainer>
        <SectionHeader
          title={content.past.title}
          titleAs='h2'
          descriptionClassName='es-type-body mt-4'
        />
        <div className='mt-8'>
          {isLoading ? (
            <LoadingState label={content.loadingLabel} />
          ) : visibleEvents.length === 0 ? (
            <div className='rounded-panel border es-border-event-card es-bg-surface-event-card px-5 py-7 text-center sm:px-8 sm:py-10'>
              <p className='es-events-card-body'>{content.past.emptyStateLabel}</p>
              {hasRequestError && (
                <p className='mt-3 text-sm text-black/60'>{content.errorLabel}</p>
              )}
            </div>
          ) : (
            <EventCardsList content={content} events={visibleEvents} />
          )}
        </div>
        <div className='mt-8 rounded-panel border es-border-event-card es-bg-surface-event-card px-5 py-7 sm:px-8 sm:py-8'>
          <p className='es-events-card-body'>{content.past.notifyPrompt}</p>
          {!hasNotifySuccessfulSubmission ? (
            <form onSubmit={handleNotifySubmit} noValidate className='mt-4 flex flex-col gap-3'>
              {!isNotifyFormVisible ? (
                <ButtonPrimitive
                  variant='primary'
                  type='button'
                  className='w-full sm:w-auto'
                  onClick={() => {
                    clearNotifySubmissionError();
                    setIsNotifyFormVisible(true);
                  }}
                  disabled={isNotifySubmitting}
                >
                  {content.past.notifyCtaLabel}
                </ButtonPrimitive>
              ) : (
                <>
                  <input
                    type='email'
                    autoComplete='email'
                    value={notifyEmail}
                    onChange={(event) => {
                      setNotifyEmail(event.target.value);
                    }}
                    onBlur={() => {
                      setIsNotifyEmailTouched(true);
                    }}
                    placeholder={newsletterContent.emailPlaceholder}
                    className={`es-form-input sm:max-w-[420px] ${
                      hasNotifyEmailError ? 'es-form-input-error' : ''
                    }`}
                    aria-label={newsletterContent.emailPlaceholder}
                    aria-invalid={hasNotifyEmailError}
                    aria-describedby={
                      hasNotifyEmailError
                        ? PAST_EVENTS_EMAIL_ERROR_ID
                        : notifyCaptchaErrorMessage
                          ? PAST_EVENTS_CAPTCHA_ERROR_ID
                          : notifySubmitErrorMessage
                            ? PAST_EVENTS_SUBMIT_ERROR_ID
                            : undefined
                    }
                    disabled={isNotifySubmitting}
                  />
                  {hasNotifyEmailError ? (
                    <p
                      id={PAST_EVENTS_EMAIL_ERROR_ID}
                      className='text-sm es-text-danger'
                      role='alert'
                    >
                      {newsletterContent.emailValidationMessage}
                    </p>
                  ) : null}
                  <TurnstileCaptcha
                    siteKey={turnstileSiteKey}
                    widgetAction='past_events_notify_submit'
                    onTokenChange={handleNotifyCaptchaTokenChange}
                    onLoadError={() => {
                      handleNotifyCaptchaLoadError();
                      setNotifySubmissionError(
                        newsletterContent.captchaLoadError ?? FALLBACK_CAPTCHA_LOAD_ERROR,
                      );
                    }}
                  />
                  {notifyCaptchaErrorMessage ? (
                    <p
                      id={PAST_EVENTS_CAPTCHA_ERROR_ID}
                      className='text-sm es-text-danger'
                      role='alert'
                    >
                      {notifyCaptchaErrorMessage}
                    </p>
                  ) : null}
                  <ButtonPrimitive
                    variant='primary'
                    type='submit'
                    className='w-full sm:w-auto'
                    disabled={isNotifySubmitting || isNotifyCaptchaUnavailable}
                  >
                    {isNotifySubmitting ? `${notifySubmitLabel}...` : notifySubmitLabel}
                  </ButtonPrimitive>
                  {notifySubmitErrorMessage ? (
                    <p
                      id={PAST_EVENTS_SUBMIT_ERROR_ID}
                      className='text-sm es-text-danger'
                      role='alert'
                    >
                      {notifySubmitErrorMessage}
                    </p>
                  ) : null}
                </>
              )}
            </form>
          ) : (
            <div className='mt-4 rounded-xl es-bg-surface-success-pale p-4' aria-live='polite'>
              <p className='text-base leading-7 es-text-success'>
                {newsletterContent.successMessage}
              </p>
            </div>
          )}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
