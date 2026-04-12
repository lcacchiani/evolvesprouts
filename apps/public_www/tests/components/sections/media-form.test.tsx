import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaForm } from '@/components/sections/media-form';
import enContent from '@/content/en.json';
import { trackPublicFormOutcome } from '@/lib/analytics';
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

vi.mock('@/lib/analytics', () => ({
  trackPublicFormOutcome: vi.fn(),
  trackEcommerceEvent: vi.fn(),
}));

const mockedCreateCrmApiClient = vi.mocked(createPublicCrmApiClient);
const mockedTrackPublicFormOutcome = vi.mocked(trackPublicFormOutcome);

function mediaFormProps() {
  const resourcesContent = enContent.resources;
  return {
    ctaLabel: resourcesContent.ctaLabel,
    locale: 'en' as const,
    resourceKey: resourcesContent.resourceKey,
    formMarketingOptInLabel: resourcesContent.formMarketingOptInLabel,
    formFirstNameLabel: resourcesContent.formFirstNameLabel,
    formEmailLabel: resourcesContent.formEmailLabel,
    formSubmitLabel: resourcesContent.formSubmitLabel,
    formSubmittingLabel: resourcesContent.formSubmittingLabel,
    formSuccessTitle: resourcesContent.formSuccessTitle,
    formSuccessBody: resourcesContent.formSuccessBody,
    formErrorMessage: resourcesContent.formErrorMessage,
  };
}

function renderMediaForm() {
  return render(<MediaForm {...mediaFormProps()} />);
}

