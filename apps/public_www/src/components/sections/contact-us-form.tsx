'use client';

import Image from 'next/image';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { ExternalLinkInlineContent } from '@/components/shared/external-link-icon';
import { SmartLink } from '@/components/shared/smart-link';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ContactUsContent } from '@/content';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import type { PublicSiteConfig } from '@/lib/site-config';
import { ServerSubmissionResult } from '@/lib/server-submission-result';

export type ContactUsFormContactConfig = Pick<
  PublicSiteConfig,
  'contactEmail' | 'whatsappUrl' | 'instagramUrl' | 'linkedinUrl'
>;

interface ContactUsFormProps {
  content: ContactUsContent['contactUsForm'];
  contactConfig: ContactUsFormContactConfig;
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
const SUBMIT_ERROR_MESSAGE_ID = 'contact-us-form-submit-error';
const CONTACT_US_API_PATH = '/v1/contact-us';
type ContactMethodKey =
  | 'email'
  | 'whatsapp'
  | 'instagram'
  | 'linkedin'
  | 'form';

const CONTACT_METHOD_ICON_SOURCES: Record<ContactMethodKey, string> = {
  email: '/images/contact-email.svg',
  whatsapp: '/images/contact-whatsapp.svg',
  instagram: '/images/contact-instagram.svg',
  linkedin: '/images/contact-linkedin.svg',
  form: '/images/contact-form.svg',
};

interface ContactMethodLinkItem {
  key: ContactMethodKey;
  href: string;
  label: string;
  iconSrc: string;
}

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

export function ContactUsForm({ content, contactConfig }: ContactUsFormProps) {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const crmApiClient = useMemo(() => createPublicCrmApiClient(), []);
  const [formState, setFormState] = useState<FormState>({
    firstName: '',
    email: '',
    phone: '',
    message: '',
  });
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [isPhoneTouched, setIsPhoneTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaTouched, setIsCaptchaTouched] = useState(false);
  const [hasCaptchaLoadError, setHasCaptchaLoadError] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');
  const [hasSuccessfulSubmission, setHasSuccessfulSubmission] = useState(false);

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
  const isSubmitDisabled = isCaptchaUnavailable || isSubmitting;
  const contactMethodLinks: ContactMethodLinkItem[] = [];
  if (contactConfig.contactEmail) {
    contactMethodLinks.push({
      key: 'email',
      href: `mailto:${contactConfig.contactEmail}`,
      label: content.contactMethodLinks.mail,
      iconSrc: CONTACT_METHOD_ICON_SOURCES.email,
    });
  }
  if (contactConfig.whatsappUrl) {
    contactMethodLinks.push({
      key: 'whatsapp',
      href: contactConfig.whatsappUrl,
      label: content.contactMethodLinks.whatsapp,
      iconSrc: CONTACT_METHOD_ICON_SOURCES.whatsapp,
    });
  }
  if (contactConfig.instagramUrl) {
    contactMethodLinks.push({
      key: 'instagram',
      href: contactConfig.instagramUrl,
      label: content.contactMethodLinks.instagram,
      iconSrc: CONTACT_METHOD_ICON_SOURCES.instagram,
    });
  }
  if (contactConfig.linkedinUrl) {
    contactMethodLinks.push({
      key: 'linkedin',
      href: contactConfig.linkedinUrl,
      label: content.contactMethodLinks.linkedin,
      iconSrc: CONTACT_METHOD_ICON_SOURCES.linkedin,
    });
  }
  contactMethodLinks.push({
    key: 'form',
    href: '#contact-form',
    label: content.contactMethodLinks.form,
    iconSrc: CONTACT_METHOD_ICON_SOURCES.form,
  });

  function updateField(field: keyof FormState, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitErrorMessage('');
    setIsEmailTouched(true);
    setIsPhoneTouched(true);
    setIsCaptchaTouched(true);

    if (!isValidEmail(formState.email) || !isValidPhone(formState.phone)) {
      return;
    }
    if (!captchaToken || isCaptchaUnavailable) {
      return;
    }
    if (!crmApiClient) {
      return;
    }

    const normalizedEmail = sanitizeSingleLineValue(formState.email);
    const normalizedMessage = sanitizeMultilineValue(formState.message);
    if (!normalizedEmail || !normalizedMessage) {
      return;
    }
    const normalizedFirstName = sanitizeSingleLineValue(formState.firstName);
    const normalizedPhone = sanitizeSingleLineValue(formState.phone);
    const requestBody: {
      first_name?: string;
      email_address: string;
      phone_number?: string;
      message: string;
    } = {
      email_address: normalizedEmail,
      message: normalizedMessage,
    };
    if (normalizedFirstName) {
      requestBody.first_name = normalizedFirstName;
    }
    if (normalizedPhone) {
      requestBody.phone_number = normalizedPhone;
    }

    setIsSubmitting(true);
    try {
      const submissionResult = await ServerSubmissionResult.resolve({
        request: () =>
          crmApiClient.request({
            endpointPath: CONTACT_US_API_PATH,
            method: 'POST',
            body: requestBody,
            expectedSuccessStatuses: [200, 202],
          }),
        failureMessage: content.submitErrorMessage,
      });
      if (submissionResult.isSuccess) {
        setHasSuccessfulSubmission(true);
        return;
      }

      setSubmitErrorMessage(submissionResult.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
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
        <div className='relative z-10 flex h-full items-start overflow-hidden py-8 lg:pt-[25%]'>
          <div>
            <SectionHeader
              title={content.title}
              titleAs='h1'
              align='left'
              titleClassName='es-section-heading'
              description={content.description}
              descriptionClassName='mt-4 es-section-body text-[1.05rem] leading-8'
            />
            <div className='mt-6'>
              <p className='es-section-body text-[1.05rem] leading-8'>
                {content.contactMethodsTitle}
              </p>
              <ul className='mt-3 space-y-2' aria-label={content.contactMethodsTitle}>
                {contactMethodLinks.map((method) => (
                  <li key={method.key}>
                    <SmartLink
                      href={method.href}
                      className='inline-flex items-center gap-2 es-section-body text-[1.05rem] leading-8 transition-opacity hover:opacity-80'
                    >
                      {({ isExternalHttp }) => (
                        <>
                          <span
                            aria-hidden='true'
                            data-testid={`contact-method-icon-${method.key}`}
                            className='inline-flex h-4 w-4 shrink-0 items-center justify-center es-text-heading'
                          >
                            <Image
                              src={method.iconSrc}
                              alt=''
                              width={16}
                              height={16}
                              className={
                                method.key === 'whatsapp'
                                  ? 'h-4 w-4 es-contact-us-contact-method-icon--whatsapp'
                                  : 'h-4 w-4'
                              }
                            />
                          </span>
                          <ExternalLinkInlineContent isExternalHttp={isExternalHttp}>
                            {method.label}
                          </ExternalLinkInlineContent>
                        </>
                      )}
                    </SmartLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div
          id='contact-form'
          className='relative overflow-visible rounded-[28px] border es-border-form-shell p-5 shadow-panel sm:p-7 lg:p-8 es-contact-us-form-panel'
        >
          <div
            aria-hidden='true'
            className='pointer-events-none absolute left-[58px] top-0 z-20 h-[30px] w-[36px] -translate-y-1/2 bg-contain bg-center bg-no-repeat es-contact-us-decor-green-wedge'
          />
          <div
            aria-hidden='true'
            className='pointer-events-none absolute right-0 top-[130px] z-20 h-[36px] w-[33px] translate-x-1/2 bg-contain bg-center bg-no-repeat es-contact-us-decor-blue-line'
          />

          <div className='relative z-10 mb-6 pt-4'>
            <h2 className='es-type-title'>
              {content.promiseTitle}
            </h2>
            <ul className='mt-4 space-y-2'>
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

          {hasSuccessfulSubmission ? (
            <div className='relative z-10 rounded-2xl es-bg-surface-muted px-5 py-6 text-center'>
              <h3 className='text-2xl font-semibold es-text-heading'>
                {content.successTitle}
              </h3>
              <p className='mt-3 text-base leading-7 text-[color:var(--site-primary-text)]'>
                {content.successDescription}
              </p>
            </div>
          ) : (
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
                  className='es-focus-ring es-form-input'
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
                  }}
                  onBlur={() => {
                    setIsEmailTouched(true);
                  }}
                  className={`es-focus-ring es-form-input ${hasEmailError ? 'es-form-input-error' : ''}`}
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
                  className='es-focus-ring es-form-input'
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
                  className='es-focus-ring es-form-input min-h-[152px] resize-y'
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
                aria-describedby={
                  captchaErrorMessage
                    ? CAPTCHA_ERROR_MESSAGE_ID
                    : submitErrorMessage
                      ? SUBMIT_ERROR_MESSAGE_ID
                      : undefined
                }
              >
                {content.submitLabel}
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
            </form>
          )}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
