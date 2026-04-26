import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createLocation, geocodeVenueAddress, updateLocationPartial } = vi.hoisted(() => ({
  createLocation: vi.fn(),
  geocodeVenueAddress: vi.fn(),
  updateLocationPartial: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/services-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services-api')>('@/lib/services-api');
  return {
    ...actual,
    createLocation,
    geocodeVenueAddress,
    updateLocationPartial,
  };
});

import { PartnersPanel } from '@/components/admin/services/partners-panel';

import type { usePartners } from '@/hooks/use-partners';
import type { components } from '@/types/generated/admin-api.generated';

const noopRefresh = vi.fn().mockResolvedValue(undefined);

const panelShell = {
  tags: [] as components['schemas']['EntityTagRef'][],
  locations: [],
  geographicAreas: [],
  areasLoading: false,
  refreshLocations: noopRefresh,
  tagsLoadError: '',
};

function buildPartnersHook(
  overrides: Partial<ReturnType<typeof usePartners>> = {}
): ReturnType<typeof usePartners> {
  return {
    partners: [],
    filters: { query: '', active: '' },
    setFilter: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    error: '',
    loadMore: vi.fn(),
    totalCount: 0,
    isSaving: false,
    createPartner: vi.fn().mockResolvedValue(null),
    updatePartner: vi.fn().mockResolvedValue(null),
    addMember: vi.fn().mockResolvedValue(null),
    removeMember: vi.fn().mockResolvedValue(null),
    updateMember: vi.fn().mockResolvedValue(null),
    deletePartner: vi.fn().mockResolvedValue(undefined),
    refetch: vi.fn(),
    relationshipOptions: ['partner'],
    ...overrides,
  };
}

vi.mock('@/hooks/use-confirm-dialog', () => ({
  useConfirmDialog: () => [
    {
      open: false,
      title: '',
      description: '',
      onConfirm: () => {},
      onCancel: () => {},
    },
    () => Promise.resolve(true),
  ],
}));

describe('PartnersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always shows slug field and creates with relationship_type partner', async () => {
    const user = userEvent.setup();
    const createPartner = vi.fn().mockResolvedValue(null);
    const partners = buildPartnersHook({ createPartner });

    render(<PartnersPanel partners={partners} {...panelShell} />);

    expect(screen.getByLabelText('Slug')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Gamma');
    await user.type(screen.getByLabelText('Slug'), 'gamma-slug');
    await user.click(screen.getByRole('button', { name: 'Create partner' }));

    expect(createPartner).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Gamma',
        relationship_type: 'partner',
        slug: 'gamma-slug',
      })
    );
  });

  it('toolbar filters call setFilter', async () => {
    const user = userEvent.setup();
    const setFilter = vi.fn();
    const partners = buildPartnersHook({ setFilter });

    render(<PartnersPanel partners={partners} {...panelShell} />);

    const search = screen.getByLabelText('Search');
    await user.type(search, 'x');
    expect(setFilter).toHaveBeenCalled();
  });

  it('sorts table rows by name A→Z (case- and accent-insensitive) over the loaded set', () => {
    const baseRow = {
      organization_type: 'company' as const,
      relationship_type: 'partner' as const,
      slug: null,
      website: null,
      location_id: null,
      location_summary: null,
      tag_ids: [] as string[],
      tags: [],
      members: [],
      active: true,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
    };
    const rows: components['schemas']['AdminOrganization'][] = [
      { id: 'b', name: 'Beta Co', ...baseRow },
      { id: 'a', name: 'alpha llc', ...baseRow },
      { id: 'g', name: 'Gamma Org', ...baseRow },
    ];
    const partners = buildPartnersHook({ partners: rows });

    render(<PartnersPanel partners={partners} {...panelShell} />);

    const table = screen.getByRole('table');
    const tableRows = within(table).getAllByRole('row');
    const dataRows = tableRows.slice(1);
    expect(dataRows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual([
      'alpha llc',
      'Beta Co',
      'Gamma Org',
    ]);
  });

  it('edits partner and updates with relationship_type partner', async () => {
    const user = userEvent.setup();
    const updatePartner = vi.fn().mockResolvedValue(null);
    const row: components['schemas']['AdminOrganization'] = {
      id: 'p-row',
      name: 'Row Partner',
      organization_type: 'school',
      relationship_type: 'partner',
      slug: 'row-slug',
      website: 'https://example.com',
      location_id: null,
      location_summary: null,
      tag_ids: [],
      tags: [],
      members: [],
      active: true,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
    };
    const partners = buildPartnersHook({
      partners: [row],
      updatePartner,
    });

    render(<PartnersPanel partners={partners} {...panelShell} />);

    await user.click(screen.getByText('Row Partner'));
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Row Partner Renamed');
    await user.click(screen.getByRole('button', { name: 'Update partner' }));

    expect(updatePartner).toHaveBeenCalledWith(
      'p-row',
      expect.objectContaining({
        name: 'Row Partner Renamed',
        relationship_type: 'partner',
        slug: 'row-slug',
      })
    );
  });

  it('deletes partner after confirmation from table', async () => {
    const user = userEvent.setup();
    const deletePartner = vi.fn().mockResolvedValue(undefined);
    const row: components['schemas']['AdminOrganization'] = {
      id: 'p-del',
      name: 'Del Partner',
      organization_type: 'company',
      relationship_type: 'partner',
      slug: 'del',
      website: null,
      location_id: null,
      location_summary: null,
      tag_ids: [],
      tags: [],
      members: [],
      active: true,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
    };
    const partners = buildPartnersHook({
      deletePartner,
      partners: [row],
    });

    render(<PartnersPanel partners={partners} {...panelShell} />);

    const table = screen.getByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Delete partner' }));

    await waitFor(() => {
      expect(deletePartner).toHaveBeenCalledWith('p-del');
    });
  });
});
