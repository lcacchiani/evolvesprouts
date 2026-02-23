import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContactUsForm } from '@/components/sections/contact-us-form';
import enContent from '@/content/en.json';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';

const originalTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
        data-testid='mock-turnstile-captcha-solve'
        type='button'
        onClick={() => {
          onTokenChange('mock-turnstile-token');
        }}
      >
        Solve CAPTCHA
      </button>
      <button
        data-testid='mock-turnstile-captcha-fail'
        type='button'
        onClick={() => {
          onLoadError();
        }}
      >
        Fail CAPTCHA
      </button>
    </div>
  ),
}));

vi.mock('@/lib/crm-api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crm-api-client')>(
    '@/lib/crm-api-client',
  );

  return {
    ...actual,
    createPublicCrmApiClient: vi.fn(() => null),
  };
});

const mockedCreateCrmApiClient = vi.mocked(createPublicCrmApiClient);

describe('ContactUsForm section', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-turnstile-site-key';
  });

  afterEach(() => {
    mockedCreateCrmApiClient.mockReset();
    mockedCreateCrmApiClient.mockReturnValue(null);

    if (originalTurnstileSiteKey === undefined) {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      return;
    }

    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalTurnstileSiteKey;
  });

  it('uses class-based decorative background styling on the section container', () => {
    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    const sectionContainer = document.getElementById('contact-us-form');
    expect(sectionContainer).not.toBeNull();

    const decorativeLayer = sectionContainer?.querySelector(
      'div[aria-hidden="true"].es-contact-us-left-decor',
    ) as HTMLDivElement | null;
    expect(decorativeLayer).not.toBeNull();
    expect(decorativeLayer?.className).toContain('es-contact-us-left-decor');
    expect(decorativeLayer?.getAttribute('style')).toBeNull();
  });

  it('does not apply horizontal padding to the left content column', () => {
    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    const splitLayout = document.querySelector(
      '#contact-us-form .es-section-split-layout--contact-us',
    ) as HTMLDivElement | null;
    expect(splitLayout).not.toBeNull();

    const leftColumn = splitLayout?.firstElementChild as HTMLDivElement | null;
    expect(leftColumn).not.toBeNull();
    expect(leftColumn?.className).toContain('py-8');
    expect(leftColumn?.className).not.toContain('px-6');
    expect(leftColumn?.className).not.toContain('sm:px-8');
    expect(leftColumn?.className).not.toContain('lg:px-10');
  });

  it('uses the same input styling pattern as the booking form', () => {
    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    const firstNameInput = screen.getByLabelText(
      enContent.contactUs.contactUsForm.firstNameLabel,
    );
    const emailInput = screen.getByLabelText(
      new RegExp(enContent.contactUs.contactUsForm.emailFieldLabel),
    );
    const phoneInput = screen.getByLabelText(
      enContent.contactUs.contactUsForm.phoneLabel,
    );
    const messageInput = screen.getByLabelText(
      new RegExp(enContent.contactUs.contactUsForm.messageLabel),
    );

    for (const input of [firstNameInput, emailInput, phoneInput, messageInput]) {
      expect(input.className).toContain('es-form-input');
    }
  });

  it('renders promise items as bulleted text without background cards', () => {
    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    const promiseList = screen
      .getByRole('heading', {
        level: 2,
        name: enContent.contactUs.contactUsForm.promiseTitle,
      })
      .nextElementSibling as HTMLUListElement | null;
    expect(promiseList).not.toBeNull();
    expect(promiseList?.className).toContain('list-disc');

    const listItems = promiseList?.querySelectorAll('li') ?? [];
    expect(listItems.length).toBeGreaterThan(0);
    for (const listItem of listItems) {
      expect(listItem.className).not.toContain('bg-white');
      expect(listItem.className).not.toContain('shadow-');
    }
  });

  it('shows linked validation feedback for invalid email and phone values', () => {
    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    const emailInput = screen.getByLabelText(
      new RegExp(enContent.contactUs.contactUsForm.emailFieldLabel),
    );
    const phoneInput = screen.getByLabelText(
      enContent.contactUs.contactUsForm.phoneLabel,
    );
    const submitButton = screen.getByRole('button', {
      name: enContent.contactUs.contactUsForm.submitLabel,
    });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    fireEvent.change(phoneInput, { target: { value: 'not-a-phone' } });
    fireEvent.blur(phoneInput);
    fireEvent.click(submitButton);

    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid phone number.')).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAttribute(
      'aria-describedby',
      'contact-us-form-email-error',
    );
    expect(phoneInput).toHaveAttribute(
      'aria-describedby',
      'contact-us-form-phone-error',
    );
  });

  it('validates email only after blur instead of while typing', () => {
    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    const emailInput = screen.getByLabelText(
      new RegExp(enContent.contactUs.contactUsForm.emailFieldLabel),
    );

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    expect(screen.queryByText('Please enter a valid email address.')).not.toBeInTheDocument();

    fireEvent.blur(emailInput);
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
  });

  it('requires CAPTCHA verification before form submission', () => {
    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    const emailInput = screen.getByLabelText(
      new RegExp(enContent.contactUs.contactUsForm.emailFieldLabel),
    );
    const messageInput = screen.getByLabelText(
      new RegExp(enContent.contactUs.contactUsForm.messageLabel),
    );
    const submitButton = screen.getByRole('button', {
      name: enContent.contactUs.contactUsForm.submitLabel,
    });

    fireEvent.change(emailInput, { target: { value: 'parent@example.com' } });
    fireEvent.change(messageInput, { target: { value: 'Tell me more about your course.' } });
    fireEvent.click(submitButton);

    expect(
      screen.getByText(enContent.contactUs.contactUsForm.captchaRequiredError),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));

    expect(
      screen.queryByText(enContent.contactUs.contactUsForm.captchaRequiredError),
    ).not.toBeInTheDocument();
  });

  it('submits the validated form payload to the contact-us API endpoint', async () => {
    const request = vi.fn().mockResolvedValue(null);
    mockedCreateCrmApiClient.mockReturnValue({
      request,
    });

    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    const firstNameInput = screen.getByLabelText(
      enContent.contactUs.contactUsForm.firstNameLabel,
    );
    const emailInput = screen.getByLabelText(
      new RegExp(enContent.contactUs.contactUsForm.emailFieldLabel),
    );
    const phoneInput = screen.getByLabelText(
      enContent.contactUs.contactUsForm.phoneLabel,
    );
    const messageInput = screen.getByLabelText(
      new RegExp(enContent.contactUs.contactUsForm.messageLabel),
    );
    const submitButton = screen.getByRole('button', {
      name: enContent.contactUs.contactUsForm.submitLabel,
    });

    fireEvent.change(firstNameInput, { target: { value: ' Ida ' } });
    fireEvent.change(emailInput, { target: { value: 'parent@example.com' } });
    fireEvent.change(phoneInput, { target: { value: ' +852 1234 5678 ' } });
    fireEvent.change(messageInput, { target: { value: ' Tell me more about your courses. ' } });
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        endpointPath: '/v1/contact-us',
        method: 'POST',
        body: {
          first_name: 'Ida',
          email_address: 'parent@example.com',
          phone_number: '+852 1234 5678',
          message: 'Tell me more about your courses.',
        },
        expectedSuccessStatuses: [200, 202],
      });
      expect(
        screen.getByText(enContent.contactUs.contactUsForm.successTitle),
      ).toBeInTheDocument();
      expect(
        screen.getByText(enContent.contactUs.contactUsForm.successDescription),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {
          name: enContent.contactUs.contactUsForm.submitLabel,
        }),
      ).not.toBeInTheDocument();
    });
  });

  it('shows an inline submit error under the button when submission fails', async () => {
    const request = vi.fn().mockRejectedValue(new Error('request failed'));
    mockedCreateCrmApiClient.mockReturnValue({
      request,
    });

    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    fireEvent.change(
      screen.getByLabelText(new RegExp(enContent.contactUs.contactUsForm.emailFieldLabel)),
      { target: { value: 'parent@example.com' } },
    );
    fireEvent.change(
      screen.getByLabelText(new RegExp(enContent.contactUs.contactUsForm.messageLabel)),
      { target: { value: 'Tell me more about your course.' } },
    );
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.contactUs.contactUsForm.submitLabel,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(enContent.contactUs.contactUsForm.submitErrorMessage),
      ).toBeInTheDocument();
    });
  });
});
