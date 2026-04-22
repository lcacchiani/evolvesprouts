import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContactsPage } from '@/components/admin/contacts/contacts-page';

const listCrmTags = vi.fn();
const listAllLocations = vi.fn();
const listGeographicAreas = vi.fn();

vi.mock('@/lib/crm-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crm-api')>();
  return {
    ...actual,
    listCrmTags: (...args: unknown[]) => listCrmTags(...args),
  };
});

vi.mock('@/lib/services-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services-api')>();
  return {
    ...actual,
    listAllLocations: (...args: unknown[]) => listAllLocations(...args),
    listGeographicAreas: (...args: unknown[]) => listGeographicAreas(...args),
  };
});

const defaultContactsHook = {
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
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  patchContactStandaloneNoteCount: vi.fn(),
  refetch: vi.fn(),
};

const defaultFamiliesHook = {
  families: [],
  filters: { query: '', active: '' as const },
  setFilter: vi.fn(),
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  error: '',
  loadMore: vi.fn(),
  totalCount: 0,
  isSaving: false,
  createFamily: vi.fn(),
  updateFamily: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  refetch: vi.fn(),
};

const defaultOrgsHook = {
  organizations: [],
  filters: { query: '', active: '' as const },
  setFilter: vi.fn(),
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  error: '',
  loadMore: vi.fn(),
  totalCount: 0,
  isSaving: false,
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  refetch: vi.fn(),
  relationshipOptions: ['prospect', 'client', 'partner', 'other'] as const,
};

vi.mock('@/hooks/use-admin-crm-contacts', () => ({
  useAdminCrmContacts: () => defaultContactsHook,
}));

vi.mock('@/hooks/use-admin-crm-families', () => ({
  useAdminCrmFamilies: () => defaultFamiliesHook,
}));

vi.mock('@/hooks/use-admin-crm-organizations', () => ({
  useAdminCrmOrganizations: () => defaultOrgsHook,
}));

vi.mock('@/hooks/use-admin-users', () => ({
  useAdminUsers: () => ({ users: [], isLoading: false, error: '', refetch: vi.fn() }),
}));

describe('ContactsPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/contacts');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/contacts');
  });

  it('loads tags and locations on mount', async () => {
    listCrmTags.mockResolvedValue([]);
    listAllLocations.mockResolvedValue([]);
    listGeographicAreas.mockResolvedValue([]);

    render(<ContactsPage />);

    await waitFor(() => {
      expect(listCrmTags).toHaveBeenCalled();
    });
    expect(listAllLocations).toHaveBeenCalled();
    expect(listGeographicAreas).toHaveBeenCalled();
  });

  it('switches sub-views with the tab strip', async () => {
    const user = userEvent.setup();
    listCrmTags.mockResolvedValue([]);
    listAllLocations.mockResolvedValue([]);
    listGeographicAreas.mockResolvedValue([]);

    render(<ContactsPage />);

    await waitFor(() => {
      expect(listCrmTags).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: 'Families' }));
    expect(screen.getByRole('heading', { name: 'Families' })).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=families');

    await user.click(screen.getByRole('button', { name: 'Organisations' }));
    expect(screen.getByRole('heading', { name: 'Organisations' })).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=organizations');

    await user.click(screen.getByRole('button', { name: 'Contacts' }));
    expect(window.location.search).toBe('');
  });

  it('seeds the active sub-view from the URL query parameter on mount', async () => {
    listCrmTags.mockResolvedValue([]);
    listAllLocations.mockResolvedValue([]);
    listGeographicAreas.mockResolvedValue([]);

    window.history.replaceState(null, '', '/contacts?tab=organizations');
    render(<ContactsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Organisations' })
      ).toBeInTheDocument();
    });
  });
});
