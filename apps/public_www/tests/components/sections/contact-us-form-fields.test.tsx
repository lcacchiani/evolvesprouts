import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  ContactFormFields,
  type ContactUsFormState,
} from '@/components/sections/contact-us-form-fields';
import { useFormInteractionGate } from '@/components/sections/shared/use-form-interaction';
import enContent from '@/content/en.json';

vi.mock('@/components/shared/turnstile-captcha', () => ({
  TurnstileCaptcha: ({
    onTokenChange,
    onLoadError,
  }: {
    onTokenChange: (token: string | null) => void;
    onLoadError: () => void;
  }) => (
    <div data-testid='mock-turnstile-captcha'>
      <button
        type='button'
        data-testid='mock-turnstile-captcha-solve'
        onClick={() => {
          onTokenChange('test-token');
        }}
      >
        solve
      </button>
      <button
        type='button'
        data-testid='mock-turnstile-captcha-fail'
        onClick={onLoadError}
      >
        fail
      </button>
    </div>
  ),
}));

function ContactFormFieldsWithGate(
  props: Omit<
    ComponentProps<typeof ContactFormFields>,
    'hasFormInteracted' | 'formInteractionProps'
  >,
) {
  const { hasFormInteracted, markFormInteracted, formInteractionProps } =
    useFormInteractionGate();
  return (
    <ContactFormFields
      {...props}
      hasFormInteracted={hasFormInteracted}
      formInteractionProps={formInteractionProps}
      onUpdateField={(field, value) => {
        markFormInteracted();
        props.onUpdateField(field, value);
      }}
    />
  );
}

describe('ContactFormFields', () => {
  it('renders validation errors and emits field + captcha events', () => {
    const formState: ContactUsFormState = {
      firstName: 'Ava',
      email: 'bad-email',
      phoneCountry: 'HK',
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
      <ContactFormFieldsWithGate
        content={enContent.contactUs.form}
        dialCodeOptionTemplate={enContent.common.phoneDialCodeOptionTemplate}
        formState={formState}
        hasEmailError
        hasPhoneError
        hasFirstNameError={false}
        hasMessageError={false}
        marketingOptIn={false}
        captchaErrorMessage='captcha failed'
        submitErrorMessage='submit failed'
        turnstileSiteKey='site-key'
        isSubmitting={false}
        isSubmitDisabled={false}
        onSubmit={onSubmit}
        onUpdateField={onUpdateField}
        onEmailBlur={onEmailBlur}
        onPhoneBlur={onPhoneBlur}
        onFirstNameBlur={vi.fn()}
        onMessageBlur={vi.fn()}
        onMarketingOptInChange={vi.fn()}
        onCaptchaTokenChange={onCaptchaTokenChange}
        onCaptchaLoadError={onCaptchaLoadError}
      />,
    );

    fireEvent.focus(
      screen.getByLabelText(new RegExp(`^${enContent.contactUs.form.firstNameLabel}`)),
    );

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'valid@example.com' },
    });
    fireEvent.change(
      screen.getByRole('textbox', {
        name: new RegExp(`^${enContent.contactUs.form.phoneLabel}`),
      }),
      {
        target: { value: '91234567' },
      },
    );
    fireEvent.blur(screen.getByLabelText(/Email/i));
    fireEvent.blur(
      screen.getByRole('textbox', {
        name: new RegExp(`^${enContent.contactUs.form.phoneLabel}`),
      }),
    );
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-fail'));

    const submitButton = screen.getByRole('button', {
      name: enContent.contactUs.form.submitLabel,
    });
    const parentForm = submitButton.closest('form');
    if (!parentForm) {
      throw new Error('Expected contact form wrapper to exist');
    }
    expect(parentForm).toHaveAttribute('novalidate');
    fireEvent.submit(parentForm);

    expect(onUpdateField).toHaveBeenCalledWith('email', 'valid@example.com');
    expect(onUpdateField).toHaveBeenCalledWith('phone', '91234567');
    expect(onEmailBlur).toHaveBeenCalledTimes(1);
    expect(onPhoneBlur).toHaveBeenCalledTimes(1);
    expect(onCaptchaTokenChange).toHaveBeenCalledWith('test-token');
    expect(onCaptchaLoadError).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(enContent.contactUs.form.emailValidationError),
    ).toBeInTheDocument();
    expect(
      screen.getByText(enContent.contactUs.form.phoneInvalidForCountry),
    ).toBeInTheDocument();
  });

  it('does not render Turnstile until the user focuses a field', async () => {
    const formState: ContactUsFormState = {
      firstName: '',
      email: '',
      phoneCountry: 'HK',
      phone: '',
      message: '',
    };

    render(
      <ContactFormFieldsWithGate
        content={enContent.contactUs.form}
        dialCodeOptionTemplate={enContent.common.phoneDialCodeOptionTemplate}
        formState={formState}
        hasEmailError={false}
        hasPhoneError={false}
        hasFirstNameError={false}
        hasMessageError={false}
        marketingOptIn={false}
        captchaErrorMessage=''
        submitErrorMessage=''
        turnstileSiteKey='site-key'
        isSubmitting={false}
        isSubmitDisabled={false}
        onSubmit={(e) => e.preventDefault()}
        onUpdateField={vi.fn()}
        onEmailBlur={vi.fn()}
        onPhoneBlur={vi.fn()}
        onFirstNameBlur={vi.fn()}
        onMessageBlur={vi.fn()}
        onMarketingOptInChange={vi.fn()}
        onCaptchaTokenChange={vi.fn()}
        onCaptchaLoadError={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('mock-turnstile-captcha')).toBeNull();

    fireEvent.focus(
      screen.getByLabelText(new RegExp(`^${enContent.contactUs.form.firstNameLabel}`)),
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-turnstile-captcha')).toBeInTheDocument();
    });
  });

  it('renders Turnstile after a typed field change', async () => {
    const formState: ContactUsFormState = {
      firstName: '',
      email: '',
      phoneCountry: 'HK',
      phone: '',
      message: '',
    };

    render(
      <ContactFormFieldsWithGate
        content={enContent.contactUs.form}
        dialCodeOptionTemplate={enContent.common.phoneDialCodeOptionTemplate}
        formState={formState}
        hasEmailError={false}
        hasPhoneError={false}
        hasFirstNameError={false}
        hasMessageError={false}
        marketingOptIn={false}
        captchaErrorMessage=''
        submitErrorMessage=''
        turnstileSiteKey='site-key'
        isSubmitting={false}
        isSubmitDisabled={false}
        onSubmit={(e) => e.preventDefault()}
        onUpdateField={vi.fn()}
        onEmailBlur={vi.fn()}
        onPhoneBlur={vi.fn()}
        onFirstNameBlur={vi.fn()}
        onMessageBlur={vi.fn()}
        onMarketingOptInChange={vi.fn()}
        onCaptchaTokenChange={vi.fn()}
        onCaptchaLoadError={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('mock-turnstile-captcha')).toBeNull();

    fireEvent.change(
      screen.getByLabelText(new RegExp(`^${enContent.contactUs.form.firstNameLabel}`)),
      { target: { value: 'Pat' } },
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-turnstile-captcha')).toBeInTheDocument();
    });
  });
});
