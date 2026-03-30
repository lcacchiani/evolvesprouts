import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const { geocodeVenueAddress } = vi.hoisted(() => ({
  geocodeVenueAddress: vi.fn(),
}));

vi.mock('@/lib/services-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services-api')>('@/lib/services-api');
  return {
    ...actual,
    geocodeVenueAddress,
  };
});

import { VenuesPanel } from '@/components/admin/services/venues-panel';

describe('VenuesPanel', () => {
  it('fills latitude and longitude when geocoding succeeds', async () => {
    const user = userEvent.setup();
    geocodeVenueAddress.mockResolvedValueOnce({
      lat: 22.3193,
      lng: 114.1694,
      displayName: 'Example, Hong Kong',
    });

    render(
      <VenuesPanel
        venues={[]}
        geographicAreas={[
          {
            id: 'area-1',
            parentId: null,
            name: 'Hong Kong',
            level: 'country',
            code: 'HK',
            active: true,
            displayOrder: 0,
          },
        ]}
        areasLoading={false}
        filters={{ areaId: '', search: '' }}
        isLoading={false}
        isLoadingMore={false}
        isSaving={false}
        hasMore={false}
        error=''
        onFilterChange={vi.fn()}
        onLoadMore={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText('Geographic area'), 'area-1');
    await user.type(screen.getByLabelText('Address'), '1 Test Road');

    await user.click(screen.getByRole('button', { name: 'Fill coordinates from address' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Latitude')).toHaveValue('22.3193');
      expect(screen.getByLabelText('Longitude')).toHaveValue('114.1694');
    });
    expect(geocodeVenueAddress).toHaveBeenCalledWith({
      area_id: 'area-1',
      address: '1 Test Road',
    });
  });
});
