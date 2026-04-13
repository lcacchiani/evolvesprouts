import type { FormEvent } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import {
  SubmitButtonLoadingContent,
  submitButtonClassName,
} from '@/components/shared/submit-button-loading-content';
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
const MESSAGE_ERROR_MESSAGE_ID = 'contact-us-form-message-error';
const CAPTCHA_ERROR_MESSAGE_ID = 'contact-us-form-captcha-error';
const SUBMIT_ERROR_MESSAGE_ID = 'contact-us-form-submit-error';

interface ContactFormFieldsProps {
  content: ContactUsContent['form'];
  formState: ContactUsFormState;
  hasEmailError: boolean;
  hasPhoneError: boolean;
  hasFirstNameError: boolean;
  hasMessageError: boolean;
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
  onMessageBlur: () => void;
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
  hasMessageError,
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
  onMessageBlur,
  onMarketingOptInChange,
  onCaptchaTokenChange,
  onCaptchaLoadError,
}: ContactFormFieldsProps) {
  const submitButtonDescribedByParts = [
    hasFirstNameError ? FIRST_NAME_ERROR_MESSAGE_ID : null,
    hasEmailError ? EMAIL_ERROR_MESSAGE_ID : null,
    hasPhoneError ? PHONE_ERROR_MESSAGE_ID : null,
    hasMessageError ? MESSAGE_ERROR_MESSAGE_ID : null,
    captchaErrorMessage ? CAPTCHA_ERROR_MESSAGE_ID : null,
    submitErrorMessage ? SUBMIT_ERROR_MESSAGE_ID : null,
  ].filter((id): id is string => id !== null);
  const submitButtonDescribedBy =
    submitButtonDescribedByParts.length > 0
      ? submitButtonDescribedByParts.join(' ')
      : undefined;

  return (
    <form noValidate onSubmit={onSubmit} className='relative z-10 space-y-3'>
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
            className='es-form-field-error'
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
            className='es-form-field-error'
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
          className={`es-focus-ring es-form-input ${hasPhoneError ? 'es-form-input-error' : ''}`}
          aria-invalid={hasPhoneError}
          aria-describedby={hasPhoneError ? PHONE_ERROR_MESSAGE_ID : undefined}
        />
        {hasPhoneError ? (
          <p
            id={PHONE_ERROR_MESSAGE_ID}
            className='es-form-field-error'
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
          onBlur={onMessageBlur}
          placeholder={content.messagePlaceholder}
          className={`es-focus-ring es-form-input min-h-[152px] resize-y ${hasMessageError ? 'es-form-input-error' : ''}`}
          aria-invalid={hasMessageError}
          aria-describedby={hasMessageError ? MESSAGE_ERROR_MESSAGE_ID : undefined}
        />
        {hasMessageError ? (
          <p
            id={MESSAGE_ERROR_MESSAGE_ID}
            className='es-form-field-error'
            role='alert'
          >
            {content.messageRequiredError}
          </p>
        ) : null}
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
          className='es-form-submit-error'
          role='alert'
        >
          {captchaErrorMessage}
        </p>
      ) : null}

      <ButtonPrimitive
        variant='primary'
        type='submit'
        disabled={isSubmitDisabled}
        className={submitButtonClassName(isSubmitting, 'mt-2')}
        aria-describedby={submitButtonDescribedBy}
      >
        <SubmitButtonLoadingContent
          isSubmitting={isSubmitting}
          submittingLabel={content.submittingLabel}
          idleLabel={content.submitLabel}
          loadingGearTestId='contact-us-form-submit-loading-gear'
        />
      </ButtonPrimitive>
      <p className='text-base leading-7 text-[color:var(--site-primary-text)]'>
        {content.formDescription}
      </p>
      {submitErrorMessage ? (
        <p
          id={SUBMIT_ERROR_MESSAGE_ID}
          className='es-form-submit-error'
          role='alert'
        >
          {submitErrorMessage}
        </p>
      ) : null}
    </form>
  );
}
