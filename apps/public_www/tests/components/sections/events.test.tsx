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
    render(<Events content={enContent.events} />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: enContent.events.title,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(enContent.events.eyebrow)).not.toBeInTheDocument();
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

  it('renders only upcoming and past options in the filter dropdown', () => {
    render(<Events content={enContent.events} />);

    const filter = screen.getByLabelText(enContent.events.sortAriaLabel);
    const optionElements = Array.from(filter.querySelectorAll('option'));
    expect(optionElements).toHaveLength(2);
    expect(optionElements.map((option) => option.value)).toEqual([
      'upcoming',
      'past',
    ]);
    expect(optionElements.map((option) => option.textContent)).toEqual(
      enContent.events.sortOptions.map((option) => option.label),
    );
  });
});
