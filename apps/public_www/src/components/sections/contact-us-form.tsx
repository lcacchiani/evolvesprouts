'use client';

import Image from 'next/image';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import {
  ContactFormFields,
  type ContactUsFormState,
} from '@/components/sections/contact-us-form-fields';
import { ContactFormSuccess } from '@/components/sections/contact-us-form-success';
import { useFormSubmission } from '@/components/sections/shared/use-form-submission';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { ContactUsContent, Locale } from '@/content';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { CONTACT_US_API_PATH } from '@/lib/api-paths';
import { mergeClassNames } from '@/lib/class-name-utils';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import { ServerSubmissionResult } from '@/lib/server-submission-result';
import type { PublicSiteConfig } from '@/lib/site-config';
import { isValidEmail, sanitizeSingleLineValue } from '@/lib/validation';

export type ContactUsFormContactConfig = Pick<
  PublicSiteConfig,
  'contactEmail' | 'whatsappUrl' | 'instagramUrl' | 'linkedinUrl'
>;

interface ContactUsFormProps {
  content: ContactUsContent['form'];
  locale: Locale;
  contactConfig: ContactUsFormContactConfig;
}

const PHONE_PATTERN = /^\+?[0-9()\-\s]{7,20}$/;
const WHATSAPP_ICON_SRC = '/images/contact-whatsapp.svg';

function isValidPhone(value: string): boolean {
  const normalizedValue = value.trim();
  if (normalizedValue === '') {
    return true;
  }

  return PHONE_PATTERN.test(normalizedValue);
}

function sanitizeMultilineValue(value: string): string {
  return value.replaceAll(/\r\n/g, '\n').replaceAll(/\r/g, '\n').trim();
}

