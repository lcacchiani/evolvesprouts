import type { BookingPaymentModalContent } from '@/content';
import type { BookingTopicsFieldConfig } from '@/components/sections/booking-modal/types';
import { PhoneNumberInlineField } from '@/components/shared/phone-number-inline-field';

interface ReservationFormFieldsProps {
  content: BookingPaymentModalContent;
  dialCodeOptionTemplate: string;
  fullName: string;
  email: string;
  phoneCountry: string;
  phone: string;
  interestedTopics: string;
  hasFullNameError: boolean;
  hasEmailError: boolean;
  hasPhoneError: boolean;
  hasPhoneInvalidForCountry: boolean;
  hasTopicsError: boolean;
  topicsFieldConfig?: BookingTopicsFieldConfig;
  onFullNameChange: (value: string) => void;
  onFullNameBlur: () => void;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onPhoneCountryChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPhoneBlur: () => void;
  onTopicsChange: (value: string) => void;
  onTopicsBlur: () => void;
}

export const BOOKING_FULL_NAME_ERROR_MESSAGE_ID = 'booking-modal-full-name-error-message';
export const BOOKING_EMAIL_ERROR_MESSAGE_ID = 'booking-modal-email-error-message';
export const BOOKING_PHONE_ERROR_MESSAGE_ID = 'booking-modal-phone-error-message';
export const BOOKING_PHONE_INVALID_COUNTRY_ERROR_MESSAGE_ID =
  'booking-modal-phone-invalid-country-error-message';
export const BOOKING_TOPICS_ERROR_MESSAGE_ID = 'booking-modal-topics-error-message';

export function ReservationFormFields({
  content,
  dialCodeOptionTemplate,
  fullName,
  email,
  phoneCountry,
  phone,
  interestedTopics,
  hasFullNameError,
  hasEmailError,
  hasPhoneError,
  hasPhoneInvalidForCountry,
  hasTopicsError,
  topicsFieldConfig,
  onFullNameChange,
  onFullNameBlur,
  onEmailChange,
  onEmailBlur,
  onPhoneCountryChange,
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
      <div className='block'>
        <span
          id='booking-reservation-phone-field-label'
          className='mb-1 block text-sm font-semibold es-text-heading'
        >
          {content.phoneLabel}
          <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
            *
          </span>
        </span>
        <PhoneNumberInlineField
          countrySelectId='booking-reservation-phone-country'
          nationalInputAriaLabelledBy='booking-reservation-phone-field-label'
          phoneCountry={phoneCountry}
          phone={phone}
          onPhoneCountryChange={onPhoneCountryChange}
          onPhoneChange={onPhoneChange}
          onPhoneBlur={onPhoneBlur}
          countryAriaLabel={content.phoneCountryLabel}
          dialCodeOptionTemplate={dialCodeOptionTemplate}
          hasError={hasPhoneError || hasPhoneInvalidForCountry}
          errorMessageId={
            hasPhoneError
              ? BOOKING_PHONE_ERROR_MESSAGE_ID
              : hasPhoneInvalidForCountry
                ? BOOKING_PHONE_INVALID_COUNTRY_ERROR_MESSAGE_ID
                : undefined
          }
          inputId='booking-reservation-phone-national'
          autoComplete='tel'
          required
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
        {hasPhoneInvalidForCountry && !hasPhoneError ? (
          <p
            id={BOOKING_PHONE_INVALID_COUNTRY_ERROR_MESSAGE_ID}
            className='es-form-field-error'
            role='alert'
          >
            {content.phoneInvalidForCountry}
          </p>
        ) : null}
      </div>
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
