'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ContactUsContent } from '@/content';

interface ContactUsFormProps {
  content: ContactUsContent['contactUsForm'];
}

interface FormState {
  firstName: string;
  email: string;
  phone: string;
  message: string;
}

const MESSAGE_MAX_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9()\-\s]{7,20}$/;
const EMAIL_ERROR_MESSAGE_ID = 'contact-us-form-email-error';
const PHONE_ERROR_MESSAGE_ID = 'contact-us-form-phone-error';
const CAPTCHA_ERROR_MESSAGE_ID = 'contact-us-form-captcha-error';

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

function isValidPhone(value: string): boolean {
  const normalizedValue = value.trim();
  if (normalizedValue === '') {
    return true;
  }

  return PHONE_PATTERN.test(normalizedValue);
}

function sanitizeSingleLineValue(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}

function sanitizeMultilineValue(value: string): string {
  return value.replaceAll(/\r\n/g, '\n').replaceAll(/\r/g, '\n').trim();
}

function buildMailtoHref(
  targetEmail: string,
  subject: string,
  formState: FormState,
): string {
  const normalizedFormState = {
    firstName: sanitizeSingleLineValue(formState.firstName),
    email: sanitizeSingleLineValue(formState.email),
    phone: sanitizeSingleLineValue(formState.phone),
    message: sanitizeMultilineValue(formState.message),
  };
  const bodyLines = [
    `First Name: ${normalizedFormState.firstName}`,
    `Email Address: ${normalizedFormState.email}`,
    `Phone Number: ${normalizedFormState.phone}`,
    '',
    'Message:',
    normalizedFormState.message,
  ];

  const query = new URLSearchParams({
    subject: sanitizeSingleLineValue(subject),
    body: bodyLines.join('\n'),
  });

  return `mailto:${sanitizeSingleLineValue(targetEmail)}?${query.toString()}`;
}

