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

function formatExpectedEventDateLabel(isoDateTime: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoDateTime));
}

function formatExpectedEventTimeRange(
  startIsoDateTime: string,
  endIsoDateTime: string,
): string {
  const startDate = new Date(startIsoDateTime);
  const endDate = new Date(endIsoDateTime);
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const timeZoneLabel = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
    .formatToParts(startDate)
    .find((part) => part.type === 'timeZoneName')
    ?.value
    .trim();
  const timeRange = `${timeFormatter.format(startDate)} - ${timeFormatter.format(endDate)}`;

  return timeZoneLabel ? `${timeRange} ${timeZoneLabel}` : timeRange;
}

describe('Events section', () => {
  const mockedCreateCrmApiClient = vi.mocked(createPublicCrmApiClient);
  const defaultEventsProps = {
    content: enContent.events,
    bookingModalContent: enContent.bookingModal,
    myBestAuntieModalContent: enContent.myBestAuntie.modal,
  } as const;

  function renderEventsSection() {
    return render(<Events {...defaultEventsProps} />);
  }

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
    renderEventsSection();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: enContent.events.title,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(enContent.events.eyebrow)).not.toBeInTheDocument();
  });

  it('removes mobile top padding while preserving responsive section spacing', () => {
    renderEventsSection();

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

    renderEventsSection();

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
    renderEventsSection();

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
            is_fully_booked: false,
          },
        ],
      }),
    };
    mockedCreateCrmApiClient.mockReturnValue(mockApiClient);

    renderEventsSection();

    await screen.findByText('Prefixless event card');

    expect(
      screen.getByText(formatExpectedEventDateLabel('2099-12-05T10:00:00Z')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatExpectedEventTimeRange('2099-12-05T10:00:00Z', '2099-12-05T13:00:00Z')),
    ).toBeInTheDocument();
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
            price: 888,
            currency: 'HKD',
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
            price: 0,
            currency: 'HKD',
            is_fully_booked: false,
          },
        ],
      }),
    };
    mockedCreateCrmApiClient.mockReturnValue(mockApiClient);

    const { container } = renderEventsSection();

    await screen.findByText('Free event card');

    expect(screen.getByText('HK$888')).toBeInTheDocument();
    const freeChip = screen.getByText(enContent.events.card.freeLabel).closest('li');
    expect(freeChip).not.toBeNull();
    expect(freeChip?.getAttribute('data-event-cost-chip')).toBe('true');
    expect(freeChip?.className).toContain('es-events-detail-chip-success');
    expect(freeChip?.className).toContain('es-border-success');
    expect(container.querySelectorAll('[data-event-cost-icon="true"]')).toHaveLength(2);
  });

  it('formats event cost with thousand separators', async () => {
    const mockApiClient: CrmApiClient = {
      request: vi.fn().mockResolvedValue({
        status: 'success',
        data: [
          {
            title: 'Comma separated price card',
            location: 'physical',
            address: 'PMQ, Central',
            address_url: 'https://maps.google.com/?q=PMQ+Central',
            dates: [
              {
                start_datetime: '2099-12-07T10:00:00Z',
                end_datetime: '2099-12-07T13:00:00Z',
              },
            ],
            price: 1280,
            currency: 'HKD',
            is_fully_booked: false,
          },
        ],
      }),
    };
    mockedCreateCrmApiClient.mockReturnValue(mockApiClient);

    renderEventsSection();

    await screen.findByText('Comma separated price card');
    expect(screen.getByText('HK$1,280')).toBeInTheDocument();
  });

  it('shows virtual call icon and places fully booked chip after price chip', async () => {
    const mockApiClient: CrmApiClient = {
      request: vi.fn().mockResolvedValue({
        status: 'success',
        data: [
          {
            title: 'Virtual fully booked event card',
            location: 'virtual',
            address: 'Virtual',
            address_url: 'https://zoom.us/',
            dates: [
              {
                start_datetime: '2099-12-08T10:00:00Z',
                end_datetime: '2099-12-08T13:00:00Z',
              },
            ],
            price: 88,
            currency: 'HKD',
            is_fully_booked: true,
          },
        ],
      }),
    };
    mockedCreateCrmApiClient.mockReturnValue(mockApiClient);

    const { container } = renderEventsSection();

    await screen.findByText('Virtual fully booked event card');

    const locationIcon = container.querySelector('[data-event-location-icon="true"]');
    expect(locationIcon).not.toBeNull();
    expect(locationIcon?.className).toContain('es-mask-virtual-call-danger');

    const costChip = screen.getByText('HK$88').closest('li');
    const fullyBookedChip = screen
      .getByText(enContent.events.card.fullyBookedLabel)
      .closest('li');
    expect(costChip).not.toBeNull();
    expect(fullyBookedChip).not.toBeNull();
    expect(
      Boolean(
        costChip &&
          fullyBookedChip &&
          (costChip.compareDocumentPosition(fullyBookedChip) &
            Node.DOCUMENT_POSITION_FOLLOWING),
      ),
    ).toBe(true);
  });

  it('shows physical location icon and direction link while removing the location heading', async () => {
    const mockApiClient: CrmApiClient = {
      request: vi.fn().mockResolvedValue({
        status: 'success',
        data: [
          {
            title: 'Direction-ready event card',
            location: 'physical',
            location_name: 'PMQ, Central',
            location_address: '35 Aberdeen Street, Central',
            location_url:
              'https://www.google.com/maps/dir/?api=1&destination=35+Aberdeen+Street,+Central',
            dates: [
              {
                start_datetime: '2099-12-05T10:00:00Z',
                end_datetime: '2099-12-05T13:00:00Z',
              },
            ],
            is_fully_booked: true,
          },
        ],
      }),
    };
    mockedCreateCrmApiClient.mockReturnValue(mockApiClient);

    const { container } = renderEventsSection();

    await screen.findByText('Direction-ready event card');

    expect(container.querySelector('.es-events-location-heading')).toBeNull();
    expect(screen.getByText('PMQ, Central')).toBeInTheDocument();
    expect(screen.getByText('35 Aberdeen Street, Central')).toBeInTheDocument();

    const locationIcons = container.querySelectorAll('[data-event-location-icon="true"]');
    expect(locationIcons).toHaveLength(1);
    expect(locationIcons[0]?.className).toContain('es-mask-location-danger');

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
      .closest('li');
    expect(fullyBookedChip?.querySelector('img')).toBeNull();
  });

  it('uses booking_system to render in-page booking buttons consistently', async () => {
    const mockApiClient: CrmApiClient = {
      request: vi.fn().mockResolvedValue({
        status: 'success',
        data: [
          {
            id: 'event-booking-card',
            title: 'Event booking card',
            booking_system: 'event-booking',
            location: 'physical',
            address: 'PMQ, Central',
            address_url: 'https://maps.google.com/?q=PMQ+Central',
            dates: [
              {
                start_datetime: '2099-12-10T10:00:00Z',
                end_datetime: '2099-12-10T11:00:00Z',
              },
            ],
            price: 350,
            is_fully_booked: false,
          },
          {
            id: 'my-best-auntie-booking-card',
            title: 'My Best Auntie booking card',
            booking_system: 'my-best-auntie-booking',
            age_group: '1-3',
            cohort: '04-26',
            location: 'physical',
            address: 'PMQ, Central',
            address_url: 'https://maps.google.com/?q=PMQ+Central',
            dates: [
              {
                id: 'part-1',
                start_datetime: '2099-12-11T10:00:00Z',
                end_datetime: '2099-12-11T11:00:00Z',
              },
            ],
            price: 9000,
            spaces_total: 8,
            spaces_left: 4,
            is_fully_booked: false,
          },
          {
            id: 'external-booking-card',
            title: 'External booking card',
            location: 'virtual',
            address: 'Virtual',
            address_url: 'https://zoom.us/',
            external_url: 'https://booking.example.com/event',
            dates: [
              {
                start_datetime: '2099-12-12T10:00:00Z',
                end_datetime: '2099-12-12T11:00:00Z',
              },
            ],
            is_fully_booked: false,
          },
        ],
      }),
    };
    mockedCreateCrmApiClient.mockReturnValue(mockApiClient);

    renderEventsSection();

    await screen.findByText('External booking card');

    expect(
      screen.getAllByRole('button', { name: enContent.events.card.ctaLabel }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('link', { name: enContent.events.card.ctaLabel }),
    ).toHaveLength(1);
  });
});
