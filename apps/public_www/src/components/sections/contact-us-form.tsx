'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useMemo, useState } from 'react';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
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

const SECTION_BACKGROUND = '#FFFFFF';
const BODY_TEXT_COLOR = 'var(--figma-colors-home, #4A4A4A)';
const HEADING_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const FORM_PANEL_BACKGROUND = 'linear-gradient(155deg, #FFF7F0 0%, #FFFFFF 100%)';

const eyebrowStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: '1',
};

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

  const maxMessageLength = content.messageMaxLength;

  const messageCountLabel = useMemo(() => {
    return `${formState.message.length} / ${maxMessageLength}`;
  }, [formState.message.length, maxMessageLength]);

  function updateField(field: keyof FormState, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
        <section className='space-y-6'>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowStyle}
            className='px-4 py-2.5 sm:px-5'
            style={{ borderColor: '#EECAB0', backgroundColor: '#FFF' }}
          />
          <h1 className='es-section-heading text-balance'>{content.title}</h1>
          <p className='es-section-body text-balance text-[1.05rem] leading-8'>
            {content.description}
          </p>
          <p className='es-section-body text-base leading-7'>
            <span className='font-semibold text-[color:var(--site-heading-text)]'>
              {content.emailLabel}{' '}
            </span>
            <a
              href={`mailto:${content.emailAddress}`}
              className='underline decoration-[1.5px] underline-offset-[3px] transition-opacity hover:opacity-80'
            >
              {content.emailAddress}
            </a>
          </p>
          <div className='rounded-3xl border border-[#EBCFB8] bg-[#FFFAF6] p-5 sm:p-7'>
            <h2 className='es-section-heading text-[clamp(1.4rem,3.2vw,2rem)]'>
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
        </section>

        <section
          id='contact-form'
          className='rounded-[28px] border border-[#E7D1BF] p-5 shadow-[0_28px_60px_-45px_rgba(17,17,17,0.58)] sm:p-7 lg:p-8'
          style={{ background: FORM_PANEL_BACKGROUND }}
        >
          <div className='mb-5'>
            <SectionEyebrowChip
              label={content.quickFormEyebrow}
              labelStyle={eyebrowStyle}
              className='px-4 py-2 sm:px-5'
              style={{ borderColor: '#EECAB0', backgroundColor: '#FFF' }}
            />
            <h2 className='es-section-heading mt-4 text-[clamp(1.5rem,3.6vw,2.2rem)]'>
              {content.quickFormTitle}
            </h2>
            <p className='es-section-body mt-3 text-base leading-7'>
              {content.quickFormDescription}
            </p>
            <p className='es-section-body mt-2 text-sm text-black/65'>
              {content.requiredHint}
            </p>
          </div>

          <form onSubmit={handleSubmit} className='space-y-4'>
            <label className='block space-y-1.5'>
              <span style={formLabelStyle}>{content.firstNameLabel}</span>
              <input
                type='text'
                required
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
              <span style={formLabelStyle}>{content.emailFieldLabel}</span>
              <input
                type='email'
                required
                autoComplete='email'
                value={formState.email}
                onChange={(event) => {
                  updateField('email', event.target.value);
                }}
                className='es-focus-ring w-full rounded-xl px-4 py-3 text-base'
                style={inputStyle}
              />
            </label>

            <label className='block space-y-1.5'>
              <span style={formLabelStyle}>{content.phoneLabel}</span>
              <input
                type='tel'
                required
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
              <span style={formLabelStyle}>{content.messageLabel}</span>
              <textarea
                required
                rows={6}
                maxLength={maxMessageLength}
                value={formState.message}
                onChange={(event) => {
                  updateField('message', event.target.value);
                }}
                placeholder={content.messagePlaceholder}
                className='es-focus-ring w-full resize-y rounded-xl px-4 py-3 text-base'
                style={{ ...inputStyle, minHeight: '152px' }}
              />
              <p className='text-right text-sm text-black/55'>{messageCountLabel}</p>
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
