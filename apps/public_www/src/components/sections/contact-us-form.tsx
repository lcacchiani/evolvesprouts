'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
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
import { resolvePublicSiteConfig } from '@/lib/site-config';
import { ServerSubmissionResult } from '@/lib/server-submission-result';

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
const SUBMIT_ERROR_MESSAGE_ID = 'contact-us-form-submit-error';
const CONTACT_US_API_PATH = '/v1/contact-us';
const LINKEDIN_ICON_PATH =
  'M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 ' +
  '.633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 ' +
  '12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248c' +
  '-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 ' +
  '1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-' +
  '.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2' +
  '.22-1.184-3.252-2.764-3.252-1.274 0-1.845.712-2.165 1.213V6.169H6.29c.032' +
  '.682 0 7.225 0 7.225h2.362z';
const INSTAGRAM_ICON_PATH =
  'M9 1.622c2.403 0 2.688.01 3.637.052.877.04 1.354.187 1.671.31.42.163.72.35' +
  '8 1.035.673.315.315.51.615.673 1.035.123.317.27.794.31 1.671.043.95.052 1.2' +
  '34.052 3.637s-.01 2.688-.052 3.637c-.04.877-.187 1.354-.31 1.671a2.786 2.7' +
  '86 0 0 1-.673 1.035 2.786 2.786 0 0 1-1.035.673c-.317.123-.794.27-1.671.31' +
  '-.95.043-1.234.052-3.637.052s-2.688-.01-3.637-.052c-.877-.04-1.354-.187-1' +
  '.671-.31a2.786 2.786 0 0 1-1.035-.673 2.786 2.786 0 0 1-.673-1.035c-.123-' +
  '.317-.27-.794-.31-1.671C1.632 11.688 1.622 11.403 1.622 9s.01-2.688.052-3' +
  '.637c.04-.877.187-1.354.31-1.671.163-.42.358-.72.673-1.035.315-.315.615-.' +
  '51 1.035-.673.317-.123.794-.27 1.671-.31C6.312 1.632 6.597 1.622 9 1.622zM' +
  '9 0C6.556 0 6.249.012 5.289.056 4.331.1 3.677.267 3.105.504a4.408 4.408 0 0' +
  ' 0-1.594 1.038A4.408 4.408 0 0 0 .473 3.136C.237 3.708.07 4.362.025 5.32-.0' +
  '19 6.28-.007 6.587-.007 9.03s.012 2.751.056 3.711c.044.958.211 1.612.448 2' +
  '.184a4.408 4.408 0 0 0 1.038 1.594 4.408 4.408 0 0 0 1.594 1.038c.572.237 ' +
  '1.226.404 2.184.448C6.28 18.019 6.587 18.007 9.03 18.007s2.751-.012 3.711-.' +
  '056c.958-.044 1.612-.211 2.184-.448a4.408 4.408 0 0 0 1.594-1.038 4.408 4.4' +
  '08 0 0 0 1.038-1.594c.237-.572.404-1.226.448-2.184.044-.96.056-1.267.056-3' +
  '.711s-.012-2.751-.056-3.711c-.044-.958-.211-1.612-.448-2.184a4.408 4.408 0' +
  ' 0 0-1.038-1.594A4.408 4.408 0 0 0 14.925.473C14.353.237 13.699.07 12.741.' +
  '025 11.78-.019 11.474-.007 9.03-.007L9 0zm0 4.378a4.622 4.622 0 1 0 0 9.24' +
  '4 4.622 4.622 0 0 0 0-9.244zM9 12a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5.884-7.804' +
  'a1.08 1.08 0 1 0-2.16 0 1.08 1.08 0 0 0 2.16 0z';

type ContactMethodIconType =
  | 'email'
  | 'whatsapp'
  | 'instagram'
  | 'linkedin'
  | 'form';

interface ContactMethodLinkItem {
  key: ContactMethodIconType;
  href: string;
  label: string;
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

function ContactMethodIcon({ type }: { type: ContactMethodIconType }) {
  if (type === 'linkedin') {
    return (
      <svg
        aria-hidden='true'
        viewBox='0 0 16 16'
        className='h-3.5 w-3.5 fill-current'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path d={LINKEDIN_ICON_PATH} />
      </svg>
    );
  }

  if (type === 'instagram') {
    return (
      <svg
        aria-hidden='true'
        viewBox='0 0 18 18'
        className='h-3.5 w-3.5 fill-current'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path d={INSTAGRAM_ICON_PATH} />
      </svg>
    );
  }

  if (type === 'whatsapp') {
    return (
      <svg
        aria-hidden='true'
        viewBox='0 0 20 20'
        className='h-3.5 w-3.5'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M10 3.5a6.5 6.5 0 0 0-5.37 10.17L4 16.5l2.93-.62A6.5 6.5 0 1 0 10 3.5Z'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <path
          d='m7.5 8.2.9 2.1c.08.2.02.42-.13.56l-.5.45a.48.48 0 0 0-.1.56c.33.62.84 1.13 1.46 1.46.2.1.44.06.6-.1l.44-.5c.14-.16.37-.22.57-.14l2.05.9'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    );
  }

  if (type === 'email') {
    return (
      <svg
        aria-hidden='true'
        viewBox='0 0 20 20'
        className='h-3.5 w-3.5'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M3 5.5h14v9H3v-9Z'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <path
          d='m3 6.3 7 5 7-5'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 20 20'
      className='h-3.5 w-3.5'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M6 3.5h8l2 2v11H6v-13Z'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M8 9.5h6M8 12.5h6'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinecap='round'
      />
    </svg>
  );
}

export function ContactUsForm({ content }: ContactUsFormProps) {
  const publicSiteConfig = resolvePublicSiteConfig();
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
  if (publicSiteConfig.contactEmail) {
    contactMethodLinks.push({
      key: 'email',
      href: `mailto:${publicSiteConfig.contactEmail}`,
      label: content.contactMethodLinks.email,
    });
  }
  if (publicSiteConfig.whatsappUrl) {
    contactMethodLinks.push({
      key: 'whatsapp',
      href: publicSiteConfig.whatsappUrl,
      label: content.contactMethodLinks.whatsapp,
    });
  }
  if (publicSiteConfig.instagramUrl) {
    contactMethodLinks.push({
      key: 'instagram',
      href: publicSiteConfig.instagramUrl,
      label: content.contactMethodLinks.instagram,
    });
  }
  if (publicSiteConfig.linkedinUrl) {
    contactMethodLinks.push({
      key: 'linkedin',
      href: publicSiteConfig.linkedinUrl,
      label: content.contactMethodLinks.linkedin,
    });
  }
  contactMethodLinks.push({
    key: 'form',
    href: '#contact-form',
    label: content.contactMethodLinks.form,
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
              <p className='text-sm font-semibold es-text-heading'>
                {content.contactMethodsTitle}
              </p>
              <ul className='mt-3 space-y-2' aria-label={content.contactMethodsTitle}>
                {contactMethodLinks.map((method) => (
                  <li key={method.key}>
                    <SmartLink
                      href={method.href}
                      className='inline-flex items-center gap-2 text-sm leading-6 text-[color:var(--site-primary-text)] transition-opacity hover:opacity-80'
                    >
                      <span
                        aria-hidden='true'
                        className='inline-flex h-4 w-4 shrink-0 items-center justify-center es-text-heading'
                      >
                        <ContactMethodIcon type={method.key} />
                      </span>
                      <span>{method.label}</span>
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
