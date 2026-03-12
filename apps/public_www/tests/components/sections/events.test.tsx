import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Events } from '@/components/sections/events';
import enContent from '@/content/en.json';
import {
  createPublicCrmApiClient,
  type CrmApiClient,
} from '@/lib/crm-api-client';

vi.mock('@/lib/crm-api-client', () => ({
  createPublicCrmApiClient: vi.fn(),
  isAbortRequestError: (error: unknown) =>
    error instanceof Error && error.name === 'AbortError',
}));

describe('Events section', () => {
  const mockedCreateCrmApiClient = vi.mocked(createPublicCrmApiClient);

  beforeEach(() => {
    mockedCreateCrmApiClient.mockReset();
    mockedCreateCrmApiClient.mockReturnValue(null);
  });

  it('does not render the eyebrow label', () => {
    render(
      <Events
        content={enContent.events}
        newsletterContent={enContent.sproutsSquadCommunity}
      />,
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: enContent.events.title,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(enContent.events.eyebrow)).not.toBeInTheDocument();
  });

  it('removes mobile top padding while preserving responsive section spacing', () => {
    render(
      <Events
        content={enContent.events}
        newsletterContent={enContent.sproutsSquadCommunity}
      />,
    );

    const section = document.getElementById('events');
    expect(section).not.toBeNull();
    expect(section?.className).toContain('pt-0');
    expect(section?.className).toContain('sm:pt-[60px]');
  });

  it('renders an orange spinning gear while events load', () => {
    const pendingRequest = vi.fn(() => new Promise<unknown>(() => {}));
    const mockApiClient: CrmApiClient = {
      request: pendingRequest,
    };
    mockedCreateCrmApiClient.mockReturnValue(mockApiClient);

    render(
      <Events
        content={enContent.events}
        newsletterContent={enContent.sproutsSquadCommunity}
      />,
    );

    const loadingStatuses = screen.getAllByRole('status', {
      name: enContent.events.loadingLabel,
    });
    const loadingGears = screen.getAllByTestId('events-loading-gear');

    expect(loadingStatuses).toHaveLength(2);
    expect(loadingGears).toHaveLength(2);
    expect(loadingGears[0]).toHaveClass('animate-spin');
    expect(loadingGears[0]?.getAttribute('class')).toContain('es-events-loading-gear');
    expect(loadingGears[0]?.getAttribute('style')).toBeNull();
    expect(screen.getAllByText(enContent.events.loadingLabel)).toHaveLength(2);
  });

  it('does not render a filter dropdown', () => {
    render(
      <Events
        content={enContent.events}
        newsletterContent={enContent.sproutsSquadCommunity}
      />,
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders the independent past events section notify CTA', () => {
    render(
      <Events
        content={enContent.events}
        newsletterContent={enContent.sproutsSquadCommunity}
      />,
    );

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: enContent.events.past.title,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(enContent.events.past.notifyPrompt)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: enContent.events.past.notifyCtaLabel }),
    ).toBeInTheDocument();
  });
});
