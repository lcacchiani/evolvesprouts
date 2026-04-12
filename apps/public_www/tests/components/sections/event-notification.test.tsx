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
    const { container } = render(
      <EventNotification
        content={enContent.events.notification}
        commonCaptchaContent={enContent.common.captcha}
        commonFormActionsContent={enContent.common.formActions}
        locale='en'
      />,
    );

    const section = screen.getByRole('region', {
      name: enContent.events.notification.title,
    });
    expect(section.className).toContain('es-event-notification-section');
    expect(container.querySelector('img.es-event-notification-logo')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: enContent.events.notification.ctaLabel,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(enContent.events.notification.emailPlaceholder),
    ).not.toBeInTheDocument();
  });

  it('reveals email input and captcha after initial CTA click', () => {
    render(
      <EventNotification
        content={enContent.events.notification}
        commonCaptchaContent={enContent.common.captcha}
        commonFormActionsContent={enContent.common.formActions}
        locale='en'
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.events.notification.ctaLabel,
      }),
    );

    expect(
      screen.getByPlaceholderText(enContent.events.notification.emailPlaceholder),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mock-turnstile-captcha')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: enContent.events.notification.formSubmitLabel,
      }),
    ).toBeInTheDocument();
  });

  it('shows the loading gear on the submit button while the request is in flight', async () => {
    let releaseRequest: (() => void) | undefined;
    const request = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          releaseRequest = () => {
            reject(new Error('deferred failure'));
          };
        }),
    );
    mockedCreateCrmApiClient.mockReturnValue({ request });

    render(
      <EventNotification
        content={enContent.events.notification}
        commonCaptchaContent={enContent.common.captcha}
        commonFormActionsContent={enContent.common.formActions}
        locale='en'
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.events.notification.ctaLabel,
      }),
    );
    fireEvent.change(
      screen.getByPlaceholderText(enContent.events.notification.emailPlaceholder),
      { target: { value: 'events@example.com' } },
    );
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.events.notification.formSubmitLabel,
      }),
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });

    const submitButton = screen.getByRole('button', {
      name: enContent.common.formActions.submittingLabel,
    });
    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId('event-notification-submit-loading-gear')).toHaveClass(
      'animate-spin',
    );

    releaseRequest?.();
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: enContent.events.notification.formSubmitLabel,
        }),
      ).toBeInTheDocument();
    });
  });

  it('submits payload with turnstile token and shows success state', async () => {
    const request = vi.fn().mockResolvedValue(null);
    mockedCreateCrmApiClient.mockReturnValue({ request });

    render(
      <EventNotification
        content={enContent.events.notification}
        commonCaptchaContent={enContent.common.captcha}
        commonFormActionsContent={enContent.common.formActions}
        locale='en'
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.events.notification.ctaLabel,
      }),
    );
    fireEvent.change(
      screen.getByPlaceholderText(enContent.events.notification.emailPlaceholder),
      { target: { value: 'events@example.com' } },
    );
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.events.notification.formSubmitLabel,
      }),
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        endpointPath: '/v1/legacy/contact-us',
        method: 'POST',
        body: {
          email_address: 'events@example.com',
          first_name: 'Events',
          message: enContent.events.notification.prefilledMessage,
          marketing_opt_in: true,
          locale: 'en',
          signup_intent: 'event_notification',
        },
        turnstileToken: 'mock-turnstile-token',
        expectedSuccessStatuses: [200, 202],
      });
      expect(
        screen.getByText(enContent.events.notification.successMessage),
      ).toBeInTheDocument();
    });
  });

});
