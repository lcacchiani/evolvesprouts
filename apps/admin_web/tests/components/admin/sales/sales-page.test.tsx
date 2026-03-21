import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const { mockUseSalesPage, state } = vi.hoisted(() => {
  const state = {
    activeView: 'pipeline' as const,
    setActiveView: vi.fn(),
    selectedLeadId: null as string | null,
    setSelectedLeadId: vi.fn(),
    selectedLead: null,
    isCreateDialogOpen: false,
    openCreateDialog: vi.fn(),
    closeCreateDialog: vi.fn(),
    adminUsers: {
      users: [],
      isLoading: false,
      error: '',
      refetch: vi.fn().mockResolvedValue(undefined),
    },
    leadList: {
      leads: [],
      filters: {
        stage: [],
        source: [],
        leadType: [],
        assignedTo: null,
        unassigned: false,
        dateFrom: null,
        dateTo: null,
        search: '',
        sort: 'created_at',
        sortDir: 'desc',
      },
      setFilter: vi.fn(),
      clearFilters: vi.fn(),
      isLoading: false,
      isLoadingMore: false,
      error: '',
      refetch: vi.fn().mockResolvedValue(undefined),
      loadMore: vi.fn().mockResolvedValue(undefined),
      hasMore: false,
      totalCount: 0,
    },
    leadDetail: {
      lead: null,
      events: [],
      notes: [],
      isLoading: false,
      error: '',
      refetch: vi.fn().mockResolvedValue(undefined),
    },
    leadAnalytics: {
      analytics: null,
      dateRange: { dateFrom: null, dateTo: null },
      setDateRange: vi.fn(),
      isLoading: false,
      error: '',
      refetch: vi.fn().mockResolvedValue(undefined),
    },
    mutations: {
      isLoading: false,
      error: '',
      createLeadEntry: vi.fn().mockResolvedValue(null),
      updateStage: vi.fn().mockResolvedValue(null),
      assignLead: vi.fn().mockResolvedValue(null),
      addNote: vi.fn().mockResolvedValue(undefined),
    },
  };
  return {
    state,
    mockUseSalesPage: vi.fn(() => state),
  };
});

vi.mock('@/hooks/use-sales-page', () => ({
  useSalesPage: mockUseSalesPage,
}));

import { SalesPage } from '@/components/admin/sales/sales-page';

describe('SalesPage', () => {
  it('renders tabs and triggers view switch', async () => {
    const user = userEvent.setup();
    render(<SalesPage />);

    expect(screen.getByRole('tab', { name: 'Pipeline' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Analytics' }));
    expect(state.setActiveView).toHaveBeenCalledWith('analytics');
  });

  it('opens create-lead dialog action', async () => {
    const user = userEvent.setup();
    render(<SalesPage />);

    await user.click(screen.getAllByRole('button', { name: 'New lead' })[0]);
    expect(state.openCreateDialog).toHaveBeenCalledTimes(1);
  });
});
