import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const { mockUseExpenses, state } = vi.hoisted(() => {
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
  return {
    state,
    mockUseExpenses: vi.fn(() => state),
  };
});

vi.mock('@/hooks/use-expenses', () => ({
  useExpenses: mockUseExpenses,
}));

import { FinancePage } from '@/components/admin/finance/finance-page';

describe('FinancePage', () => {
  it('renders finance tabs and switches to scaffold tab', async () => {
    const user = userEvent.setup();
    render(<FinancePage />);

    expect(screen.getByRole('button', { name: 'Expenses' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Client invoices' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Expenses' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Client invoices' }));
    expect(screen.getByRole('heading', { name: 'Client invoices' })).toBeInTheDocument();
  });

  it('renders expense editor before submitted expenses list', () => {
    render(<FinancePage />);

    const editorHeading = screen.getByRole('heading', { name: 'Expenses' });
    const listHeading = screen.getByRole('heading', { name: 'Submitted Expenses' });

    expect(editorHeading.compareDocumentPosition(listHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses expense hook state', () => {
    render(<FinancePage />);
    expect(mockUseExpenses).toHaveBeenCalledTimes(1);
    expect(state.items).toEqual([]);
  });

  it('renders expense currency as a dropdown', () => {
    render(<FinancePage />);
    const currencyField = screen.getByLabelText('Currency');
    expect(currencyField.tagName).toBe('SELECT');
  });
});
