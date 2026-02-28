'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import Image from 'next/image';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { SproutsSquadCommunityContent } from '@/content';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { ServerSubmissionResult } from '@/lib/server-submission-result';

interface SproutsSquadCommunityProps {
  content: SproutsSquadCommunityContent;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_ERROR_MESSAGE_ID = 'sprouts-community-email-error';
const SUBMIT_ERROR_MESSAGE_ID = 'sprouts-community-submit-error';
const CONTACT_US_API_PATH = '/v1/contact-us';

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function SproutsSquadCommunity({
  content,
}: SproutsSquadCommunityProps) {
  const crmApiClient = useMemo(() => createPublicCrmApiClient(), []);
  const [email, setEmail] = useState('');
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');
  const [hasSuccessfulSubmission, setHasSuccessfulSubmission] = useState(false);

  const hasEmailError = isEmailTouched && !isValidEmail(email);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitErrorMessage('');
    setIsEmailTouched(true);

    if (!isValidEmail(email) || !crmApiClient) {
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submissionResult = await ServerSubmissionResult.resolve({
        request: () =>
          crmApiClient.request({
            endpointPath: CONTACT_US_API_PATH,
            method: 'POST',
            body: {
              email_address: normalizedEmail,
              message: content.prefilledMessage,
            },
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
      id='sprouts-squad-community'
      ariaLabel={content.heading}
      dataFigmaNode='sprouts-squad-community'
      className='overflow-hidden es-sprouts-community-section'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 es-sprouts-community-overlay'
      />

      <SectionContainer>
        <div className='flex min-h-[315px] flex-col justify-center gap-7 sm:min-h-[400px] lg:min-h-[555px] lg:gap-9'>
          <Image
            src='/images/evolvesprouts-logo.svg'
            alt=''
            width={250}
            height={250}
            className='block h-auto w-[250px] es-sprouts-community-logo invisible sm:visible'
          />
          <SectionHeader
            title={content.heading}
            align='left'
            className='max-w-[620px]'
            titleClassName='leading-[1.12] sm:-mt-6 lg:-mt-[52px] es-sprouts-community-heading'
          />
          <p className='max-w-[500px] es-sprouts-community-support-paragraph'>
            {content.supportParagraph}
          </p>
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
                className='flex min-h-0 flex-col gap-3 overflow-hidden'
              >
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
                  className={`es-form-input es-sprouts-community-email-input ${
                    hasEmailError ? 'es-form-input-error' : ''
                  }`}
                  aria-label={content.emailPlaceholder}
                  aria-invalid={hasEmailError}
                  aria-describedby={
                    hasEmailError
                      ? EMAIL_ERROR_MESSAGE_ID
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
                <ButtonPrimitive
                  variant='primary'
                  type='submit'
                  disabled={isSubmitting || hasSuccessfulSubmission}
                >
                  {content.ctaLabel}
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
      </SectionContainer>
    </SectionShell>
  );
}