export function ContactUsForm({ content }: ContactUsFormProps) {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const [formState, setFormState] = useState<FormState>({
    firstName: '',
    email: '',
    phone: '',
    message: '',
  });
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [isPhoneTouched, setIsPhoneTouched] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaTouched, setIsCaptchaTouched] = useState(false);
  const [hasCaptchaLoadError, setHasCaptchaLoadError] = useState(false);

  const hasEmailError = isEmailTouched && !isValidEmail(formState.email);
  const hasPhoneError = isPhoneTouched && !isValidPhone(formState.phone);
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
  const isSubmitDisabled = isCaptchaUnavailable;

  function updateField(field: keyof FormState, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsEmailTouched(true);
    setIsPhoneTouched(true);
    setIsCaptchaTouched(true);

    if (!isValidEmail(formState.email) || !isValidPhone(formState.phone)) {
      return;
    }
    if (!captchaToken || isCaptchaUnavailable) {
      return;
    }

    const mailtoHref = buildMailtoHref(
      content.emailAddress,
      content.subject,
      formState,
    );

    window.location.href = mailtoHref;
  }

  return (
    <SectionShell
      id='contact-us-form'
      ariaLabel={content.title}
      dataFigmaNode='contact-us-form'
      className='relative overflow-hidden es-contact-us-section'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute left-0 top-0 es-contact-us-left-decor'
      />
      <SectionContainer
        className={buildSectionSplitLayoutClassName('es-section-split-layout--contact-us')}
      >
        <section
          className='relative flex h-full items-start overflow-hidden px-6 py-8 sm:px-8 lg:px-10 lg:pt-[25%]'
        >
          <div className='relative z-10 space-y-6'>
            <SectionHeader
              title={content.title}
              titleAs='h1'
              align='left'
              titleClassName='es-section-heading'
              description={content.description}
              descriptionClassName='mt-4 es-section-body text-[1.05rem] leading-8'
            />
          </div>
        </section>

        <section
          id='contact-form'
          className='relative overflow-visible rounded-shell border es-border-form-shell p-5 shadow-[0_28px_60px_-45px_rgba(17,17,17,0.58)] sm:p-7 lg:p-8 es-contact-us-form-panel'
        >
          <div
            aria-hidden='true'
            className='pointer-events-none absolute left-[58px] top-0 z-20 h-size-30 w-[36px] -translate-y-1/2 bg-contain bg-center bg-no-repeat es-contact-us-decor-green-wedge'
          />
          <div
            aria-hidden='true'
            className='pointer-events-none absolute right-0 top-[130px] z-20 h-[36px] w-[33px] translate-x-1/2 bg-contain bg-center bg-no-repeat es-contact-us-decor-blue-line'
          />

          <div className='relative z-10 mb-6 pt-4'>
            <h2 className='es-type-title'>
              {content.promiseTitle}
            </h2>
            <ul className='mt-4 list-disc space-y-2 pl-6'>
              {content.promises.map((promise) => (
                <li
                  key={promise}
                  className='text-base leading-7 text-[color:var(--site-primary-text)]'
                >
                  {promise}
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={handleSubmit} className='relative z-10 space-y-3'>
            <label className='block'>
              <span className='mb-1 block text-sm font-semibold es-text-heading'>
                {content.firstNameLabel}
              </span>
              <input
                type='text'
                autoComplete='given-name'
                value={formState.firstName}
                onChange={(event) => {
                  updateField('firstName', event.target.value);
                }}
                className='es-focus-ring es-form-input w-full rounded-input border px-4 py-3 text-[16px] font-semibold'
              />
            </label>

            <label className='block'>
              <span className='mb-1 block text-sm font-semibold es-text-heading'>
                {content.emailFieldLabel}
                <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
                  *
                </span>
              </span>
              <input
                type='email'
                required
                autoComplete='email'
                value={formState.email}
                onChange={(event) => {
                  updateField('email', event.target.value);
                  setIsEmailTouched(true);
                }}
                onBlur={() => {
                  setIsEmailTouched(true);
                }}
                className={`es-focus-ring es-form-input w-full rounded-input border px-4 py-3 text-[16px] font-semibold ${hasEmailError ? 'es-form-input-error' : ''}`}
                aria-invalid={hasEmailError}
                aria-describedby={hasEmailError ? EMAIL_ERROR_MESSAGE_ID : undefined}
              />
              {hasEmailError ? (
                <p
                  id={EMAIL_ERROR_MESSAGE_ID}
                  className='text-sm es-text-danger'
                  role='alert'
                >
                  Please enter a valid email address.
                </p>
              ) : null}
            </label>

            <label className='block'>
              <span className='mb-1 block text-sm font-semibold es-text-heading'>
                {content.phoneLabel}
              </span>
              <input
                type='tel'
                autoComplete='tel'
                value={formState.phone}
                onChange={(event) => {
                  updateField('phone', event.target.value);
                }}
                onBlur={() => {
                  setIsPhoneTouched(true);
                }}
                className='es-focus-ring es-form-input w-full rounded-input border px-4 py-3 text-[16px] font-semibold'
                aria-invalid={hasPhoneError}
                aria-describedby={hasPhoneError ? PHONE_ERROR_MESSAGE_ID : undefined}
              />
              {hasPhoneError ? (
                <p
                  id={PHONE_ERROR_MESSAGE_ID}
                  className='text-sm es-text-danger'
                  role='alert'
                >
                  Please enter a valid phone number.
                </p>
              ) : null}
            </label>

            <label className='block'>
              <span className='mb-1 block text-sm font-semibold es-text-heading'>
                {content.messageLabel}
                <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
                  *
                </span>
              </span>
              <textarea
                required
                rows={6}
                maxLength={MESSAGE_MAX_LENGTH}
                value={formState.message}
                onChange={(event) => {
                  updateField('message', event.target.value);
                }}
                placeholder={content.messagePlaceholder}
                className='es-focus-ring es-form-input w-full min-h-[152px] resize-y rounded-input border px-4 py-3 text-[16px] font-semibold'
              />
            </label>

            <label className='block'>
              <span className='mb-1 block text-sm font-semibold es-text-heading'>
                {content.captchaLabel}
              </span>
              <TurnstileCaptcha
                siteKey={turnstileSiteKey}
                widgetAction='contact_us_form_submit'
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
                className='text-sm es-text-danger'
                role='alert'
              >
                {captchaErrorMessage}
              </p>
            ) : null}

            <ButtonPrimitive
              variant='primary'
              type='submit'
              disabled={isSubmitDisabled}
              className='mt-2 w-full'
              aria-describedby={captchaErrorMessage ? CAPTCHA_ERROR_MESSAGE_ID : undefined}
            >
              {content.submitLabel}
            </ButtonPrimitive>
          </form>
        </section>
      </SectionContainer>
    </SectionShell>
  );
}
