import type { MyBestAuntieBookingContent } from '@/content';

interface ReservationFormFieldsProps {
  content: MyBestAuntieBookingContent['paymentModal'];
  fullName: string;
  email: string;
  phone: string;
  interestedTopics: string;
  hasEmailError: boolean;
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onPhoneChange: (value: string) => void;
  onTopicsChange: (value: string) => void;
}

const EMAIL_ERROR_MESSAGE_ID = 'booking-modal-email-error-message';

export function ReservationFormFields({
  content,
  fullName,
  email,
  phone,
  interestedTopics,
  hasEmailError,
  onFullNameChange,
  onEmailChange,
  onEmailBlur,
  onPhoneChange,
  onTopicsChange,
}: ReservationFormFieldsProps) {
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
          className='es-focus-ring es-form-input'
        />
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
          aria-describedby={hasEmailError ? EMAIL_ERROR_MESSAGE_ID : undefined}
        />
        {hasEmailError ? (
          <p
            id={EMAIL_ERROR_MESSAGE_ID}
            className='text-sm font-semibold es-text-danger-strong'
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
          className='es-focus-ring es-form-input'
        />
      </label>
      <label className='block'>
        <span className='mb-1 block text-sm font-semibold es-text-heading'>
          {content.topicsInterestLabel}
        </span>
        <textarea
          value={interestedTopics}
          onChange={(event) => {
            onTopicsChange(event.target.value);
          }}
          placeholder={content.topicsInterestPlaceholder}
          rows={3}
          className='es-focus-ring es-form-input resize-y'
        />
      </label>
    </>
  );
}
