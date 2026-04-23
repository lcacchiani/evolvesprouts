import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createLocation, geocodeVenueAddress, updateLocationPartial } = vi.hoisted(() => ({
  createLocation: vi.fn(),
  geocodeVenueAddress: vi.fn(),
  updateLocationPartial: vi.fn().mockResolvedValue(null),
}));

const { mockSearchEntityContactsForPicker, mockGetAdminContact } = vi.hoisted(() => ({
  mockSearchEntityContactsForPicker: vi.fn(),
  mockGetAdminContact: vi.fn(),
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

vi.mock('@/lib/entity-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/entity-api')>();
  return {
    ...actual,
    searchEntityContactsForPicker: mockSearchEntityContactsForPicker,
    getAdminContact: mockGetAdminContact,
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
    mockSearchEntityContactsForPicker.mockResolvedValue([]);
    mockGetAdminContact.mockResolvedValue(null);
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

  it('searches contacts and adds a member', async () => {
    const user = userEvent.setup();
    mockSearchEntityContactsForPicker.mockResolvedValue([{ id: 'c-new', label: 'New Person' }]);
    mockGetAdminContact.mockResolvedValue({
      id: 'c-new',
      first_name: 'New',
      last_name: 'Person',
      email: null,
      contact_type: 'parent',
      relationship_type: 'prospect',
      source: 'manual',
      source_detail: null,
      instagram_handle: null,
      phone_region: 'HK',
      phone_national_number: null,
      date_of_birth: null,
      family_ids: [],
      organization_ids: [],
      tag_ids: [],
      tags: [],
      active: true,
      standalone_note_count: 0,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
    });

    const addMember = vi.fn().mockResolvedValue(null);
    const row: components['schemas']['AdminOrganization'] = {
      id: 'p-mem',
      name: 'Mem Partner',
      organization_type: 'company',
      relationship_type: 'partner',
      slug: 'mem',
      website: null,
      location_id: null,
      location_summary: null,
      tag_ids: [],
      tags: [],
      members: [
        {
          id: 'm1',
          contact_id: 'c-old',
          contact_label: 'Old Contact',
          role: 'member',
          is_primary_contact: false,
        },
      ],
      active: true,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
    };
    const partners = buildPartnersHook({
      partners: [row],
      addMember,
      removeMember: vi.fn().mockResolvedValue(null),
    });

    render(<PartnersPanel partners={partners} {...panelShell} />);

    await user.click(screen.getByText('Mem Partner'));
    await user.type(screen.getByLabelText('Find contact'), 'ne');

    await waitFor(() => {
      expect(mockSearchEntityContactsForPicker).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'New Person' })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Contact'), 'c-new');
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    expect(addMember).toHaveBeenCalledWith('p-mem', {
      contact_id: 'c-new',
      is_primary_contact: false,
    });
  });

  it('removes a member after confirmation', async () => {
    const user = userEvent.setup();
    const removeMember = vi.fn().mockResolvedValue(null);
    const row: components['schemas']['AdminOrganization'] = {
      id: 'p-mem',
      name: 'Mem Partner',
      organization_type: 'company',
      relationship_type: 'partner',
      slug: 'mem',
      website: null,
      location_id: null,
      location_summary: null,
      tag_ids: [],
      tags: [],
      members: [
        {
          id: 'm1',
          contact_id: 'c-old',
          contact_label: 'Old Contact',
          role: 'member',
          is_primary_contact: false,
        },
      ],
      active: true,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
    };
    const partners = buildPartnersHook({
      partners: [row],
      removeMember,
    });

    render(<PartnersPanel partners={partners} {...panelShell} />);

    await user.click(screen.getByText('Mem Partner'));
    await user.click(screen.getByRole('button', { name: 'Remove Old Contact from partner' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(removeMember).toHaveBeenCalledWith('p-mem', 'm1');
    });
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
