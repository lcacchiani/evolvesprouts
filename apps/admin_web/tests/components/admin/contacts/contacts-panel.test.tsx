import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

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

import { ContactsPanel } from '@/components/admin/contacts/contacts-panel';

import type { useAdminEntityContacts } from '@/hooks/use-admin-entity-contacts';
import type { components } from '@/types/generated/admin-api.generated';

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

vi.mock('@/lib/entity-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/entity-api')>();
  return {
    ...actual,
    listEntityFamilyPicker: vi.fn().mockResolvedValue([]),
    listEntityOrganizationPicker: vi.fn().mockResolvedValue([]),
  };
});

const noopRefresh = vi.fn().mockResolvedValue(undefined);

function buildContactsHook(
  overrides: Partial<ReturnType<typeof useAdminEntityContacts>> = {}
): ReturnType<typeof useAdminEntityContacts> {
  return {
    contacts: [],
    filters: { query: '', active: 'true' as const, contact_type: '' as const },
    setFilter: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    error: '',
    loadMore: vi.fn(),
    totalCount: 0,
    isSaving: false,
    createContact: vi.fn().mockResolvedValue(null),
    updateContact: vi.fn().mockResolvedValue(null),
    deleteContact: vi.fn().mockResolvedValue(undefined),
    patchContactStandaloneNoteCount: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

const hkArea = {
  id: 'area-hk',
  parentId: null,
  name: 'Hong Kong',
  level: 'country' as const,
  code: 'HK',
  sovereignCountryId: null,
  active: true,
  displayOrder: 0,
};

describe('ContactsPanel', () => {
  it('submits create with relationship types that exclude vendor', async () => {
    const user = userEvent.setup();
    const createContact = vi.fn().mockResolvedValue(null);
    const contacts = buildContactsHook({ createContact });

    render(
      <ContactsPanel
        contacts={contacts}
        adminUsers={[]}
        onPatchStandaloneNoteCount={vi.fn()}
        tags={[]}
        locations={[]}
        geographicAreas={[]}
        areasLoading={false}
        refreshLocations={noopRefresh}
      />
    );

    await user.type(screen.getByLabelText('First name'), 'Jane');
    await user.click(screen.getByRole('button', { name: 'Create contact' }));

    expect(createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Jane',
        relationship_type: 'prospect',
        contact_type: 'parent',
      })
    );
  });

  it('loads the next page when Load more is available', async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn().mockResolvedValue(undefined);
    const contacts = buildContactsHook({ hasMore: true, loadMore });

    render(
      <ContactsPanel
        contacts={contacts}
        adminUsers={[]}
        onPatchStandaloneNoteCount={vi.fn()}
        tags={[]}
        locations={[]}
        geographicAreas={[]}
        areasLoading={false}
        refreshLocations={noopRefresh}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(loadMore).toHaveBeenCalled();
  });

  it('calls deleteContact when Delete is confirmed', async () => {
    const user = userEvent.setup();
    const deleteContact = vi.fn().mockResolvedValue(undefined);
    const row: components['schemas']['AdminContact'] = {
      id: '11111111-1111-1111-1111-111111111111',
      first_name: 'Ann',
      last_name: 'Lee',
      email: null,
      instagram_handle: null,
      phone: null,
      contact_type: 'parent',
      relationship_type: 'prospect',
      source: 'manual',
      mailchimp_status: 'pending',
      active: true,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
      tag_ids: [],
      tags: [],
      family_ids: [],
      organization_ids: [],
      standalone_note_count: 0,
    };
    const contacts = buildContactsHook({
      deleteContact,
      contacts: [row],
    });

    render(
      <ContactsPanel
        contacts={contacts}
        adminUsers={[]}
        onPatchStandaloneNoteCount={vi.fn()}
        tags={[]}
        locations={[]}
        geographicAreas={[]}
        areasLoading={false}
        refreshLocations={noopRefresh}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Delete contact' }));

    expect(deleteContact).toHaveBeenCalledWith(row.id);
  });

  it('shows list error from the hook in the table card', async () => {
    const contacts = buildContactsHook({ error: 'Failed to load contacts' });

    render(
      <ContactsPanel
        contacts={contacts}
        adminUsers={[]}
        onPatchStandaloneNoteCount={vi.fn()}
        tags={[]}
        locations={[]}
        geographicAreas={[]}
        areasLoading={false}
        refreshLocations={noopRefresh}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load contacts')).toBeInTheDocument();
    });
  });

  it('shows read-only location summary when contact is linked to family', async () => {
    const user = userEvent.setup();
    const row: components['schemas']['AdminContact'] = {
      id: '11111111-1111-1111-1111-111111111111',
      first_name: 'Ann',
      last_name: 'Lee',
      email: null,
      instagram_handle: null,
      phone: null,
      contact_type: 'parent',
      relationship_type: 'prospect',
      source: 'manual',
      mailchimp_status: 'pending',
      active: true,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
      tag_ids: [],
      tags: [],
      family_ids: ['fam-1'],
      organization_ids: [],
      location_id: 'loc-1',
      location_summary: {
        id: 'loc-1',
        name: 'Studio',
        area_id: 'area-hk',
        area_name: 'Hong Kong',
        address: '1 Road',
        lat: 22.1,
        lng: 114.2,
      },
      standalone_note_count: 0,
    };
    const contacts = buildContactsHook({ contacts: [row] });

    render(
      <ContactsPanel
        contacts={contacts}
        adminUsers={[]}
        onPatchStandaloneNoteCount={vi.fn()}
        tags={[]}
        locations={[]}
        geographicAreas={[hkArea]}
        areasLoading={false}
        refreshLocations={noopRefresh}
      />
    );

    await user.click(screen.getByText('Ann Lee'));

    expect(screen.getByText('1 Road · Hong Kong')).toBeInTheDocument();
    expect(screen.getByText('22.10000, 114.20000')).toBeInTheDocument();
    expect(
      screen.getByText('Location is managed on the linked family or organisation.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('includes location_id on create after inline Save location', async () => {
    const user = userEvent.setup();
    const createContact = vi.fn().mockResolvedValue(null);
    const contacts = buildContactsHook({ createContact });

    createLocation.mockResolvedValue({
      id: 'loc-new',
      name: null,
      areaId: 'area-hk',
      address: '1 Test Road',
      lat: 22.3193,
      lng: 114.1694,
      createdAt: null,
      updatedAt: null,
      lockedFromPartnerOrg: false,
      partnerOrganizationLabels: [],
    });
    geocodeVenueAddress.mockResolvedValue({
      lat: 22.3193,
      lng: 114.1694,
      displayName: null,
    });

    render(
      <ContactsPanel
        contacts={contacts}
        adminUsers={[]}
        onPatchStandaloneNoteCount={vi.fn()}
        tags={[]}
        locations={[]}
        geographicAreas={[hkArea]}
        areasLoading={false}
        refreshLocations={noopRefresh}
      />
    );

    await user.type(screen.getByLabelText('First name'), 'Jane');
    await user.selectOptions(screen.getByLabelText('Geographic area'), 'area-hk');
    await user.type(screen.getByLabelText('Address'), '1 Test Road');
    await user.click(screen.getByRole('button', { name: 'Fill coordinates from address' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Latitude')).toHaveValue('22.3193');
    });

    await user.click(screen.getByRole('button', { name: 'Save location' }));

    await waitFor(() => {
      expect(createLocation).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: 'Create contact' }));

    expect(createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Jane',
        location_id: 'loc-new',
      })
    );
  });

  it('sends location_id null on update after Clear', async () => {
    const user = userEvent.setup();
    const updateContact = vi.fn().mockResolvedValue(null);
    const row: components['schemas']['AdminContact'] = {
      id: '22222222-2222-2222-2222-222222222222',
      first_name: 'Bob',
      last_name: null,
      email: null,
      instagram_handle: null,
      phone: null,
      contact_type: 'parent',
      relationship_type: 'prospect',
      source: 'manual',
      mailchimp_status: 'pending',
      active: true,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
      tag_ids: [],
      tags: [],
      family_ids: [],
      organization_ids: [],
      location_id: 'loc-1',
      location_summary: null,
      standalone_note_count: 0,
    };
    const contacts = buildContactsHook({
      updateContact,
      contacts: [row],
    });

    render(
      <ContactsPanel
        contacts={contacts}
        adminUsers={[]}
        onPatchStandaloneNoteCount={vi.fn()}
        tags={[]}
        locations={[
          {
            id: 'loc-1',
            name: null,
            areaId: 'area-hk',
            address: 'X',
            lat: null,
            lng: null,
            createdAt: null,
            updatedAt: null,
            lockedFromPartnerOrg: false,
            partnerOrganizationLabels: [],
          },
        ]}
        geographicAreas={[hkArea]}
        areasLoading={false}
        refreshLocations={noopRefresh}
      />
    );

    await user.click(screen.getByText('Bob'));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('button', { name: 'Update contact' }));

    expect(updateContact).toHaveBeenCalledWith(
      row.id,
      expect.objectContaining({
        location_id: null,
      })
    );
    expect(updateLocationPartial).not.toHaveBeenCalled();
  });
});
