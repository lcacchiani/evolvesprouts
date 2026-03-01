import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FreeGuideForm } from '@/components/sections/free-guide-form';
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

function renderFreeGuideForm() {
  const resourcesContent = enContent.resources;
  return render(
    <FreeGuideForm
      ctaLabel={resourcesContent.ctaLabel}
      formFirstNameLabel={resourcesContent.formFirstNameLabel}
      formEmailLabel={resourcesContent.formEmailLabel}
      formSubmitLabel={resourcesContent.formSubmitLabel}
      formSuccessTitle={resourcesContent.formSuccessTitle}
      formSuccessBody={resourcesContent.formSuccessBody}
      formErrorMessage={resourcesContent.formErrorMessage}
    />,
  );
}

describe('FreeGuideForm', () => {
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

  it('renders the CTA button before the form opens', () => {
    renderFreeGuideForm();

    expect(
      screen.getByRole('button', { name: enContent.resources.ctaLabel }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(enContent.resources.formFirstNameLabel),
    ).not.toBeInTheDocument();
  });

  it('opens the form when CTA is clicked', () => {
    renderFreeGuideForm();

    fireEvent.click(screen.getByRole('button', { name: enContent.resources.ctaLabel }));

    expect(
      screen.getByLabelText(enContent.resources.formFirstNameLabel),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(enContent.resources.formEmailLabel)).toBeInTheDocument();
  });

  it('submits valid payload and renders success message', async () => {
    const request = vi.fn().mockResolvedValue(null);
    mockedCreateCrmApiClient.mockReturnValue({ request });
    renderFreeGuideForm();

    fireEvent.click(screen.getByRole('button', { name: enContent.resources.ctaLabel }));
    fireEvent.change(
      screen.getByLabelText(enContent.resources.formFirstNameLabel),
      { target: { value: ' Ida ' } },
    );
    fireEvent.change(screen.getByLabelText(enContent.resources.formEmailLabel), {
      target: { value: 'IDA@Example.com' },
    });
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', { name: enContent.resources.formSubmitLabel }),
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        endpointPath: '/v1/free-guide-request',
        method: 'POST',
        body: {
          first_name: 'Ida',
          email: 'ida@example.com',
        },
        turnstileToken: 'mock-turnstile-token',
        expectedSuccessStatuses: [202],
      });
    });

    expect(
      screen.getByText(enContent.resources.formSuccessTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(enContent.resources.formSuccessBody),
    ).toBeInTheDocument();
  });

  it('shows submit error when API request fails', async () => {
    const request = vi.fn().mockRejectedValue(new Error('failed'));
    mockedCreateCrmApiClient.mockReturnValue({ request });
    renderFreeGuideForm();

    fireEvent.click(screen.getByRole('button', { name: enContent.resources.ctaLabel }));
    fireEvent.change(
      screen.getByLabelText(enContent.resources.formFirstNameLabel),
      { target: { value: 'Ida' } },
    );
    fireEvent.change(screen.getByLabelText(enContent.resources.formEmailLabel), {
      target: { value: 'ida@example.com' },
    });
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', { name: enContent.resources.formSubmitLabel }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(enContent.resources.formErrorMessage),
      ).toBeInTheDocument();
    });
  });
});
