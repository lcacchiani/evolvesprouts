import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PhoneNumberInlineField } from '@/components/shared/phone-number-inline-field';

describe('PhoneNumberInlineField', () => {
  it('renders dial code options from template and wires change handlers', () => {
    const onPhoneCountryChange = vi.fn();
    const onPhoneChange = vi.fn();

    render(
      <PhoneNumberInlineField
        phoneCountry='HK'
        phone='91234567'
        onPhoneCountryChange={onPhoneCountryChange}
        onPhoneChange={onPhoneChange}
        countryAriaLabel='Country or region'
        dialCodeOptionTemplate='+{dialCode}'
        hasError={false}
        inputId='test-phone-national'
        autoComplete='tel'
      />,
    );

    expect(screen.getByRole('option', { name: '+852' })).toBeInTheDocument();

    const regionSelect = screen.getByLabelText('Country or region');
    fireEvent.change(regionSelect, { target: { value: 'US' } });
    expect(onPhoneCountryChange).toHaveBeenCalledWith('US');

    const national = screen.getByRole('textbox');
    fireEvent.change(national, { target: { value: '5551234' } });
    expect(onPhoneChange).toHaveBeenCalledWith('5551234');
  });

  it('marks invalid state and links error message id', () => {
    render(
      <PhoneNumberInlineField
        phoneCountry='HK'
        phone=''
        onPhoneCountryChange={() => {}}
        onPhoneChange={() => {}}
        countryAriaLabel='Country or region'
        dialCodeOptionTemplate='+{dialCode}'
        hasError
        errorMessageId='phone-err'
        inputId='test-phone-national'
        autoComplete='tel'
      />,
    );

    const national = screen.getByRole('textbox');
    expect(national).toHaveAttribute('aria-invalid', 'true');
    expect(national).toHaveAttribute('aria-describedby', 'phone-err');
    expect(document.querySelector('.es-phone-inline-group')?.classList.contains('is-error')).toBe(
      true,
    );
  });
});
