/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import enContent from '@/content/en.json';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';

const originalTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill: _fill,
    priority: _priority,
    ...props
  }: {
    alt?: string;
    fill?: boolean;
    priority?: boolean;
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

describe('SproutsSquadCommunity section', () => {
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

  it('uses migrated section/overlay/logo classes and renders CTA-first state', () => {
    const { container } = render(
      <SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />,
    );

    const section = screen.getByRole('region', {
      name: enContent.sproutsSquadCommunity.heading,
    });
    expect(section.className).toContain('es-sprouts-community-section');

    expect(container.querySelector('.es-sprouts-community-overlay')).not.toBeNull();
    const sectionLogo = container.querySelector('img.es-sprouts-community-logo');
    expect(sectionLogo).not.toBeNull();
    expect(sectionLogo?.className).toContain('invisible');
    expect(sectionLogo?.className).toContain('sm:visible');
    expect(
      container.querySelector('img[src="/images/footer-community-bg.webp"]'),
    ).toBeNull();
    expect(
      container.querySelector('.es-section-header')?.className,
    ).toContain('es-section-header--left');

    const heading = screen.getByRole('heading', {
      level: 2,
      name: enContent.sproutsSquadCommunity.heading,
    });
    expect(heading.className).toContain('es-sprouts-community-heading');

    const supportParagraph = screen.getByText(
      enContent.sproutsSquadCommunity.supportParagraph,
    );
    expect(supportParagraph.className).toContain(
      'es-sprouts-community-support-paragraph',
    );

    const initialCtaButton = screen.getByRole('button', {
      name: enContent.sproutsSquadCommunity.ctaLabel,
    });
    expect(initialCtaButton).toBeInTheDocument();
    expect(initialCtaButton.closest('form')).toHaveAttribute('novalidate');
    expect(
      screen.queryByPlaceholderText(enContent.sproutsSquadCommunity.emailPlaceholder),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: enContent.sproutsSquadCommunity.ctaLabel }),
    ).not.toBeInTheDocument();
  });

  it('reveals email input and captcha after initial CTA click', () => {
    render(<SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.ctaLabel,
      }),
    );

    expect(
      screen.getByPlaceholderText(enContent.sproutsSquadCommunity.emailPlaceholder),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mock-turnstile-captcha')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.formSubmitLabel,
      }),
    ).toBeInTheDocument();
  });

  it('fades in revealed fields after the initial CTA click', async () => {
    render(<SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.ctaLabel,
      }),
    );

    const emailInput = screen.getByPlaceholderText(
      enContent.sproutsSquadCommunity.emailPlaceholder,
    );
    const form = emailInput.closest('form');
    if (!form) {
      throw new Error('Expected sprouts community form to render after CTA click');
    }
    expect(form).toHaveClass('transition-opacity');
    expect(form).toHaveClass('duration-300');

    await waitFor(() => {
      expect(form).toHaveClass('opacity-100');
    });
  });

  it('shows email validation error when form submit is clicked with empty email', () => {
    render(<SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.ctaLabel,
      }),
    );

    const emailInput = screen.getByPlaceholderText(
      enContent.sproutsSquadCommunity.emailPlaceholder,
    );
    const submitButton = screen.getByRole('button', {
      name: enContent.sproutsSquadCommunity.formSubmitLabel,
    });

    fireEvent.click(submitButton);

    expect(
      screen.getByText(enContent.sproutsSquadCommunity.emailValidationMessage),
    ).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows email validation error for invalid email after CTA reveal', () => {
    render(<SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.ctaLabel,
      }),
    );

    const emailInput = screen.getByPlaceholderText(
      enContent.sproutsSquadCommunity.emailPlaceholder,
    );
    const submitButton = screen.getByRole('button', {
      name: enContent.sproutsSquadCommunity.formSubmitLabel,
    });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    fireEvent.click(submitButton);

    expect(
      screen.getByText(enContent.sproutsSquadCommunity.emailValidationMessage),
    ).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows captcha-required error when token is missing', async () => {
    render(<SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.ctaLabel,
      }),
    );
    fireEvent.change(
      screen.getByPlaceholderText(enContent.sproutsSquadCommunity.emailPlaceholder),
      { target: { value: 'community@example.com' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.formSubmitLabel,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(enContent.sproutsSquadCommunity.captchaRequiredError),
      ).toBeInTheDocument();
    });
  });

  it('submits payload with turnstile token and shows success state', async () => {
    const request = vi.fn().mockResolvedValue(null);
    mockedCreateCrmApiClient.mockReturnValue({ request });

    render(<SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.ctaLabel,
      }),
    );
    fireEvent.change(
      screen.getByPlaceholderText(enContent.sproutsSquadCommunity.emailPlaceholder),
      { target: { value: 'community@example.com' } },
    );
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.formSubmitLabel,
      }),
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        endpointPath: '/v1/contact-us',
        method: 'POST',
        body: {
          email_address: 'community@example.com',
          message: enContent.sproutsSquadCommunity.prefilledMessage,
        },
        turnstileToken: 'mock-turnstile-token',
        expectedSuccessStatuses: [200, 202],
      });
      expect(
        screen.getByText(enContent.sproutsSquadCommunity.successMessage),
      ).toBeInTheDocument();
    });
  });

  it('shows submit error when API request fails', async () => {
    const request = vi.fn().mockRejectedValue(new Error('request failed'));
    mockedCreateCrmApiClient.mockReturnValue({ request });

    render(<SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.ctaLabel,
      }),
    );
    fireEvent.change(
      screen.getByPlaceholderText(enContent.sproutsSquadCommunity.emailPlaceholder),
      { target: { value: 'community@example.com' } },
    );
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.formSubmitLabel,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(enContent.sproutsSquadCommunity.submitErrorMessage),
      ).toBeInTheDocument();
    });
  });
});
