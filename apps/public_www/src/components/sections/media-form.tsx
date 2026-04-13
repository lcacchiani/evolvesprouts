'use client';

import type { FormEvent } from 'react';
import { useEffect, useId, useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { SubmitButtonLoadingContent } from '@/components/shared/submit-button-loading-content';
import { MarketingOptInCheckbox } from '@/components/shared/marketing-opt-in-checkbox';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import { useFormSubmission } from '@/components/sections/shared/use-form-submission';
import { trackPublicFormOutcome } from '@/lib/analytics';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import { mergeClassNames } from '@/lib/class-name-utils';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { ServerSubmissionResult } from '@/lib/server-submission-result';
import { isValidEmail, sanitizeSingleLineValue } from '@/lib/validation';
import type { Locale } from '@/content';

interface MediaFormProps {
  ctaLabel: string;
  locale: Locale;
  formMarketingOptInLabel: string;
  formFirstNameLabel: string;
  formEmailLabel: string;
  formSubmitLabel: string;
  formSubmittingLabel: string;
  formSuccessMessage: string;
  formErrorMessage: string;
  resourceKey?: string;
  className?: string;
  /** Extra classes for the closed-state CTA (e.g. `es-btn--outline` for primary outline). */
  ctaButtonClassName?: string;
  analyticsSectionId?: string;
  onFormOpened?: () => void;
}

const MEDIA_REQUEST_API_PATH = '/v1/assets/free/request';
const MAX_RESOURCE_KEY_LENGTH = 64;

function normalizeResourceKey(value: string): string {
  const slug = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, MAX_RESOURCE_KEY_LENGTH)
    .replaceAll(/-+$/g, '');
  return slug;
}

