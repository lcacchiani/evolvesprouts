/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import enContent from '@/content/en.json';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';

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
  afterEach(() => {
    mockedCreateCrmApiClient.mockReset();
    mockedCreateCrmApiClient.mockReturnValue(null);
  });

  it('uses migrated section/overlay/logo classes and renders newsletter form', () => {
    const { container } = render(
      <SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />,
    );

    const section = screen.getByRole('region', {
      name: enContent.sproutsSquadCommunity.heading,
    });
    expect(section.className).toContain('es-sprouts-community-section');

    expect(container.querySelector('.es-sprouts-community-overlay')).not.toBeNull();
    expect(container.querySelector('img.es-sprouts-community-logo')).not.toBeNull();
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

    expect(
      screen.getByPlaceholderText(enContent.sproutsSquadCommunity.emailPlaceholder),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: enContent.sproutsSquadCommunity.ctaLabel }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: enContent.sproutsSquadCommunity.ctaLabel }),
    ).not.toBeInTheDocument();
  });

  it('shows email validation error for invalid email', () => {
    render(<SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />);

    const emailInput = screen.getByPlaceholderText(
      enContent.sproutsSquadCommunity.emailPlaceholder,
    );
    const submitButton = screen.getByRole('button', {
      name: enContent.sproutsSquadCommunity.ctaLabel,
    });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    fireEvent.click(submitButton);

    expect(
      screen.getByText(enContent.sproutsSquadCommunity.emailValidationMessage),
    ).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('submits newsletter payload and shows success state', async () => {
    const request = vi.fn().mockResolvedValue(null);
    mockedCreateCrmApiClient.mockReturnValue({ request });

    render(<SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />);

    fireEvent.change(
      screen.getByPlaceholderText(enContent.sproutsSquadCommunity.emailPlaceholder),
      { target: { value: 'community@example.com' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.ctaLabel,
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

    fireEvent.change(
      screen.getByPlaceholderText(enContent.sproutsSquadCommunity.emailPlaceholder),
      { target: { value: 'community@example.com' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.sproutsSquadCommunity.ctaLabel,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(enContent.sproutsSquadCommunity.submitErrorMessage),
      ).toBeInTheDocument();
    });
  });
});
