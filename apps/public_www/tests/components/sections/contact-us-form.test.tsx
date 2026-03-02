/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ContactUsForm,
  type ContactUsFormContactConfig,
} from '@/components/sections/contact-us-form';
import enContent from '@/content/en.json';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';

const originalTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const defaultContactConfig: ContactUsFormContactConfig = {
  contactEmail: 'hello@example.com',
  whatsappUrl: 'https://wa.me/message/ZQHVW4DEORD5A1?src=qr',
  instagramUrl: 'https://www.instagram.com/evolvesprouts',
  linkedinUrl: 'https://www.linkedin.com/company/evolve-sprouts',
};

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

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

function renderContactUsForm(
  contactConfig: ContactUsFormContactConfig = defaultContactConfig,
) {
  return render(
    <ContactUsForm
      content={enContent.contactUs.contactUsForm}
      contactConfig={contactConfig}
    />,
  );
}

describe('ContactUsForm section', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-turnstile-site-key';
  });

  afterEach(() => {
    mockedCreateCrmApiClient.mockReset();
    mockedCreateCrmApiClient.mockReturnValue(null);

    if (originalTurnstileSiteKey === undefined) {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalTurnstileSiteKey;
    }

  });

  it('uses class-based decorative background styling on the section container', () => {
    renderContactUsForm();

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
    renderContactUsForm();

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

  it('renders icon-based contact methods in the configured order with official assets', () => {
    renderContactUsForm();

    const list = screen.getByRole('list', {
      name: enContent.contactUs.contactUsForm.contactMethodsTitle,
    });
    expect(list).toBeInTheDocument();
    expect(list.className).toContain('flex-wrap');
    expect(list.className).toContain('max-w-full');
    expect(list.className).not.toContain('overflow-x-auto');
    const contactMethodsTitle = screen.getByText(
      enContent.contactUs.contactUsForm.contactMethodsTitle,
    );
    expect(contactMethodsTitle.className).toContain('es-section-body');
    expect(contactMethodsTitle.className).toContain('text-[1.05rem]');
    expect(contactMethodsTitle.className).toContain('leading-8');

    const emailLink = screen.getByRole('link', {
      name: enContent.contactUs.contactUsForm.contactMethodLinks.mail,
    });
    const whatsappLink = screen.getByRole('link', {
      name: enContent.contactUs.contactUsForm.contactMethodLinks.whatsapp,
    });
    const instagramLink = screen.getByRole('link', {
      name: enContent.contactUs.contactUsForm.contactMethodLinks.instagram,
    });
    const linkedInLink = screen.getByRole('link', {
      name: enContent.contactUs.contactUsForm.contactMethodLinks.linkedin,
    });
    const formLink = screen.getByRole('link', {
      name: enContent.contactUs.contactUsForm.contactMethodLinks.form,
    });

    expect(emailLink).toHaveAttribute('href', 'mailto:hello@example.com');
    expect(whatsappLink).toHaveAttribute(
      'href',
      'https://wa.me/message/ZQHVW4DEORD5A1?src=qr',
    );
    expect(instagramLink).toHaveAttribute('href', 'https://www.instagram.com/evolvesprouts');
    expect(linkedInLink).toHaveAttribute(
      'href',
      'https://www.linkedin.com/company/evolve-sprouts',
    );
    expect(formLink).toHaveAttribute('href', '#contact-form');
    expect(within(list).getAllByRole('link').map((link) => link.textContent?.trim())).toEqual([
      enContent.contactUs.contactUsForm.contactMethodLinks.form,
      enContent.contactUs.contactUsForm.contactMethodLinks.instagram,
      enContent.contactUs.contactUsForm.contactMethodLinks.linkedin,
      enContent.contactUs.contactUsForm.contactMethodLinks.whatsapp,
      enContent.contactUs.contactUsForm.contactMethodLinks.mail,
    ]);
    for (const link of [emailLink, whatsappLink, instagramLink, linkedInLink, formLink]) {
      expect(link.className).toContain('es-section-body');
      expect(link.className).toContain('text-[1.05rem]');
      expect(link.className).toContain('leading-8');
    }
    expect(screen.getByTestId('contact-method-icon-email').querySelector('img')).toHaveAttribute(
      'src',
      '/images/contact-email.svg',
    );
    const whatsappIcon = screen
      .getByTestId('contact-method-icon-whatsapp')
      .querySelector('img');
    expect(whatsappIcon).toHaveAttribute('src', '/images/contact-whatsapp.svg');
    expect(whatsappIcon?.className).toContain('es-contact-us-contact-method-icon--whatsapp');
    expect(
      screen.getByTestId('contact-method-icon-instagram').querySelector('img'),
    ).toHaveAttribute('src', '/images/contact-instagram.png');
    expect(
      screen.getByTestId('contact-method-icon-linkedin').querySelector('img'),
    ).toHaveAttribute('src', '/images/contact-linkedin.png');
    expect(screen.getByTestId('contact-method-icon-form').querySelector('img')).toHaveAttribute(
      'src',
      '/images/contact-form.svg',
    );
    expect(emailLink.querySelector('svg[data-external-link-icon="true"]')).toBeNull();
    expect(formLink.querySelector('svg[data-external-link-icon="true"]')).toBeNull();
    expect(whatsappLink.querySelector('svg[data-external-link-icon="true"]')).not.toBeNull();
    expect(instagramLink.querySelector('svg[data-external-link-icon="true"]')).not.toBeNull();
    expect(linkedInLink.querySelector('svg[data-external-link-icon="true"]')).not.toBeNull();
  });

  it('omits channels that are missing in the provided contact configuration', () => {
    renderContactUsForm({
      contactEmail: undefined,
      whatsappUrl: undefined,
      instagramUrl: undefined,
      linkedinUrl: undefined,
    });

    expect(
      screen.queryByRole('link', {
        name: enContent.contactUs.contactUsForm.contactMethodLinks.mail,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', {
        name: enContent.contactUs.contactUsForm.contactMethodLinks.whatsapp,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', {
        name: enContent.contactUs.contactUsForm.contactMethodLinks.instagram,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', {
        name: enContent.contactUs.contactUsForm.contactMethodLinks.linkedin,
      }),
    ).toBeNull();

    expect(
      screen.getByRole('link', {
        name: enContent.contactUs.contactUsForm.contactMethodLinks.form,
      }),
    ).toHaveAttribute('href', '#contact-form');
  });

  it('uses the same input styling pattern as the booking form', () => {
    renderContactUsForm();

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

  it('renders promise items as plain text without bullets or indentation', () => {
    renderContactUsForm();

    const promiseList = screen
      .getByRole('heading', {
        level: 2,
        name: enContent.contactUs.contactUsForm.promiseTitle,
      })
      .nextElementSibling as HTMLUListElement | null;
    expect(promiseList).not.toBeNull();
    expect(promiseList?.className).not.toContain('list-disc');
    expect(promiseList?.className).not.toContain('pl-6');

    const listItems = promiseList?.querySelectorAll('li') ?? [];
    expect(listItems.length).toBeGreaterThan(0);
    for (const listItem of listItems) {
      expect(listItem.className).not.toContain('bg-white');
      expect(listItem.className).not.toContain('shadow-');
    }
  });

  it('shows linked validation feedback for invalid email and phone values', () => {
    renderContactUsForm();

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

    expect(
      screen.getByText(enContent.contactUs.contactUsForm.emailValidationError),
    ).toBeInTheDocument();
    expect(
      screen.getByText(enContent.contactUs.contactUsForm.phoneValidationError),
    ).toBeInTheDocument();
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
    renderContactUsForm();

    const emailInput = screen.getByLabelText(
      new RegExp(enContent.contactUs.contactUsForm.emailFieldLabel),
    );

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    expect(
      screen.queryByText(enContent.contactUs.contactUsForm.emailValidationError),
    ).not.toBeInTheDocument();

    fireEvent.blur(emailInput);
    expect(
      screen.getByText(enContent.contactUs.contactUsForm.emailValidationError),
    ).toBeInTheDocument();
  });

  it('requires CAPTCHA verification before form submission', () => {
    renderContactUsForm();

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

    renderContactUsForm();

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

    renderContactUsForm();

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
