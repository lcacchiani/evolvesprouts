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

  it('renders cost chips and styles free chips in green', async () => {
    const mockApiClient: CrmApiClient = {
      request: vi.fn().mockResolvedValue({
        status: 'success',
        data: [
          {
            title: 'Paid event card',
            location: 'physical',
            address: 'PMQ, Central',
            address_url: 'https://maps.google.com/?q=PMQ+Central',
            dates: [
              {
                start_datetime: '2099-12-05T10:00:00Z',
                end_datetime: '2099-12-05T13:00:00Z',
              },
            ],
            timezone: 'HKT',
            price: 888,
            currency_symbol: 'HK$',
            is_fully_booked: false,
          },
          {
            title: 'Free event card',
            location: 'virtual',
            address: 'Online Zoom Room',
            address_url: 'https://zoom.us/',
            dates: [
              {
                start_datetime: '2099-12-06T10:00:00Z',
                end_datetime: '2099-12-06T13:00:00Z',
              },
            ],
            timezone: 'HKT',
            price: 0,
            currency_symbol: 'HK$',
            is_fully_booked: false,
          },
        ],
      }),
    };
    mockedCreateCrmApiClient.mockReturnValue(mockApiClient);

    const { container } = render(<Events content={enContent.events} />);

    await screen.findByText('Free event card');

    expect(screen.getByText('HK$888')).toBeInTheDocument();
    const freeChip = screen.getByText(enContent.events.card.freeLabel).closest('li');
    expect(freeChip).not.toBeNull();
    expect(freeChip?.getAttribute('data-event-cost-chip')).toBe('true');
    expect(freeChip?.className).toContain('es-text-success');
    expect(freeChip?.className).toContain('es-border-success');
    expect(container.querySelectorAll('[data-event-cost-icon="true"]')).toHaveLength(2);
  });

  it('shows location icon and direction link while removing the location heading and fully booked icon', async () => {
    const mockApiClient: CrmApiClient = {
      request: vi.fn().mockResolvedValue({
        status: 'success',
        data: [
          {
            title: 'Direction-ready event card',
            location: 'physical',
            address: 'PMQ, Central',
            locationAddress: '35 Aberdeen Street, Central',
            address_url:
              'https://www.google.com/maps/dir/?api=1&destination=35+Aberdeen+Street,+Central',
            dates: [
              {
                start_datetime: '2099-12-05T10:00:00Z',
                end_datetime: '2099-12-05T13:00:00Z',
              },
            ],
            timezone: 'HKT',
            is_fully_booked: true,
          },
        ],
      }),
    };
    mockedCreateCrmApiClient.mockReturnValue(mockApiClient);

    const { container } = render(<Events content={enContent.events} />);

    await screen.findByText('Direction-ready event card');

    expect(container.querySelector('.es-events-location-heading')).toBeNull();
    expect(screen.getByText('PMQ, Central')).toBeInTheDocument();
    expect(screen.getByText('35 Aberdeen Street, Central')).toBeInTheDocument();

    const locationIcons = container.querySelectorAll('[data-event-location-icon="true"]');
    expect(locationIcons).toHaveLength(1);

    const directionLink = screen.getByRole('link', {
      name: enContent.events.card.directionLabel,
    });
    expect(directionLink).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=35+Aberdeen+Street,+Central',
    );
    expect(directionLink).toHaveAttribute('target', '_blank');
    expect(screen.getByText(enContent.events.card.directionLabel).className).toContain(
      'es-link-external-label--direction',
    );

    const fullyBookedChip = screen
      .getByText(enContent.events.card.fullyBookedLabel)
      .closest('span');
    expect(fullyBookedChip?.querySelector('img')).toBeNull();
  });
});
