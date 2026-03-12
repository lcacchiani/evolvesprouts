/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventNotification } from '@/components/sections/event-notification';
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

describe('EventNotification section', () => {
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

  it('renders event notification section in CTA-first state', () => {
    render(
      <EventNotification content={enContent.eventNotification} />,
    );

    const section = screen.getByRole('region', {
      name: enContent.eventNotification.title,
    });
    expect(section.className).toContain('es-event-notification-section');
    expect(
      screen.getByRole('button', {
        name: enContent.eventNotification.ctaLabel,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(enContent.eventNotification.emailPlaceholder),
    ).not.toBeInTheDocument();
  });

  it('reveals email input and captcha after initial CTA click', () => {
    render(<EventNotification content={enContent.eventNotification} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.eventNotification.ctaLabel,
      }),
    );

    expect(
      screen.getByPlaceholderText(enContent.eventNotification.emailPlaceholder),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mock-turnstile-captcha')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: enContent.eventNotification.formSubmitLabel,
      }),
    ).toBeInTheDocument();
  });

  it('submits payload with turnstile token and shows success state', async () => {
    const request = vi.fn().mockResolvedValue(null);
    mockedCreateCrmApiClient.mockReturnValue({ request });

    render(<EventNotification content={enContent.eventNotification} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.eventNotification.ctaLabel,
      }),
    );
    fireEvent.change(
      screen.getByPlaceholderText(enContent.eventNotification.emailPlaceholder),
      { target: { value: 'events@example.com' } },
    );
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.eventNotification.formSubmitLabel,
      }),
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        endpointPath: '/v1/contact-us',
        method: 'POST',
        body: {
          email_address: 'events@example.com',
          message: enContent.eventNotification.prefilledMessage,
        },
        turnstileToken: 'mock-turnstile-token',
        expectedSuccessStatuses: [200, 202],
      });
      expect(
        screen.getByText(enContent.eventNotification.successMessage),
      ).toBeInTheDocument();
    });
  });
});
