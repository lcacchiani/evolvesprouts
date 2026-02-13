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

const SECTION_BACKGROUND = '#FFFFFF';
const FORM_PANEL_BACKGROUND = 'linear-gradient(155deg, #FFF7F0 0%, #FFFFFF 100%)';
const LEFT_PANEL_BACKGROUND_IMAGE = 'url("/images/tree-background.png")';
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
  backgroundColor: '#FFFFFF',
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
          className='relative flex h-full items-center overflow-hidden px-6 py-8 sm:px-8 lg:px-10'
          style={{
            backgroundImage: LEFT_PANEL_BACKGROUND_IMAGE,
            backgroundPosition: 'left center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'contain',
          }}
        >
          <div className='space-y-6'>
            <h1 className='es-section-heading text-balance'>{content.title}</h1>
            <p className='es-section-body text-balance text-[1.05rem] leading-8'>
              {content.description}
            </p>
          </div>
        </section>

        <section
          id='contact-form'
          className='relative overflow-hidden rounded-[28px] border border-[#E7D1BF] p-5 shadow-[0_28px_60px_-45px_rgba(17,17,17,0.58)] sm:p-7 lg:p-8'
          style={{ background: FORM_PANEL_BACKGROUND }}
        >
          <div
            aria-hidden='true'
            className='pointer-events-none absolute left-[58px] top-0 h-[30px] w-[36px] bg-contain bg-center bg-no-repeat'
            style={{ backgroundImage: FORM_DECORATIVE_GREEN_WEDGE }}
          />
          <div
            aria-hidden='true'
            className='pointer-events-none absolute right-0 top-[130px] h-[36px] w-[33px] translate-x-[-8px] bg-contain bg-center bg-no-repeat sm:translate-x-[10px]'
            style={{ backgroundImage: FORM_DECORATIVE_BLUE_LINE }}
          />

          <div className='relative z-10 mb-6 pt-4'>
            <h2 className='es-section-heading text-[clamp(1.5rem,3.6vw,2.2rem)]'>
              {content.promiseTitle}
            </h2>
            <ul className='mt-4 space-y-3'>
              {content.promises.map((promise) => (
                <li
                  key={promise}
                  className='rounded-xl bg-white px-4 py-3 text-base leading-7 text-[color:var(--site-primary-text)] shadow-[0_8px_20px_-18px_rgba(0,0,0,0.45)]'
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
                    ? { ...inputStyle, border: '1px solid #B42318' }
                    : inputStyle
                }
                aria-invalid={hasEmailError}
              />
              {hasEmailError ? (
                <p className='text-sm text-[#B42318]' role='alert'>
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
              className='es-focus-ring es-cta-button es-cta-primary mt-2 inline-flex h-[58px] w-full items-center justify-center rounded-[10px] px-5 text-[1.1rem] font-semibold'
            >
              {content.submitLabel}
            </button>
          </form>
        </section>
      </div>
    </SectionShell>
  );
}
