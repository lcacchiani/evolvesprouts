import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PhoneNumberInlineField } from '@/components/shared/phone-number-inline-field';

function renderPhoneField(
  overrides: Partial<ComponentProps<typeof PhoneNumberInlineField>> = {},
) {
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
      {...overrides}
    />,
  );
  return { onPhoneCountryChange, onPhoneChange };
}

describe('PhoneNumberInlineField', () => {
  it('renders dial code options from template and wires change handlers', () => {
    const { onPhoneCountryChange, onPhoneChange } = renderPhoneField();

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

  it('lists +852 (HK) first regardless of phoneCountry prop', () => {
    renderPhoneField({ phoneCountry: 'US' });
    const regionSelect = screen.getByLabelText('Country or region');
    const options = within(regionSelect).getAllByRole('option');
    expect(options[0]).toHaveAccessibleName('+852');
  });

  it('dedupes dial codes so each +code appears exactly once', () => {
    renderPhoneField();
    const regionSelect = screen.getByLabelText('Country or region');
    const labels = within(regionSelect).getAllByRole('option').map((o) => o.textContent ?? '');
    const counts = new Map<string, number>();
    for (const label of labels) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    for (const [, count] of counts) {
      expect(count).toBe(1);
    }
  });

  it('sorts non-HK options ascending by dial code string (+20 before +211 before +7)', () => {
    renderPhoneField();
    const regionSelect = screen.getByLabelText('Country or region');
    const labels = within(regionSelect)
      .getAllByRole('option')
      .map((o) => o.textContent ?? '')
      .filter((t) => t.startsWith('+'));
    expect(labels[0]).toBe('+852');
    const idx20 = labels.indexOf('+20');
    const idx211 = labels.indexOf('+211');
    const idx7 = labels.indexOf('+7');
    expect(idx20).toBeGreaterThan(0);
    expect(idx211).toBeGreaterThan(0);
    expect(idx7).toBeGreaterThan(0);
    expect(idx20).toBeLessThan(idx211);
    expect(idx211).toBeLessThan(idx7);
  });

  it('uses inputMode tel on the national input', () => {
    renderPhoneField();
    expect(screen.getByRole('textbox')).toHaveAttribute('inputMode', 'tel');
  });

  it('preserves spaces in onPhoneChange for national number', () => {
    const { onPhoneChange } = renderPhoneField({ phone: '' });
    const national = screen.getByRole('textbox');
    fireEvent.change(national, { target: { value: '9123 4567' } });
    expect(onPhoneChange).toHaveBeenCalledWith('9123 4567');
  });

  it('maps non-canonical +1 region to US once and notifies parent', async () => {
    const { onPhoneCountryChange } = renderPhoneField({ phoneCountry: 'CA' });
    await waitFor(() => {
      expect(onPhoneCountryChange).toHaveBeenCalledTimes(1);
      expect(onPhoneCountryChange).toHaveBeenCalledWith('US');
    });
    const regionSelect = screen.getByLabelText('Country or region') as HTMLSelectElement;
    expect(regionSelect.value).toBe('US');
  });

  it('adds synthetic option for unknown region after pinned +852 and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderPhoneField({ phoneCountry: 'ZZ' });
    const regionSelect = screen.getByLabelText('Country or region');
    const options = within(regionSelect).getAllByRole('option');
    expect(options[0]).toHaveAccessibleName('+852');
    expect(options[1]).toHaveAccessibleName('ZZ');
    expect(warnSpy).toHaveBeenCalledWith(
      'PhoneNumberInlineField: unknown phone_country not found in PHONE_COUNTRIES',
      'ZZ',
    );
    warnSpy.mockRestore();
  });
});
