'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';

import {
  ContactFormFields,
  type ContactUsFormState,
} from '@/components/sections/contact-us-form-fields';
import {
  ContactMethodList,
  type ContactMethodLinkItem,
} from '@/components/sections/contact-us-form-contact-method-list';
import { ContactFormSuccess } from '@/components/sections/contact-us-form-success';
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9()\-\s]{7,20}$/;
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
  const [formState, setFormState] = useState<ContactUsFormState>({
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

  function updateField(field: keyof ContactUsFormState, value: string) {
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
            <ContactMethodList title={content.contactMethodsTitle} methods={contactMethodLinks} />
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
            <ContactFormSuccess
              title={content.successTitle}
              description={content.successDescription}
            />
          ) : (
            <ContactFormFields
              content={content}
              formState={formState}
              hasEmailError={hasEmailError}
              hasPhoneError={hasPhoneError}
              captchaErrorMessage={captchaErrorMessage}
              submitErrorMessage={submitErrorMessage}
              turnstileSiteKey={turnstileSiteKey}
              isSubmitDisabled={isSubmitDisabled}
              onSubmit={handleSubmit}
              onUpdateField={updateField}
              onEmailBlur={() => {
                setIsEmailTouched(true);
              }}
              onPhoneBlur={() => {
                setIsPhoneTouched(true);
              }}
              onCaptchaTokenChange={(token) => {
                setCaptchaToken(token);
                if (token) {
                  setIsCaptchaTouched(false);
                  setHasCaptchaLoadError(false);
                }
              }}
              onCaptchaLoadError={() => {
                setHasCaptchaLoadError(true);
              }}
            />
          )}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
