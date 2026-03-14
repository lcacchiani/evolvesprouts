'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { useFormSubmission } from '@/components/sections/shared/use-form-submission';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { resolveEventNotificationCopy } from '@/content/copy-normalizers';
import type { EventNotificationContent } from '@/content';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { ServerSubmissionResult } from '@/lib/server-submission-result';
import { isValidEmail } from '@/lib/validation';

interface EventNotificationProps {
  content: EventNotificationContent;
}

const EMAIL_ERROR_MESSAGE_ID = 'event-notification-email-error';
const CAPTCHA_ERROR_MESSAGE_ID = 'event-notification-captcha-error';
const SUBMIT_ERROR_MESSAGE_ID = 'event-notification-submit-error';
const CONTACT_US_API_PATH = '/v1/contact-us';
const FALLBACK_CAPTCHA_REQUIRED_ERROR =
  'Please complete CAPTCHA verification before submitting.';
const FALLBACK_CAPTCHA_LOAD_ERROR = 'CAPTCHA failed to load. Please refresh and try again.';
const FALLBACK_CAPTCHA_UNAVAILABLE_ERROR =
  'CAPTCHA is temporarily unavailable. Please try again later.';

export function EventNotification({ content }: EventNotificationProps) {
  const copy = resolveEventNotificationCopy(content);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const crmApiClient = useMemo(() => createPublicCrmApiClient(), []);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isFormFadingIn, setIsFormFadingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const {
    captchaToken,
    clearSubmissionError,
    handleCaptchaLoadError,
    handleCaptchaTokenChange,
    hasCaptchaLoadError,
    hasCaptchaValidationError,
    hasSuccessfulSubmission,
    isCaptchaConfigured,
    isCaptchaUnavailable,
    isSubmitting,
    markCaptchaTouched,
    markSubmissionSuccess,
    setSubmissionError,
    submitErrorMessage,
    withSubmitting,
  } = useFormSubmission({
    turnstileSiteKey,
  });
  const hasEmailError = isEmailTouched && !isValidEmail(email);
  const submitCtaLabel = content.formSubmitLabel ?? content.ctaLabel;

  const captchaErrorMessage = (() => {
    if (hasCaptchaValidationError) {
      return content.captchaRequiredError ?? FALLBACK_CAPTCHA_REQUIRED_ERROR;
    }
    if (hasCaptchaLoadError) {
      return content.captchaLoadError ?? FALLBACK_CAPTCHA_LOAD_ERROR;
    }
    if (!isCaptchaConfigured) {
      return content.captchaUnavailableError ?? FALLBACK_CAPTCHA_UNAVAILABLE_ERROR;
    }
    return '';
  })();

  useEffect(() => {
    if (!isFormVisible) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      setIsFormFadingIn(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isFormVisible]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearSubmissionError();
    setIsEmailTouched(true);
    markCaptchaTouched();

    if (!isValidEmail(email) || !captchaToken) {
      return;
    }
    if (!crmApiClient || isCaptchaUnavailable) {
      trackAnalyticsEvent('community_signup_submit_error', {
        sectionId: 'event-notification',
        ctaLocation: 'form',
        params: {
          form_type: 'event_notification',
          error_type: 'service_unavailable',
        },
      });
      setSubmissionError(content.submitErrorMessage);
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      return;
    }

    await withSubmitting(async () => {
      const submissionResult = await ServerSubmissionResult.resolve({
        request: () =>
          crmApiClient.request({
            endpointPath: CONTACT_US_API_PATH,
            method: 'POST',
            body: {
              email_address: normalizedEmail,
              message: content.prefilledMessage,
            },
            turnstileToken: captchaToken,
            expectedSuccessStatuses: [200, 202],
          }),
        failureMessage: content.submitErrorMessage,
      });
      if (submissionResult.isSuccess) {
        trackAnalyticsEvent('community_signup_submit_success', {
          sectionId: 'event-notification',
          ctaLocation: 'form',
          params: {
            form_type: 'event_notification',
          },
        });
        markSubmissionSuccess();
        return;
      }

      trackAnalyticsEvent('community_signup_submit_error', {
        sectionId: 'event-notification',
        ctaLocation: 'form',
        params: {
          form_type: 'event_notification',
          error_type: 'api_error',
        },
      });
      setSubmissionError(submissionResult.errorMessage);
    });
  }

  return (
    <SectionShell
      id='event-notification'
      ariaLabel={copy.title}
      dataFigmaNode='event-notification'
      className='overflow-hidden es-event-notification-section'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 es-event-notification-overlay'
      />

      <SectionContainer>
        <div className='es-intro-community-layout'>
          <div className='es-intro-community-layout-content'>
            <SectionHeader
              title={copy.title}
              align='left'
              className='max-w-[620px]'
              titleClassName='leading-[1.12] es-event-notification-heading'
            />
            <p className='max-w-[500px] es-event-notification-support-paragraph'>
              {copy.description}
            </p>
          </div>
          <div className='es-intro-community-layout-cta'>
            <div className='w-full max-w-[500px] lg:max-w-[410px]'>
              <div
                className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-out ${
                  hasSuccessfulSubmission
                    ? 'pointer-events-none grid-rows-[0fr] opacity-0'
                    : 'grid-rows-[1fr] opacity-100'
                }`}
              >
                <form
                  onSubmit={handleSubmit}
                  noValidate
                  className={`flex min-h-0 flex-col gap-3 overflow-hidden transition-opacity duration-300 ease-out motion-reduce:transition-none ${
                    isFormVisible
                      ? isFormFadingIn
                        ? 'opacity-100'
                        : 'opacity-0'
                      : 'opacity-100'
                  }`}
                >
                  {!isFormVisible ? (
                    <ButtonPrimitive
                      variant='primary'
                      type='button'
                      onClick={() => {
                        setIsFormFadingIn(false);
                        setIsFormVisible(true);
                      }}
                      disabled={isSubmitting || hasSuccessfulSubmission}
                    >
                      {content.ctaLabel}
                    </ButtonPrimitive>
                  ) : null}
                  {isFormVisible ? (
                    <>
                      <input
                        type='email'
                        autoComplete='email'
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                        }}
                        onBlur={() => {
                          setIsEmailTouched(true);
                        }}
                        placeholder={content.emailPlaceholder}
                        className={`es-form-input es-event-notification-email-input ${
                          hasEmailError ? 'es-form-input-error' : ''
                        }`}
                        aria-label={content.emailPlaceholder}
                        aria-invalid={hasEmailError}
                        aria-describedby={
                          hasEmailError
                            ? EMAIL_ERROR_MESSAGE_ID
                            : captchaErrorMessage
                              ? CAPTCHA_ERROR_MESSAGE_ID
                              : submitErrorMessage
                                ? SUBMIT_ERROR_MESSAGE_ID
                                : undefined
                        }
                        disabled={isSubmitting || hasSuccessfulSubmission}
                      />
                      {hasEmailError ? (
                        <p id={EMAIL_ERROR_MESSAGE_ID} className='text-sm es-text-danger' role='alert'>
                          {content.emailValidationMessage}
                        </p>
                      ) : null}
                      <TurnstileCaptcha
                        siteKey={turnstileSiteKey}
                        widgetAction='event_notification_submit'
                        onTokenChange={handleCaptchaTokenChange}
                        onLoadError={() => {
                          handleCaptchaLoadError();
                          setSubmissionError(content.captchaLoadError ?? FALLBACK_CAPTCHA_LOAD_ERROR);
                        }}
                      />
                      {captchaErrorMessage ? (
                        <p
                          id={CAPTCHA_ERROR_MESSAGE_ID}
                          className='text-sm es-text-danger'
                          role='alert'
                        >
                          {captchaErrorMessage}
                        </p>
                      ) : null}
                      <ButtonPrimitive
                        variant='primary'
                        type='submit'
                        disabled={isSubmitting || hasSuccessfulSubmission || isCaptchaUnavailable}
                      >
                        {isSubmitting ? `${submitCtaLabel}...` : submitCtaLabel}
                      </ButtonPrimitive>
                      {submitErrorMessage ? (
                        <p
                          id={SUBMIT_ERROR_MESSAGE_ID}
                          className='text-sm es-text-danger'
                          role='alert'
                        >
                          {submitErrorMessage}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </form>
              </div>
              <div
                className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-out ${
                  hasSuccessfulSubmission
                    ? 'mt-1 grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                }`}
                aria-live='polite'
              >
                <div className='flex min-h-0 items-start gap-3 overflow-hidden rounded-xl es-bg-surface-success-pale p-4'>
                  <svg
                    aria-hidden='true'
                    viewBox='0 0 20 20'
                    className='mt-0.5 h-5 w-5 shrink-0'
                    fill='none'
                    xmlns='http://www.w3.org/2000/svg'
                  >
                    <path
                      d='M16.25 5.625L8.125 13.75L3.75 9.375'
                      stroke='var(--es-color-text-success, #2C6C25)'
                      strokeWidth='2.1'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                  </svg>
                  <p className='text-base leading-7 es-text-success'>
                    {content.successMessage}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
