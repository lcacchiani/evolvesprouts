'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import {
  SubmitButtonLoadingContent,
  submitButtonClassName,
} from '@/components/shared/submit-button-loading-content';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import {
  resolveCaptchaErrorMessage,
  useFormSubmission,
} from '@/components/sections/shared/use-form-submission';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { resolveEventNotificationCopy } from '@/content/copy-normalizers';
import type {
  CommonContent,
  EventNotificationContent,
  Locale,
} from '@/content';
import { trackPublicFormOutcome } from '@/lib/analytics';
import { CONTACT_US_API_PATH } from '@/lib/api-paths';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { ServerSubmissionResult } from '@/lib/server-submission-result';
import { isValidEmail, resolveEmailSignupFirstName } from '@/lib/validation';

interface EventNotificationProps {
  content: EventNotificationContent;
  commonCaptchaContent: CommonContent['captcha'];
  commonFormActionsContent: CommonContent['formActions'];
  locale: Locale;
}

const EMAIL_ERROR_MESSAGE_ID = 'event-notification-email-error';
const CAPTCHA_ERROR_MESSAGE_ID = 'event-notification-captcha-error';
const SUBMIT_ERROR_MESSAGE_ID = 'event-notification-submit-error';
const EVENT_NOTIFICATION_FORM_ANALYTICS_ID = 'event-notification-signup';

export function EventNotification({
  content,
  commonCaptchaContent,
  commonFormActionsContent,
  locale,
}: EventNotificationProps) {
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
  const submitLoadingLabel = commonFormActionsContent.submittingLabel;
  const captchaLabel = commonCaptchaContent.captchaLabel;

  const captchaErrorMessage = resolveCaptchaErrorMessage(
    {
      isCaptchaConfigured,
      hasCaptchaLoadError,
      hasCaptchaValidationError,
    },
    {
      requiredError:
        content.captchaRequiredError ?? commonCaptchaContent.requiredError,
      loadError: content.captchaLoadError ?? commonCaptchaContent.loadError,
      unavailableError:
        content.captchaUnavailableError ?? commonCaptchaContent.unavailableError,
    },
  );
  const submitButtonDescribedByParts = [
    captchaErrorMessage ? CAPTCHA_ERROR_MESSAGE_ID : null,
    submitErrorMessage ? SUBMIT_ERROR_MESSAGE_ID : null,
  ].filter((id): id is string => id !== null);
  const submitButtonDescribedBy =
    submitButtonDescribedByParts.length > 0
      ? submitButtonDescribedByParts.join(' ')
      : undefined;

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

    trackPublicFormOutcome('community_signup_submit_attempt', {
      formKind: 'community',
      formId: EVENT_NOTIFICATION_FORM_ANALYTICS_ID,
      sectionId: 'event-notification',
      ctaLocation: 'form',
      params: {
        form_type: 'event_notification',
      },
    });

    if (!isValidEmail(email) || !captchaToken) {
      trackPublicFormOutcome('community_signup_submit_error', {
        formKind: 'community',
        formId: EVENT_NOTIFICATION_FORM_ANALYTICS_ID,
        sectionId: 'event-notification',
        ctaLocation: 'form',
        params: {
          form_type: 'event_notification',
          error_type: 'validation_error',
        },
      });
      return;
    }
    if (!crmApiClient || isCaptchaUnavailable) {
      trackPublicFormOutcome('community_signup_submit_error', {
        formKind: 'community',
        formId: EVENT_NOTIFICATION_FORM_ANALYTICS_ID,
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
      trackPublicFormOutcome('community_signup_submit_error', {
        formKind: 'community',
        formId: EVENT_NOTIFICATION_FORM_ANALYTICS_ID,
        sectionId: 'event-notification',
        ctaLocation: 'form',
        params: {
          form_type: 'event_notification',
          error_type: 'validation_error',
        },
      });
      return;
    }
    const derivedFirstName = resolveEmailSignupFirstName(
      normalizedEmail,
      content.emailSignupFirstNameFallback,
    );

    await withSubmitting(async () => {
      const submissionResult = await ServerSubmissionResult.resolve({
        request: () =>
          crmApiClient.request({
            endpointPath: CONTACT_US_API_PATH,
            method: 'POST',
            body: {
              email_address: normalizedEmail,
              first_name: derivedFirstName,
              message: content.prefilledMessage,
              marketing_opt_in: true,
              locale,
              signup_intent: 'event_notification',
            },
            turnstileToken: captchaToken,
            expectedSuccessStatuses: [200, 202],
          }),
        failureMessage: content.submitErrorMessage,
      });
      if (submissionResult.isSuccess) {
        trackPublicFormOutcome('community_signup_submit_success', {
          formKind: 'community',
          formId: EVENT_NOTIFICATION_FORM_ANALYTICS_ID,
          sectionId: 'event-notification',
          ctaLocation: 'form',
          params: {
            form_type: 'event_notification',
          },
        });
        trackMetaPixelEvent('Lead', { content_name: PIXEL_CONTENT_NAME.event_notification });
        markSubmissionSuccess();
        return;
      }

      trackPublicFormOutcome('community_signup_submit_error', {
        formKind: 'community',
        formId: EVENT_NOTIFICATION_FORM_ANALYTICS_ID,
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
              {renderQuotedDescriptionText(copy.description)}
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
                          className={`es-focus-ring es-form-input ${
                            hasEmailError ? 'es-form-input-error' : ''
                          }`}
                          aria-invalid={hasEmailError}
                          aria-describedby={
                            hasEmailError ? EMAIL_ERROR_MESSAGE_ID : undefined
                          }
                          disabled={isSubmitting || hasSuccessfulSubmission}
                        />
                      </label>
                      {hasEmailError ? (
                        <p
                          id={EMAIL_ERROR_MESSAGE_ID}
                          className='es-form-field-error'
                          role='alert'
                        >
                          {content.emailValidationMessage}
                        </p>
                      ) : null}
                      <label className='block'>
                        <span className='mb-1 block text-sm font-semibold es-text-heading'>
                          {captchaLabel}
                        </span>
                        <TurnstileCaptcha
                          siteKey={turnstileSiteKey}
                          widgetAction='event_notification_submit'
                          onTokenChange={handleCaptchaTokenChange}
                          onLoadError={() => {
                            handleCaptchaLoadError();
                            setSubmissionError(
                              content.captchaLoadError ?? commonCaptchaContent.loadError,
                            );
                          }}
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
                      <ButtonPrimitive
                        variant='primary'
                        type='submit'
                        disabled={isSubmitting || hasSuccessfulSubmission || isCaptchaUnavailable}
                        className={submitButtonClassName(isSubmitting)}
                        aria-describedby={submitButtonDescribedBy}
                      >
                        <SubmitButtonLoadingContent
                          isSubmitting={isSubmitting}
                          submittingLabel={submitLoadingLabel}
                          idleLabel={submitCtaLabel}
                          loadingGearTestId='event-notification-submit-loading-gear'
                        />
                      </ButtonPrimitive>
                      {submitErrorMessage ? (
                        <p
                          id={SUBMIT_ERROR_MESSAGE_ID}
                          className='es-form-submit-error'
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
                <div className='es-public-form-success-panel'>
                  <p className='es-public-form-success-panel-message'>
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