export function ContactUsForm({ content, locale, contactConfig }: ContactUsFormProps) {
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
  const [isFirstNameTouched, setIsFirstNameTouched] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
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

  const hasEmailError = isEmailTouched && !isValidEmail(formState.email);
  const hasPhoneError = isPhoneTouched && !isValidPhone(formState.phone);
  const hasFirstNameError =
    isFirstNameTouched && !sanitizeSingleLineValue(formState.firstName);
  const captchaErrorMessage = !isCaptchaConfigured
    ? content.captchaUnavailableError
    : hasCaptchaLoadError
      ? content.captchaLoadError
      : hasCaptchaValidationError
        ? content.captchaRequiredError
        : '';
  const isSubmitDisabled = isCaptchaUnavailable || isSubmitting;
  const whatsappHref = contactConfig.whatsappUrl?.trim() ?? '';
  function updateField(field: keyof ContactUsFormState, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    trackAnalyticsEvent('contact_form_submit_attempt', {
      sectionId: 'contact-us-form',
      ctaLocation: 'form',
      params: {
        form_type: 'contact_us',
      },
    });
    clearSubmissionError();
    setIsEmailTouched(true);
    setIsPhoneTouched(true);
    setIsFirstNameTouched(true);
    markCaptchaTouched();

    if (
      !sanitizeSingleLineValue(formState.firstName) ||
      !isValidEmail(formState.email) ||
      !isValidPhone(formState.phone)
    ) {
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
      first_name: string;
      email_address: string;
      phone_number?: string;
      message: string;
      marketing_opt_in: boolean;
      signup_intent: 'contact_inquiry';
      locale: Locale;
    } = {
      email_address: normalizedEmail,
      message: normalizedMessage,
      first_name: normalizedFirstName,
      marketing_opt_in: marketingOptIn,
      signup_intent: 'contact_inquiry',
      locale,
    };
    if (normalizedPhone) {
      requestBody.phone_number = normalizedPhone;
    }

    await withSubmitting(async () => {
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
        trackAnalyticsEvent('contact_form_submit_success', {
          sectionId: 'contact-us-form',
          ctaLocation: 'form',
          params: {
            form_type: 'contact_us',
          },
        });
        trackMetaPixelEvent('Lead', { content_name: PIXEL_CONTENT_NAME.contact_form });
        markSubmissionSuccess();
        return;
      }

      trackAnalyticsEvent('contact_form_submit_error', {
        sectionId: 'contact-us-form',
        ctaLocation: 'form',
        params: {
          form_type: 'contact_us',
          error_type: 'api_error',
        },
      });
      setSubmissionError(submissionResult.errorMessage);
    });
  }

  return (
    <SectionShell
      id='contact-us-form'
      ariaLabel={content.title}
      dataFigmaNode='contact-us-form'
      className='relative overflow-hidden es-contact-us-section pt-0 sm:pt-[60px]'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute left-0 top-0 es-contact-us-left-decor'
      />
      <SectionContainer
        className={buildSectionSplitLayoutClassName('es-section-split-layout--contact-us')}
      >
        <div className='relative z-10 flex h-full items-start overflow-hidden pb-8 lg:pt-[25%]'>
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
              {whatsappHref ? (
                <ButtonPrimitive
                  variant='primary'
                  href={whatsappHref}
                  className='mt-4 w-full sm:w-auto es-btn--whatsapp-cta'
                  onClick={() => {
                    trackAnalyticsEvent('whatsapp_click', {
                      sectionId: 'contact-us-form',
                      ctaLocation: 'contact_section',
                    });
                    trackMetaPixelEvent('Contact', { content_name: PIXEL_CONTENT_NAME.whatsapp });
                  }}
                >
                  <span>{content.contactMethodLinks.whatsapp}</span>
                  <Image
                    src={WHATSAPP_ICON_SRC}
                    alt=''
                    aria-hidden='true'
                    width={16}
                    height={16}
                    className='h-4 w-4 shrink-0'
                  />
                </ButtonPrimitive>
              ) : null}
            </div>
          </div>
        </div>

        <div
          id='contact-form'
          className={mergeClassNames(
            'relative overflow-visible rounded-[28px] border es-border-form-shell p-5 shadow-panel sm:p-7 lg:p-8 es-contact-us-form-panel',
            hasSuccessfulSubmission ? 'flex min-h-full items-center justify-center' : undefined,
          )}
        >
          <div
            aria-hidden='true'
            className='pointer-events-none absolute left-[58px] top-0 z-20 h-[30px] w-[36px] -translate-y-1/2 bg-contain bg-center bg-no-repeat es-contact-us-decor-green-wedge'
          />
          <div
            aria-hidden='true'
            className='pointer-events-none absolute right-0 top-[130px] z-20 h-[36px] w-[33px] translate-x-1/2 bg-contain bg-center bg-no-repeat es-contact-us-decor-blue-line'
          />

          {hasSuccessfulSubmission ? (
            <ContactFormSuccess
              title={content.successTitle}
              description={content.successDescription}
            />
          ) : (
            <>
              <div className='relative z-10 mb-6 pt-4'>
                <h2 className='es-type-title'>
                  {content.formTitle}
                </h2>
              </div>

              <ContactFormFields
                content={content}
                formState={formState}
                hasEmailError={hasEmailError}
                hasPhoneError={hasPhoneError}
                hasFirstNameError={hasFirstNameError}
                marketingOptIn={marketingOptIn}
                captchaErrorMessage={captchaErrorMessage}
                submitErrorMessage={submitErrorMessage}
                turnstileSiteKey={turnstileSiteKey}
                isSubmitting={isSubmitting}
                isSubmitDisabled={isSubmitDisabled}
                onSubmit={handleSubmit}
                onUpdateField={updateField}
                onEmailBlur={() => {
                  setIsEmailTouched(true);
                }}
                onPhoneBlur={() => {
                  setIsPhoneTouched(true);
                }}
                onFirstNameBlur={() => {
                  setIsFirstNameTouched(true);
                }}
                onMarketingOptInChange={setMarketingOptIn}
                onCaptchaTokenChange={handleCaptchaTokenChange}
                onCaptchaLoadError={handleCaptchaLoadError}
              />
            </>
          )}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
