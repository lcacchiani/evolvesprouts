'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';

import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import {
  EventCardsList,
  EventsLoadingState,
  useEventCards,
} from '@/components/sections/shared/events-shared';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import { useFormSubmission } from '@/components/sections/shared/use-form-submission';
import type { EventsContent, SproutsSquadCommunityContent } from '@/content';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { sortPastEvents } from '@/lib/events-data';
import { ServerSubmissionResult } from '@/lib/server-submission-result';
import { isValidEmail } from '@/lib/validation';

interface PastEventsProps {
  content: EventsContent;
  newsletterContent: SproutsSquadCommunityContent;
  locale?: string;
}

const CONTACT_US_API_PATH = '/v1/contact-us';
const PAST_EVENTS_EMAIL_ERROR_ID = 'past-events-email-error';
const PAST_EVENTS_CAPTCHA_ERROR_ID = 'past-events-captcha-error';
const PAST_EVENTS_SUBMIT_ERROR_ID = 'past-events-submit-error';
const FALLBACK_CAPTCHA_REQUIRED_ERROR =
  'Please complete CAPTCHA verification before submitting.';
const FALLBACK_CAPTCHA_LOAD_ERROR = 'CAPTCHA failed to load. Please refresh and try again.';
const FALLBACK_CAPTCHA_UNAVAILABLE_ERROR =
  'CAPTCHA is temporarily unavailable. Please try again later.';

export function PastEvents({
  content,
  newsletterContent,
  locale = 'en',
}: PastEventsProps) {
  const crmApiClient = useMemo(() => createPublicCrmApiClient(), []);
  const {
    visibleEvents,
    isLoading,
    hasRequestError,
  } = useEventCards({
    content,
    locale,
    sortEventCards: sortPastEvents,
  });
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
            <EventsLoadingState
              label={content.loadingLabel}
              testId='past-events-loading-gear'
            />
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
