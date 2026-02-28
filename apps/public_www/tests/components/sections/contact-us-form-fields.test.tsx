import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ContactFormFields,
  type ContactUsFormState,
} from '@/components/sections/contact-us-form-fields';
import enContent from '@/content/en.json';

vi.mock('@/components/shared/turnstile-captcha', () => ({
  TurnstileCaptcha: ({
    onTokenChange,
    onLoadError,
  }: {
    onTokenChange: (token: string | null) => void;
    onLoadError: () => void;
  }) => (
    <div>
      <button
        type='button'
        data-testid='captcha-solve'
        onClick={() => {
          onTokenChange('test-token');
        }}
      >
        solve
      </button>
      <button
        type='button'
        data-testid='captcha-fail'
        onClick={onLoadError}
      >
        fail
      </button>
    </div>
  ),
}));

describe('ContactFormFields', () => {
  it('renders validation errors and emits field + captcha events', () => {
    const formState: ContactUsFormState = {
      firstName: 'Ava',
      email: 'bad-email',
      phone: 'abc',
      message: 'Hello',
    };

    const onUpdateField = vi.fn();
    const onEmailBlur = vi.fn();
    const onPhoneBlur = vi.fn();
    const onCaptchaTokenChange = vi.fn();
    const onCaptchaLoadError = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );

    render(
      <ContactFormFields
        content={enContent.contactUs.contactUsForm}
        formState={formState}
        hasEmailError
        hasPhoneError
        captchaErrorMessage='captcha failed'
        submitErrorMessage='submit failed'
        turnstileSiteKey='site-key'
        isSubmitDisabled={false}
        onSubmit={onSubmit}
        onUpdateField={onUpdateField}
        onEmailBlur={onEmailBlur}
        onPhoneBlur={onPhoneBlur}
        onCaptchaTokenChange={onCaptchaTokenChange}
        onCaptchaLoadError={onCaptchaLoadError}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'valid@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), {
      target: { value: '91234567' },
    });
    fireEvent.blur(screen.getByLabelText(/Email/i));
    fireEvent.blur(screen.getByLabelText(/Phone Number/i));
    fireEvent.click(screen.getByTestId('captcha-solve'));
    fireEvent.click(screen.getByTestId('captcha-fail'));
    fireEvent.submit(screen.getByRole('button', { name: /Submit/i }).closest('form')!);

    expect(onUpdateField).toHaveBeenCalledWith('email', 'valid@example.com');
    expect(onUpdateField).toHaveBeenCalledWith('phone', '91234567');
    expect(onEmailBlur).toHaveBeenCalledTimes(1);
    expect(onPhoneBlur).toHaveBeenCalledTimes(1);
    expect(onCaptchaTokenChange).toHaveBeenCalledWith('test-token');
    expect(onCaptchaLoadError).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(enContent.contactUs.contactUsForm.emailValidationError),
    ).toBeInTheDocument();
    expect(
      screen.getByText(enContent.contactUs.contactUsForm.phoneValidationError),
    ).toBeInTheDocument();
  });
});
