'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import { mergeClassNames } from '@/lib/class-name-utils';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { ServerSubmissionResult } from '@/lib/server-submission-result';

interface MediaFormProps {
  ctaLabel: string;
  formFirstNameLabel: string;
  formEmailLabel: string;
  formSubmitLabel: string;
  formSuccessTitle: string;
  formSuccessBody: string;
  formErrorMessage: string;
  className?: string;
  onFormOpened?: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEDIA_REQUEST_API_PATH = '/v1/media-request';
const MEDIA_FORM_ERROR_ID = 'media-form-error';

function sanitizeSingleLineValue(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function MediaForm({
  ctaLabel,
  formFirstNameLabel,
  formEmailLabel,
  formSubmitLabel,
  formSuccessTitle,
  formSuccessBody,
  formErrorMessage,
  className,
  onFormOpened,
}: MediaFormProps) {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const crmApiClient = useMemo(() => createPublicCrmApiClient(), []);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [isFirstNameTouched, setIsFirstNameTouched] = useState(false);
  const [isCaptchaTouched, setIsCaptchaTouched] = useState(false);
  const [hasCaptchaLoadError, setHasCaptchaLoadError] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const isCaptchaConfigured = turnstileSiteKey.trim() !== '';
  const isCaptchaUnavailable = !isCaptchaConfigured || hasCaptchaLoadError;
  const hasFirstNameError = isFirstNameTouched && !sanitizeSingleLineValue(firstName);
  const hasEmailError = isEmailTouched && !isValidEmail(email);
  const hasCaptchaError = isCaptchaTouched && !captchaToken;
  const isSubmitDisabled = isSubmitting || isCaptchaUnavailable;
  const shouldShowSubmitError =
    !!submitErrorMessage ||
    hasCaptchaError ||
    hasFirstNameError ||
    hasEmailError ||
    isCaptchaUnavailable;

  function handleOpenForm() {
    setIsFormVisible(true);
    onFormOpened?.();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitErrorMessage('');
    setIsFirstNameTouched(true);
    setIsEmailTouched(true);
    setIsCaptchaTouched(true);

    const normalizedFirstName = sanitizeSingleLineValue(firstName);
    const normalizedEmail = sanitizeSingleLineValue(email).toLowerCase();
    if (!normalizedFirstName || !isValidEmail(normalizedEmail) || !captchaToken) {
      return;
    }
    if (!crmApiClient || isCaptchaUnavailable) {
      setSubmitErrorMessage(formErrorMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      const submissionResult = await ServerSubmissionResult.resolve({
        request: () =>
          crmApiClient.request({
            endpointPath: MEDIA_REQUEST_API_PATH,
            method: 'POST',
            body: {
              first_name: normalizedFirstName,
              email: normalizedEmail,
            },
            turnstileToken: captchaToken,
            expectedSuccessStatuses: [202],
          }),
        failureMessage: formErrorMessage,
      });
      if (submissionResult.isSuccess) {
        setHasSubmitted(true);
        return;
      }

      setSubmitErrorMessage(submissionResult.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (hasSubmitted) {
    return (
      <div className={mergeClassNames('mt-auto max-w-[420px] rounded-xl bg-white p-5', className)}>
        <h4 className='text-xl font-bold es-text-heading'>{formSuccessTitle}</h4>
        <p className='mt-2 text-base leading-7 es-text-body'>{formSuccessBody}</p>
      </div>
    );
  }

  if (!isFormVisible) {
    return (
      <ButtonPrimitive
        variant='primary'
        className={mergeClassNames('mt-auto w-full max-w-[360px]', className)}
        onClick={handleOpenForm}
      >
        {ctaLabel}
      </ButtonPrimitive>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={mergeClassNames('mt-auto w-full max-w-[420px] space-y-3', className)}
      noValidate
    >
      <input
        id='media-first-name'
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
        aria-describedby={shouldShowSubmitError ? MEDIA_FORM_ERROR_ID : undefined}
        required
        disabled={isSubmitting}
      />

      <input
        id='media-email'
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
        aria-describedby={shouldShowSubmitError ? MEDIA_FORM_ERROR_ID : undefined}
        required
        disabled={isSubmitting}
      />

      <TurnstileCaptcha
        siteKey={turnstileSiteKey}
        widgetAction='media_submit'
        size='normal'
        onTokenChange={(token) => {
          setCaptchaToken(token);
          if (token) {
            setHasCaptchaLoadError(false);
            setIsCaptchaTouched(false);
          }
        }}
        onLoadError={() => {
          setHasCaptchaLoadError(true);
        }}
      />

      <ButtonPrimitive
        variant='primary'
        type='submit'
        className='w-full'
        disabled={isSubmitDisabled}
        aria-describedby={shouldShowSubmitError ? MEDIA_FORM_ERROR_ID : undefined}
      >
        {isSubmitting ? `${formSubmitLabel}...` : formSubmitLabel}
      </ButtonPrimitive>

      {shouldShowSubmitError ? (
        <p id={MEDIA_FORM_ERROR_ID} className='text-sm font-semibold es-text-danger-strong' role='alert'>
          {submitErrorMessage || formErrorMessage}
        </p>
      ) : null}
    </form>
  );
}
