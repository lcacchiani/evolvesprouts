import type { BookingPaymentModalContent } from '@/content';
import type { BookingTopicsFieldConfig } from '@/components/sections/booking-modal/types';

interface ReservationFormFieldsProps {
  content: BookingPaymentModalContent;
  fullName: string;
  email: string;
  phone: string;
  interestedTopics: string;
  hasFullNameError: boolean;
  hasEmailError: boolean;
  hasPhoneError: boolean;
  hasTopicsError: boolean;
  topicsFieldConfig?: BookingTopicsFieldConfig;
  onFullNameChange: (value: string) => void;
  onFullNameBlur: () => void;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onPhoneChange: (value: string) => void;
  onPhoneBlur: () => void;
  onTopicsChange: (value: string) => void;
  onTopicsBlur: () => void;
}

export const BOOKING_FULL_NAME_ERROR_MESSAGE_ID = 'booking-modal-full-name-error-message';
export const BOOKING_EMAIL_ERROR_MESSAGE_ID = 'booking-modal-email-error-message';
export const BOOKING_PHONE_ERROR_MESSAGE_ID = 'booking-modal-phone-error-message';
export const BOOKING_TOPICS_ERROR_MESSAGE_ID = 'booking-modal-topics-error-message';

export function ReservationFormFields({
  content,
  fullName,
  email,
  phone,
  interestedTopics,
  hasFullNameError,
  hasEmailError,
  hasPhoneError,
  hasTopicsError,
  topicsFieldConfig,
  onFullNameChange,
  onFullNameBlur,
  onEmailChange,
  onEmailBlur,
  onPhoneChange,
  onPhoneBlur,
  onTopicsChange,
  onTopicsBlur,
}: ReservationFormFieldsProps) {
  const topicsFieldLabel = topicsFieldConfig?.label ?? content.topicsInterestLabel;
  const topicsFieldPlaceholder =
    topicsFieldConfig?.placeholder ?? content.topicsInterestPlaceholder;
  const isTopicsFieldRequired = topicsFieldConfig?.required ?? false;

  return (
    <>
      <label className='block'>
        <span className='mb-1 block text-sm font-semibold es-text-heading'>
          {content.fullNameLabel}
          <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
            *
          </span>
        </span>
        <input
          type='text'
          required
          autoComplete='name'
          value={fullName}
          onChange={(event) => {
            onFullNameChange(event.target.value);
          }}
          onBlur={onFullNameBlur}
          className={`es-focus-ring es-form-input ${hasFullNameError ? 'es-form-input-error' : ''}`}
          aria-invalid={hasFullNameError}
          aria-describedby={hasFullNameError ? BOOKING_FULL_NAME_ERROR_MESSAGE_ID : undefined}
        />
        {hasFullNameError ? (
          <p
            id={BOOKING_FULL_NAME_ERROR_MESSAGE_ID}
            className='es-form-field-error'
            role='alert'
          >
            {content.fullNameRequiredError}
          </p>
        ) : null}
      </label>
      <label className='block'>
        <span className='mb-1 block text-sm font-semibold es-text-heading'>
          {content.emailLabel}
          <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
            *
          </span>
        </span>
        <input
          type='email'
          required
          autoComplete='email'
          value={email}
          onChange={(event) => {
            onEmailChange(event.target.value);
          }}
          onBlur={onEmailBlur}
          className={`es-focus-ring es-form-input ${hasEmailError ? 'es-form-input-error' : ''}`}
          aria-invalid={hasEmailError}
          aria-describedby={hasEmailError ? BOOKING_EMAIL_ERROR_MESSAGE_ID : undefined}
        />
        {hasEmailError ? (
          <p
            id={BOOKING_EMAIL_ERROR_MESSAGE_ID}
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
          <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
            *
          </span>
        </span>
        <input
          type='tel'
          required
          autoComplete='tel'
          value={phone}
          onChange={(event) => {
            onPhoneChange(event.target.value);
          }}
          onBlur={onPhoneBlur}
          className={`es-focus-ring es-form-input ${hasPhoneError ? 'es-form-input-error' : ''}`}
          aria-invalid={hasPhoneError}
          aria-describedby={hasPhoneError ? BOOKING_PHONE_ERROR_MESSAGE_ID : undefined}
        />
        {hasPhoneError ? (
          <p
            id={BOOKING_PHONE_ERROR_MESSAGE_ID}
            className='es-form-field-error'
            role='alert'
          >
            {content.phoneRequiredError}
          </p>
        ) : null}
      </label>
      <label className='block'>
        <span className='mb-1 block text-sm font-semibold es-text-heading'>
          {topicsFieldLabel}
          {isTopicsFieldRequired ? (
            <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
              *
            </span>
          ) : null}
        </span>
        <textarea
          required={isTopicsFieldRequired}
          value={interestedTopics}
          onChange={(event) => {
            onTopicsChange(event.target.value);
          }}
          onBlur={onTopicsBlur}
          placeholder={topicsFieldPlaceholder}
          rows={3}
          className={`es-focus-ring es-form-input resize-y ${hasTopicsError ? 'es-form-input-error' : ''}`}
          aria-invalid={hasTopicsError}
          aria-describedby={hasTopicsError ? BOOKING_TOPICS_ERROR_MESSAGE_ID : undefined}
        />
        {hasTopicsError ? (
          <p
            id={BOOKING_TOPICS_ERROR_MESSAGE_ID}
            className='es-form-field-error'
            role='alert'
          >
            {content.topicsRequiredError}
          </p>
        ) : null}
      </label>
    </>
  );
}
