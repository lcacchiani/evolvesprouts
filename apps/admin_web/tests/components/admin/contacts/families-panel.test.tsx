import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FamiliesPanel } from '@/components/admin/contacts/families-panel';

import type { useAdminCrmFamilies } from '@/hooks/use-admin-crm-families';

function buildFamiliesHook(
  overrides: Partial<ReturnType<typeof useAdminCrmFamilies>> = {}
): ReturnType<typeof useAdminCrmFamilies> {
  return {
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
    createFamily: vi.fn().mockResolvedValue(null),
    updateFamily: vi.fn().mockResolvedValue(null),
    addMember: vi.fn().mockResolvedValue(null),
    removeMember: vi.fn().mockResolvedValue(null),
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('FamiliesPanel', () => {
  it('creates a family with non-vendor relationship default', async () => {
    const user = userEvent.setup();
    const createFamily = vi.fn().mockResolvedValue(null);
    const families = buildFamiliesHook({ createFamily });

    render(
      <FamiliesPanel families={families} tags={[]} locations={[]} contactOptions={[]} />
    );

    await user.type(screen.getByLabelText('Family name'), 'The Smiths');
    await user.click(screen.getByRole('button', { name: 'Create family' }));

    expect(createFamily).toHaveBeenCalledWith(
      expect.objectContaining({
        family_name: 'The Smiths',
        relationship_type: 'prospect',
      })
    );
  });

  it('invokes loadMore when pagination allows', async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn().mockResolvedValue(undefined);
    const families = buildFamiliesHook({ hasMore: true, loadMore });

    render(
      <FamiliesPanel families={families} tags={[]} locations={[]} contactOptions={[]} />
    );

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(loadMore).toHaveBeenCalled();
  });
});
