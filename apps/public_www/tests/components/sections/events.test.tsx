import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    vi.stubEnv('NEXT_PUBLIC_EVENTS_SOURCE', 'api');
    mockedCreateCrmApiClient.mockReset();
    mockedCreateCrmApiClient.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does not render the eyebrow label', () => {
    render(<Events content={enContent.events} />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: enContent.events.title,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(enContent.events.eyebrow)).not.toBeInTheDocument();
  });

  it('removes mobile top padding while preserving responsive section spacing', () => {
    render(<Events content={enContent.events} />);

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

    render(<Events content={enContent.events} />);

    const loadingStatus = screen.getByRole('status', {
      name: enContent.events.loadingLabel,
    });
    const loadingGear = screen.getByTestId('events-loading-gear');

    expect(loadingStatus).toBeInTheDocument();
    expect(loadingGear).toHaveClass('animate-spin');
    expect(loadingGear.getAttribute('class')).toContain('es-events-loading-gear');
    expect(loadingGear.getAttribute('style')).toBeNull();
    expect(screen.getByText(enContent.events.loadingLabel)).toBeInTheDocument();
  });

  it('does not render a filter dropdown', () => {
    render(<Events content={enContent.events} />);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders event date and time without label prefixes', async () => {
    const mockApiClient: CrmApiClient = {
      request: vi.fn().mockResolvedValue({
        status: 'success',
        data: [
          {
            title: 'Prefixless event card',
            location: 'virtual',
            address: 'Online Zoom Room',
            address_url: 'https://zoom.us/',
            dates: [
              {
                start_datetime: '2099-12-05T10:00:00Z',
                end_datetime: '2099-12-05T13:00:00Z',
              },
            ],
            timezone: 'HKT',
            is_fully_booked: false,
          },
        ],
      }),
    };
    mockedCreateCrmApiClient.mockReturnValue(mockApiClient);

    render(<Events content={enContent.events} />);

    await screen.findByText('Prefixless event card');

    expect(screen.getByText('05 Dec 2099')).toBeInTheDocument();
    expect(screen.getByText('10:00 - 13:00 HKT')).toBeInTheDocument();
    expect(screen.queryByText(/^Date:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Time:/)).not.toBeInTheDocument();
  });
});