export function MediaForm({
  ctaLabel,
  locale,
  formMarketingOptInLabel,
  formFirstNameLabel,
  formEmailLabel,
  formSubmitLabel,
  formSubmittingLabel,
  formSuccessMessage,
  formErrorMessage,
  resourceKey,
  className,
  ctaButtonClassName,
  analyticsSectionId = 'media-form',
  onFormOpened,
}: MediaFormProps) {
  const mediaFormInstanceId = useId();
  const firstNameInputId = `${mediaFormInstanceId}-media-first-name`;
  const emailInputId = `${mediaFormInstanceId}-media-email`;
  const formErrorId = `${mediaFormInstanceId}-media-form-error`;

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const crmApiClient = useMemo(() => createPublicCrmApiClient(), []);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isFormFadingIn, setIsFormFadingIn] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [isFirstNameTouched, setIsFirstNameTouched] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const {
    captchaToken,
    clearSubmissionError,
    handleCaptchaLoadError,
    handleCaptchaTokenChange,
    hasCaptchaValidationError,
    hasSuccessfulSubmission,
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
  const isServiceUnavailable = !crmApiClient || isCaptchaUnavailable;
  const hasFirstNameError = isFirstNameTouched && !sanitizeSingleLineValue(firstName);
  const hasEmailError = isEmailTouched && !isValidEmail(email);
  const isSubmitDisabled = isSubmitting || isServiceUnavailable;
  const shouldShowSubmitError =
    !!submitErrorMessage ||
    hasCaptchaValidationError ||
    hasFirstNameError ||
    hasEmailError ||
    isServiceUnavailable;

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

  const mediaFormAnalyticsId = `media-form__${analyticsSectionId}`;

  function handleOpenForm() {
    setIsFormFadingIn(false);
    setIsFormVisible(true);
    trackPublicFormOutcome('media_form_open', {
      formKind: 'media_request',
      formId: mediaFormAnalyticsId,
      sectionId: analyticsSectionId,
      ctaLocation: 'cta_button',
      params: {
        resource_key: normalizeResourceKey(resourceKey ?? ''),
      },
    });
    onFormOpened?.();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearSubmissionError();
    setIsFirstNameTouched(true);
    setIsEmailTouched(true);
    markCaptchaTouched();

    const normalizedResourceKey = normalizeResourceKey(resourceKey ?? '');
    trackPublicFormOutcome('media_form_submit_attempt', {
      formKind: 'media_request',
      formId: mediaFormAnalyticsId,
      sectionId: analyticsSectionId,
      ctaLocation: 'form',
      params: {
        resource_key: normalizedResourceKey,
      },
    });

    const normalizedFirstName = sanitizeSingleLineValue(firstName);
    const normalizedEmail = sanitizeSingleLineValue(email).toLowerCase();
    if (!normalizedFirstName || !isValidEmail(normalizedEmail) || !captchaToken) {
      trackPublicFormOutcome('media_form_submit_error', {
        formKind: 'media_request',
        formId: mediaFormAnalyticsId,
        sectionId: analyticsSectionId,
        ctaLocation: 'form',
        params: {
          resource_key: normalizedResourceKey,
          error_type: 'validation_error',
        },
      });
      return;
    }
    if (isServiceUnavailable) {
      trackPublicFormOutcome('media_form_submit_error', {
        formKind: 'media_request',
        formId: mediaFormAnalyticsId,
        sectionId: analyticsSectionId,
        ctaLocation: 'form',
        params: {
          resource_key: normalizedResourceKey,
          error_type: 'service_unavailable',
        },
      });
      setSubmissionError(formErrorMessage);
      return;
    }

    await withSubmitting(async () => {
      const requestBody: Record<string, string | boolean> = {
        first_name: normalizedFirstName,
        email: normalizedEmail,
        marketing_opt_in: marketingOptIn,
        locale,
      };
      if (normalizedResourceKey) {
        requestBody.resource_key = normalizedResourceKey;
      }

      const submissionResult = await ServerSubmissionResult.resolve({
        request: () =>
          crmApiClient.request({
            endpointPath: MEDIA_REQUEST_API_PATH,
            method: 'POST',
            body: requestBody,
            turnstileToken: captchaToken,
            expectedSuccessStatuses: [202],
          }),
        failureMessage: formErrorMessage,
      });
      if (submissionResult.isSuccess) {
        trackPublicFormOutcome('media_form_submit_success', {
          formKind: 'media_request',
          formId: mediaFormAnalyticsId,
          sectionId: analyticsSectionId,
          ctaLocation: 'form',
          params: {
            resource_key: normalizedResourceKey,
          },
        });
        trackMetaPixelEvent('Lead', { content_name: PIXEL_CONTENT_NAME.media_download });
        markSubmissionSuccess();
        return;
      }

      trackPublicFormOutcome('media_form_submit_error', {
        formKind: 'media_request',
        formId: mediaFormAnalyticsId,
        sectionId: analyticsSectionId,
        ctaLocation: 'form',
        params: {
          resource_key: normalizedResourceKey,
          error_type: 'api_error',
        },
      });
      setSubmissionError(submissionResult.errorMessage);
    });
  }

  if (hasSuccessfulSubmission) {
    return (
      <div
        className={mergeClassNames(
          'mt-auto w-full max-w-[420px] min-h-0 overflow-hidden rounded-inner border es-border-success es-bg-surface-success-pale p-4',
          className,
        )}
      >
        <p className='text-base leading-7 es-text-success'>{formSuccessMessage}</p>
      </div>
    );
  }

  if (!isFormVisible) {
    return (
      <ButtonPrimitive
        variant='primary'
        className={mergeClassNames(
          'mt-auto w-full max-w-[360px]',
          ctaButtonClassName,
          className,
        )}
        onClick={handleOpenForm}
      >
        {ctaLabel}
      </ButtonPrimitive>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={mergeClassNames(
        'mt-7 w-full max-w-[420px] space-y-3 opacity-0 transition-opacity duration-300 ease-out motion-reduce:transition-none',
        isFormFadingIn ? 'opacity-100' : null,
        className,
      )}
      noValidate
    >
      <input
        id={firstNameInputId}
        type='text'
        autoComplete='given-name'
        value={firstName}
        onChange={(event) => {
          setFirstName(event.target.value);
        }}
        onBlur={() => {
          setIsFirstNameTouched(true);
        }}
        placeholder={formFirstNameLabel}
        className={`es-form-input ${hasFirstNameError ? 'es-form-input-error' : ''}`}
        aria-label={formFirstNameLabel}
        aria-invalid={hasFirstNameError}
        aria-describedby={shouldShowSubmitError ? formErrorId : undefined}
        required
        disabled={isSubmitting}
      />

      <input
        id={emailInputId}
        type='email'
        autoComplete='email'
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
        onBlur={() => {
          setIsEmailTouched(true);
        }}
        placeholder={formEmailLabel}
        className={`es-form-input ${hasEmailError ? 'es-form-input-error' : ''}`}
        aria-label={formEmailLabel}
        aria-invalid={hasEmailError}
        aria-describedby={shouldShowSubmitError ? formErrorId : undefined}
        required
        disabled={isSubmitting}
      />

      <MarketingOptInCheckbox
        label={formMarketingOptInLabel}
        checked={marketingOptIn}
        onChange={setMarketingOptIn}
      />

      <TurnstileCaptcha
        siteKey={turnstileSiteKey}
        widgetAction='media_submit'
        size='normal'
        onTokenChange={handleCaptchaTokenChange}
        onLoadError={handleCaptchaLoadError}
      />

      <ButtonPrimitive
        variant='primary'
        type='submit'
        className={
          isSubmitting
            ? 'inline-flex w-full items-center justify-center gap-2'
            : 'w-full'
        }
        disabled={isSubmitDisabled}
        aria-describedby={shouldShowSubmitError ? formErrorId : undefined}
      >
        <SubmitButtonLoadingContent
          isSubmitting={isSubmitting}
          submittingLabel={formSubmittingLabel}
          idleLabel={formSubmitLabel}
          loadingGearTestId='media-form-submit-loading-gear'
        />
      </ButtonPrimitive>

      {shouldShowSubmitError ? (
        <p id={formErrorId} className='text-sm font-semibold es-text-danger-strong' role='alert'>
          {submitErrorMessage || formErrorMessage}
        </p>
      ) : null}
    </form>
  );
}
