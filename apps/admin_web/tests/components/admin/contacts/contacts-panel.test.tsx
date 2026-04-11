import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ContactsPanel } from '@/components/admin/contacts/contacts-panel';

import type { useAdminCrmContacts } from '@/hooks/use-admin-crm-contacts';

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
      <ContactsPanel contacts={contacts} tags={[]} locations={[]} geographicAreas={[]} />
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
      <ContactsPanel contacts={contacts} tags={[]} locations={[]} geographicAreas={[]} />
    );

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(loadMore).toHaveBeenCalled();
  });

  it('shows list error from the hook in the table card', () => {
    const contacts = buildContactsHook({ error: 'Failed to load contacts' });

    render(
      <ContactsPanel contacts={contacts} tags={[]} locations={[]} geographicAreas={[]} />
    );

    expect(screen.getByText('Failed to load contacts')).toBeInTheDocument();
  });
});
