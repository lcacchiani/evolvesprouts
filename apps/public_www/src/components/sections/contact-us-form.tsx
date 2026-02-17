'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

import { SectionShell } from '@/components/section-shell';
import type { ContactUsContent } from '@/content';
import {
  BODY_TEXT_COLOR,
  HEADING_TEXT_COLOR,
} from '@/lib/design-tokens';

interface ContactUsFormProps {
  content: ContactUsContent['contactUsForm'];
}

interface FormState {
  firstName: string;
  email: string;
  phone: string;
  message: string;
}

const SECTION_BACKGROUND = 'var(--es-color-surface-white, #FFFFFF)';
const FORM_PANEL_BACKGROUND = 'var(--es-gradient-form-panel)';
const LEFT_PANEL_BACKGROUND_IMAGE = '/images/evolvesprouts-logo.svg';
const LEFT_PANEL_BACKGROUND_FILTER =
  'sepia(1) opacity(7%) hue-rotate(-50deg) saturate(250%)';
const LEFT_PANEL_BACKGROUND_MASK_IMAGE =
  'linear-gradient(to bottom, black 60%, transparent 90%)';
const FORM_DECORATIVE_BLUE_LINE =
  'url("/images/vector-blue-line.svg")';
const FORM_DECORATIVE_GREEN_WEDGE =
  'url("/images/green-wedge.svg")';
const MESSAGE_MAX_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formLabelStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: '16px',
  fontWeight: 600,
  lineHeight: '1.35',
};

const inputStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  border: '1px solid rgba(51, 51, 51, 0.18)',
  backgroundColor: 'var(--es-color-surface-white, #FFFFFF)',
};

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

function buildMailtoHref(
  targetEmail: string,
  subject: string,
  formState: FormState,
): string {
  const bodyLines = [
    `First Name: ${formState.firstName}`,
    `Email Address: ${formState.email}`,
    `Phone Number: ${formState.phone}`,
    '',
    'Message:',
    formState.message,
  ];

  const query = new URLSearchParams({
    subject,
    body: bodyLines.join('\n'),
  });

  return `mailto:${targetEmail}?${query.toString()}`;
}

export function ContactUsForm({ content }: ContactUsFormProps) {
  const [formState, setFormState] = useState<FormState>({
    firstName: '',
    email: '',
    phone: '',
    message: '',
  });
  const [isEmailTouched, setIsEmailTouched] = useState(false);

  const hasEmailError = isEmailTouched && !isValidEmail(formState.email);

  function updateField(field: keyof FormState, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsEmailTouched(true);

    if (!isValidEmail(formState.email)) {
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
      style={{ backgroundColor: SECTION_BACKGROUND }}
    >
      <div className='mx-auto grid w-full max-w-[1465px] gap-10 lg:grid-cols-2 lg:gap-9'>
        <section
          className='relative flex h-full items-start overflow-hidden px-6 py-8 sm:px-8 lg:px-10 lg:pt-[25%]'
        >
          <div
            aria-hidden='true'
            className='pointer-events-none absolute left-0 top-0'
            style={{
              backgroundImage: `url(${LEFT_PANEL_BACKGROUND_IMAGE})`,
              width: '1500px',
              height: '750px',
              backgroundSize: 'cover',
              backgroundPosition: '-750px -250px',
              filter: LEFT_PANEL_BACKGROUND_FILTER,
              maskImage: LEFT_PANEL_BACKGROUND_MASK_IMAGE,
              WebkitMaskImage: LEFT_PANEL_BACKGROUND_MASK_IMAGE,
            }}
          />
          <div className='relative z-10 space-y-6'>
            <h1 className='es-section-heading text-balance'>{content.title}</h1>
            <p className='es-section-body text-balance text-[1.05rem] leading-8'>
              {content.description}
            </p>
          </div>
        </section>

        <section
          id='contact-form'
          className='relative overflow-visible rounded-[28px] border es-border-form-shell p-5 shadow-[0_28px_60px_-45px_rgba(17,17,17,0.58)] sm:p-7 lg:p-8'
          style={{ background: FORM_PANEL_BACKGROUND }}
        >
          <div
            aria-hidden='true'
            className='pointer-events-none absolute left-[58px] top-0 z-20 h-[30px] w-[36px] -translate-y-1/2 bg-contain bg-center bg-no-repeat'
            style={{ backgroundImage: FORM_DECORATIVE_GREEN_WEDGE }}
          />
          <div
            aria-hidden='true'
            className='pointer-events-none absolute right-0 top-[130px] z-20 h-[36px] w-[33px] translate-x-1/2 bg-contain bg-center bg-no-repeat'
            style={{ backgroundImage: FORM_DECORATIVE_BLUE_LINE }}
          />

          <div className='relative z-10 mb-6 pt-4'>
            <h2 className='es-section-heading text-[clamp(1.5rem,3.6vw,2.2rem)]'>
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

          <form onSubmit={handleSubmit} className='relative z-10 space-y-4'>
            <label className='block space-y-1.5'>
              <span style={formLabelStyle}>{content.firstNameLabel}</span>
              <input
                type='text'
                autoComplete='given-name'
                value={formState.firstName}
                onChange={(event) => {
                  updateField('firstName', event.target.value);
                }}
                className='es-focus-ring w-full rounded-xl px-4 py-3 text-base'
                style={inputStyle}
              />
            </label>

            <label className='block space-y-1.5'>
              <span style={formLabelStyle}>{`${content.emailFieldLabel} (*)`}</span>
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
                className='es-focus-ring w-full rounded-xl px-4 py-3 text-base'
                style={
                  hasEmailError
                    ? { ...inputStyle, border: '1px solid var(--es-color-text-danger, #B42318)' }
                    : inputStyle
                }
                aria-invalid={hasEmailError}
              />
              {hasEmailError ? (
                <p className='text-sm es-text-danger' role='alert'>
                  Please enter a valid email address.
                </p>
              ) : null}
            </label>

            <label className='block space-y-1.5'>
              <span style={formLabelStyle}>{content.phoneLabel}</span>
              <input
                type='tel'
                autoComplete='tel'
                value={formState.phone}
                onChange={(event) => {
                  updateField('phone', event.target.value);
                }}
                className='es-focus-ring w-full rounded-xl px-4 py-3 text-base'
                style={inputStyle}
              />
            </label>

            <label className='block space-y-1.5'>
              <span style={formLabelStyle}>{`${content.messageLabel} (*)`}</span>
              <textarea
                required
                rows={6}
                maxLength={MESSAGE_MAX_LENGTH}
                value={formState.message}
                onChange={(event) => {
                  updateField('message', event.target.value);
                }}
                placeholder={content.messagePlaceholder}
                className='es-focus-ring w-full resize-y rounded-xl px-4 py-3 text-base'
                style={{ ...inputStyle, minHeight: '152px' }}
              />
            </label>

            <button
              type='submit'
              className='es-focus-ring es-cta-button es-cta-primary es-primary-cta mt-2 w-full'
            >
              {content.submitLabel}
            </button>
          </form>
        </section>
      </div>
    </SectionShell>
  );
}
