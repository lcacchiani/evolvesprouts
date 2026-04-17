import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseExpenses, expensesState, mockUseVendors, vendorsState, mockListAllAdminExpenses } = vi.hoisted(() => {
  const state = {
    items: [],
    filters: { query: '', status: '', parseStatus: '' },
    setFilter: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    error: '',
    refetch: vi.fn(),
    loadMore: vi.fn(),
    hasMore: false,
    totalCount: 0,
    selectedExpenseId: null as string | null,
    selectedExpense: null,
    isSaving: false,
    isUploadingFiles: false,
    isDeletingId: null as string | null,
    isMarkingPaidId: null as string | null,
    isReparsingId: null as string | null,
    mutationError: '',
    selectExpense: vi.fn(),
    clearSelectedExpense: vi.fn(),
    clearMutationError: vi.fn(),
    createExpenseEntry: vi.fn(),
    updateExpenseEntry: vi.fn(),
    amendExpenseEntry: vi.fn(),
    cancelExpenseEntry: vi.fn(),
    markPaidExpenseEntry: vi.fn(),
    reparseExpenseEntry: vi.fn(),
  };
  const vendorsState = {
    vendors: [],
    filters: { query: '', active: '' },
    setFilter: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    isSaving: false,
    hasMore: false,
    error: '',
    loadMore: vi.fn(),
    totalCount: 0,
    createVendor: vi.fn(),
    updateVendor: vi.fn(),
    refetch: vi.fn(),
  };
  return {
    expensesState: state,
    mockUseExpenses: vi.fn(() => state),
    vendorsState,
    mockUseVendors: vi.fn(() => vendorsState),
    mockListAllAdminExpenses: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('@/hooks/use-expenses', () => ({
  useExpenses: mockUseExpenses,
}));
vi.mock('@/hooks/use-vendors', () => ({
  useVendors: mockUseVendors,
}));

vi.mock('@/lib/expenses-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/expenses-api')>('@/lib/expenses-api');
  return {
    ...actual,
    listAllAdminExpenses: mockListAllAdminExpenses,
  };
});

import { FinancePage } from '@/components/admin/finance/finance-page';

describe('FinancePage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/finance');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/finance');
  });

  it('renders finance tabs and switches to scaffold tab', async () => {
    const user = userEvent.setup();
    render(<FinancePage />);

    expect(screen.getByRole('button', { name: 'Expenses' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vendors' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Client Invoices' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Expense Details' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Vendors' }));
    expect(screen.getByRole('heading', { name: 'Vendors' })).toBeInTheDocument();
    expect(mockListAllAdminExpenses).toHaveBeenCalled();
    expect(window.location.search).toBe('?tab=vendors');

    await user.click(screen.getByRole('button', { name: 'Client Invoices' }));
    expect(screen.getByRole('heading', { name: 'Client Invoices' })).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=client-invoices');

    await user.click(screen.getByRole('button', { name: 'Expenses' }));
    expect(window.location.search).toBe('');
  });

  it('seeds the active tab from the URL query parameter on mount', async () => {
    window.history.replaceState(null, '', '/finance?tab=client-invoices');
    render(<FinancePage />);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Client Invoices' })
      ).toBeInTheDocument();
    });
  });

  it('renders expense editor before submitted expenses list', () => {
    render(<FinancePage />);

    const editorHeading = screen.getByRole('heading', { name: 'Expense Details' });
    const listHeading = screen.getByRole('heading', { name: 'Submitted Expenses' });

    expect(editorHeading.compareDocumentPosition(listHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses expense hook state', () => {
    render(<FinancePage />);
    expect(mockUseExpenses).toHaveBeenCalled();
    expect(mockUseVendors).toHaveBeenCalled();
    expect(expensesState.items).toEqual([]);
    expect(vendorsState.vendors).toEqual([]);
  });

  it('renders expense currency as a dropdown', () => {
    render(<FinancePage />);
    const currencyField = screen.getByLabelText('Currency');
    expect(currencyField.tagName).toBe('SELECT');
  });
});
