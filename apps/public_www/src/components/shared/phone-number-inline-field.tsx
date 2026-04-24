import { formatContentTemplate } from '@/content/content-field-utils';
import { PHONE_COUNTRIES } from '@/lib/phone-countries.generated';

export interface PhoneNumberInlineFieldProps {
  /** Optional id on the region `<select>` (for tests and programmatic association). */
  countrySelectId?: string;
  /** When set, the national input uses `aria-labelledby` (avoids duplicate names when a parent `<label>` would wrap both controls). */
  nationalInputAriaLabelledBy?: string;
  phoneCountry: string;
  phone: string;
  onPhoneCountryChange: (region: string) => void;
  onPhoneChange: (value: string) => void;
  onPhoneBlur?: () => void;
  countryAriaLabel: string;
  dialCodeOptionTemplate: string;
  hasError: boolean;
  errorMessageId?: string;
  inputId: string;
  autoComplete: string;
  required?: boolean;
}

export function PhoneNumberInlineField({
  countrySelectId,
  nationalInputAriaLabelledBy,
  phoneCountry,
  phone,
  onPhoneCountryChange,
  onPhoneChange,
  onPhoneBlur,
  countryAriaLabel,
  dialCodeOptionTemplate,
  hasError,
  errorMessageId,
  inputId,
  autoComplete,
  required = false,
}: PhoneNumberInlineFieldProps) {
  const groupClassName = `es-phone-inline-group${hasError ? ' is-error' : ''}`;

  return (
    <div className={groupClassName}>
      <select
        id={countrySelectId}
        className='es-focus-ring es-phone-inline-dial es-form-input'
        value={phoneCountry}
        onChange={(event) => {
          onPhoneCountryChange(event.target.value);
        }}
        aria-label={countryAriaLabel}
      >
        {PHONE_COUNTRIES.map((row) => (
          <option key={row.region} value={row.region}>
            {formatContentTemplate(dialCodeOptionTemplate, { dialCode: row.dialCode })}
          </option>
        ))}
      </select>
      <input
        id={inputId}
        type='tel'
        inputMode='numeric'
        autoComplete={autoComplete}
        required={required}
        value={phone}
        onChange={(event) => {
          onPhoneChange(event.target.value);
        }}
        onBlur={onPhoneBlur}
        className='es-focus-ring es-phone-inline-national es-form-input'
        {...(nationalInputAriaLabelledBy
          ? { 'aria-labelledby': nationalInputAriaLabelledBy }
          : {})}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorMessageId : undefined}
      />
    </div>
  );
}
