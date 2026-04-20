import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ContactsPanel } from '@/components/admin/contacts/contacts-panel';

import type { useAdminCrmContacts } from '@/hooks/use-admin-crm-contacts';
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

vi.mock('@/lib/crm-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crm-api')>();
  return {
    ...actual,
    listCrmFamilyPicker: vi.fn().mockResolvedValue([]),
    listCrmOrganizationPicker: vi.fn().mockResolvedValue([]),
  };
});

function buildContactsHook(
  overrides: Partial<ReturnType<typeof useAdminCrmContacts>> = {}
): ReturnType<typeof useAdminCrmContacts> {
  return {
    contacts: [],
    filters: { query: '', active: '' as const },
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
      />
    );

    await user.click(screen.getByRole('button', { name: 'Delete contact' }));

    expect(deleteContact).toHaveBeenCalledWith(row.id);
  });

  it('shows list error from the hook in the table card', () => {
    const contacts = buildContactsHook({ error: 'Failed to load contacts' });

    render(
      <ContactsPanel
        contacts={contacts}
        adminUsers={[]}
        onPatchStandaloneNoteCount={vi.fn()}
        tags={[]}
        locations={[]}
        geographicAreas={[]}
      />
    );

    expect(screen.getByText('Failed to load contacts')).toBeInTheDocument();
  });
});
