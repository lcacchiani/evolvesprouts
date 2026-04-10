import type { FormEvent } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { LoadingGearIcon } from '@/components/shared/loading-gear-icon';
import { MarketingOptInCheckbox } from '@/components/shared/marketing-opt-in-checkbox';
import { TurnstileCaptcha } from '@/components/shared/turnstile-captcha';
import type { ContactUsContent } from '@/content';

export interface ContactUsFormState {
  firstName: string;
  email: string;
  phone: string;
  message: string;
}

const MESSAGE_MAX_LENGTH = 5000;
const EMAIL_ERROR_MESSAGE_ID = 'contact-us-form-email-error';
const PHONE_ERROR_MESSAGE_ID = 'contact-us-form-phone-error';
const FIRST_NAME_ERROR_MESSAGE_ID = 'contact-us-form-first-name-error';
const CAPTCHA_ERROR_MESSAGE_ID = 'contact-us-form-captcha-error';
const SUBMIT_ERROR_MESSAGE_ID = 'contact-us-form-submit-error';

interface ContactFormFieldsProps {
  content: ContactUsContent['form'];
  formState: ContactUsFormState;
  hasEmailError: boolean;
  hasPhoneError: boolean;
  hasFirstNameError: boolean;
  marketingOptIn: boolean;
  captchaErrorMessage: string;
  submitErrorMessage: string;
  turnstileSiteKey: string;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateField: (field: keyof ContactUsFormState, value: string) => void;
  onEmailBlur: () => void;
  onPhoneBlur: () => void;
  onFirstNameBlur: () => void;
  onMarketingOptInChange: (checked: boolean) => void;
  onCaptchaTokenChange: (token: string | null) => void;
  onCaptchaLoadError: () => void;
}

export function ContactFormFields({
  content,
  formState,
  hasEmailError,
  hasPhoneError,
  hasFirstNameError,
  marketingOptIn,
  captchaErrorMessage,
  submitErrorMessage,
  turnstileSiteKey,
  isSubmitting,
  isSubmitDisabled,
  onSubmit,
  onUpdateField,
  onEmailBlur,
  onPhoneBlur,
  onFirstNameBlur,
  onMarketingOptInChange,
  onCaptchaTokenChange,
  onCaptchaLoadError,
}: ContactFormFieldsProps) {
  return (
    <form onSubmit={onSubmit} className='relative z-10 space-y-3'>
      <label className='block'>
        <span className='mb-1 block text-sm font-semibold es-text-heading'>
          {content.firstNameLabel}
          <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
            *
          </span>
        </span>
        <input
          type='text'
          required
          autoComplete='given-name'
          value={formState.firstName}
          onChange={(event) => {
            onUpdateField('firstName', event.target.value);
          }}
          onBlur={onFirstNameBlur}
          className={`es-focus-ring es-form-input ${hasFirstNameError ? 'es-form-input-error' : ''}`}
          aria-invalid={hasFirstNameError}
          aria-describedby={hasFirstNameError ? FIRST_NAME_ERROR_MESSAGE_ID : undefined}
        />
        {hasFirstNameError ? (
          <p
            id={FIRST_NAME_ERROR_MESSAGE_ID}
            className='text-sm es-text-danger'
            role='alert'
          >
            {content.firstNameRequiredError}
          </p>
        ) : null}
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
            onUpdateField('email', event.target.value);
          }}
          onBlur={onEmailBlur}
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
            {content.emailValidationError}
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
            onUpdateField('phone', event.target.value);
          }}
          onBlur={onPhoneBlur}
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
            {content.phoneValidationError}
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
            onUpdateField('message', event.target.value);
          }}
          placeholder={content.messagePlaceholder}
          className='es-focus-ring es-form-input min-h-[152px] resize-y'
        />
      </label>

      <MarketingOptInCheckbox
        label={content.marketingOptInLabel}
        checked={marketingOptIn}
        onChange={onMarketingOptInChange}
      />

      <label className='block'>
        <span className='mb-1 block text-sm font-semibold es-text-heading'>
          {content.captchaLabel}
        </span>
        <TurnstileCaptcha
          siteKey={turnstileSiteKey}
          widgetAction='contact_us_form_submit'
          onTokenChange={onCaptchaTokenChange}
          onLoadError={onCaptchaLoadError}
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
        className={
          isSubmitting
            ? 'mt-2 inline-flex w-full items-center justify-center gap-2'
            : 'mt-2 w-full'
        }
        aria-describedby={
          captchaErrorMessage
            ? CAPTCHA_ERROR_MESSAGE_ID
            : submitErrorMessage
              ? SUBMIT_ERROR_MESSAGE_ID
              : undefined
        }
      >
        {isSubmitting ? (
          <>
            <span className='sr-only'>{content.submittingLabel}</span>
            <LoadingGearIcon
              className='h-5 w-5 animate-spin'
              testId='contact-us-form-submit-loading-gear'
            />
          </>
        ) : (
          content.submitLabel
        )}
      </ButtonPrimitive>
      <p className='text-base leading-7 text-[color:var(--site-primary-text)]'>
        {content.formDescription}
      </p>
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
  );
}