describe('MediaForm', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-turnstile-site-key';
  });

  afterEach(() => {
    mockedCreateCrmApiClient.mockReset();
    mockedCreateCrmApiClient.mockReturnValue(null);
    mockedTrackPublicFormOutcome.mockReset();
    if (originalTurnstileSiteKey === undefined) {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalTurnstileSiteKey;
    }
  });

  it('tracks validation_error when submit runs with invalid fields', () => {
    mockedCreateCrmApiClient.mockReturnValue({ request: vi.fn() });
    renderMediaForm();

    fireEvent.click(screen.getByRole('button', { name: enContent.resources.ctaLabel }));
    fireEvent.change(
      screen.getByPlaceholderText(enContent.resources.formFirstNameLabel),
      { target: { value: '' } },
    );
    fireEvent.change(screen.getByPlaceholderText(enContent.resources.formEmailLabel), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', { name: enContent.resources.formSubmitLabel }),
    );

    expect(mockedTrackPublicFormOutcome).toHaveBeenCalledWith('media_form_submit_attempt', {
      formKind: 'media_request',
      formId: 'media-form__media-form',
      sectionId: 'media-form',
      ctaLocation: 'form',
      params: {
        resource_key: 'patience-free-guide',
      },
    });
    expect(mockedTrackPublicFormOutcome).toHaveBeenCalledWith('media_form_submit_error', {
      formKind: 'media_request',
      formId: 'media-form__media-form',
      sectionId: 'media-form',
      ctaLocation: 'form',
      params: {
        resource_key: 'patience-free-guide',
        error_type: 'validation_error',
      },
    });
  });

  it('renders the CTA button before the form opens', () => {
    renderMediaForm();

    expect(
      screen.getByRole('button', { name: enContent.resources.ctaLabel }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(enContent.resources.formFirstNameLabel),
    ).not.toBeInTheDocument();
  });

  it('opens the form when CTA is clicked', () => {
    renderMediaForm();

    fireEvent.click(screen.getByRole('button', { name: enContent.resources.ctaLabel }));

    expect(
      screen.getByPlaceholderText(enContent.resources.formFirstNameLabel),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(enContent.resources.formEmailLabel)).toBeInTheDocument();
    expect(mockedTrackPublicFormOutcome).toHaveBeenCalledWith('media_form_open', {
      formKind: 'media_request',
      formId: 'media-form__media-form',
      sectionId: 'media-form',
      ctaLocation: 'cta_button',
      params: {
        resource_key: 'patience-free-guide',
      },
    });
  });

  it('adds top spacing and fades in the form when CTA is clicked', async () => {
    renderMediaForm();

    fireEvent.click(screen.getByRole('button', { name: enContent.resources.ctaLabel }));

    const firstNameInput = screen.getByPlaceholderText(
      enContent.resources.formFirstNameLabel,
    );
    const form = firstNameInput.closest('form');
    if (!form) {
      throw new Error('Expected media form to render after CTA click');
    }
    expect(form).toHaveClass('mt-7');
    expect(form).toHaveClass('transition-opacity');
    expect(form).toHaveClass('duration-300');

    await waitFor(() => {
      expect(form).toHaveClass('opacity-100');
    });
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
    renderMediaForm();

    fireEvent.click(screen.getByRole('button', { name: enContent.resources.ctaLabel }));
    fireEvent.change(
      screen.getByPlaceholderText(enContent.resources.formFirstNameLabel),
      { target: { value: 'Ida' } },
    );
    fireEvent.change(screen.getByPlaceholderText(enContent.resources.formEmailLabel), {
      target: { value: 'ida@example.com' },
    });
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', { name: enContent.resources.formSubmitLabel }),
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });

    const submitButton = screen.getByRole('button', {
      name: enContent.resources.formSubmittingLabel,
    });
    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId('media-form-submit-loading-gear')).toHaveClass('animate-spin');

    releaseRequest?.();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: enContent.resources.formSubmitLabel }),
      ).toBeInTheDocument();
    });
  });

  it('submits valid payload and renders success message', async () => {
    const request = vi.fn().mockResolvedValue(null);
    mockedCreateCrmApiClient.mockReturnValue({ request });
    renderMediaForm();

    fireEvent.click(screen.getByRole('button', { name: enContent.resources.ctaLabel }));
    fireEvent.change(
      screen.getByPlaceholderText(enContent.resources.formFirstNameLabel),
      { target: { value: ' Ida ' } },
    );
    fireEvent.change(screen.getByPlaceholderText(enContent.resources.formEmailLabel), {
      target: { value: 'IDA@Example.com' },
    });
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', { name: enContent.resources.formSubmitLabel }),
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        endpointPath: '/v1/assets/free/request',
        method: 'POST',
        body: {
          first_name: 'Ida',
          email: 'ida@example.com',
          resource_key: 'patience-free-guide',
          marketing_opt_in: false,
          locale: 'en',
        },
        turnstileToken: 'mock-turnstile-token',
        expectedSuccessStatuses: [202],
      });
      expect(mockedTrackPublicFormOutcome).toHaveBeenCalledWith('media_form_submit_attempt', {
        formKind: 'media_request',
        formId: 'media-form__media-form',
        sectionId: 'media-form',
        ctaLocation: 'form',
        params: {
          resource_key: 'patience-free-guide',
        },
      });
      expect(mockedTrackPublicFormOutcome).toHaveBeenCalledWith('media_form_submit_success', {
        formKind: 'media_request',
        formId: 'media-form__media-form',
        sectionId: 'media-form',
        ctaLocation: 'form',
        params: {
          resource_key: 'patience-free-guide',
        },
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
    renderMediaForm();

    fireEvent.click(screen.getByRole('button', { name: enContent.resources.ctaLabel }));
    fireEvent.change(
      screen.getByPlaceholderText(enContent.resources.formFirstNameLabel),
      { target: { value: 'Ida' } },
    );
    fireEvent.change(screen.getByPlaceholderText(enContent.resources.formEmailLabel), {
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
      expect(mockedTrackPublicFormOutcome).toHaveBeenCalledWith('media_form_submit_attempt', {
        formKind: 'media_request',
        formId: 'media-form__media-form',
        sectionId: 'media-form',
        ctaLocation: 'form',
        params: {
          resource_key: 'patience-free-guide',
        },
      });
      expect(mockedTrackPublicFormOutcome).toHaveBeenCalledWith('media_form_submit_error', {
        formKind: 'media_request',
        formId: 'media-form__media-form',
        sectionId: 'media-form',
        ctaLocation: 'form',
        params: {
          resource_key: 'patience-free-guide',
          error_type: 'api_error',
        },
      });
    });
  });

  it('disables submit and shows error when CRM API client is unavailable', () => {
    mockedCreateCrmApiClient.mockReturnValue(null);
    renderMediaForm();

    fireEvent.click(screen.getByRole('button', { name: enContent.resources.ctaLabel }));

    const submitButton = screen.getByRole('button', { name: enContent.resources.formSubmitLabel });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(enContent.resources.formErrorMessage)).toBeInTheDocument();
  });

  it('shows success only on the MediaForm instance that submitted', async () => {
    const request = vi.fn().mockResolvedValue(null);
    mockedCreateCrmApiClient.mockReturnValue({ request });

    render(
      <>
        <MediaForm {...mediaFormProps()} analyticsSectionId='form-a' />
        <MediaForm {...mediaFormProps()} analyticsSectionId='form-b' />
      </>,
    );

    fireEvent.click(screen.getAllByRole('button', { name: enContent.resources.ctaLabel })[0]);
    fireEvent.change(
      screen.getByPlaceholderText(enContent.resources.formFirstNameLabel),
      { target: { value: 'Ida' } },
    );
    fireEvent.change(screen.getByPlaceholderText(enContent.resources.formEmailLabel), {
      target: { value: 'ida@example.com' },
    });
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', { name: enContent.resources.formSubmitLabel }),
    );

    await waitFor(() => {
      const titles = screen.getAllByText(enContent.resources.formSuccessTitle);
      expect(titles).toHaveLength(1);
    });

    expect(
      screen.getAllByRole('button', { name: enContent.resources.ctaLabel }),
    ).toHaveLength(1);
  });
});
