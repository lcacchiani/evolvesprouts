import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ExpensesListPanel } from '@/components/admin/finance/expenses-list-panel';

import type { Expense } from '@/types/expenses';

const baseExpense: Expense = {
  id: 'exp-1',
  amendsExpenseId: null,
  status: 'submitted',
  parseStatus: 'succeeded',
  vendorName: 'Acme Co',
  invoiceNumber: 'INV-9',
  invoiceDate: null,
  dueDate: null,
  currency: 'HKD',
  subtotal: '10.00',
  tax: '0',
  total: '10.00',
  lineItems: [],
  parseConfidence: null,
  notes: null,
  voidReason: null,
  createdBy: 'u',
  updatedBy: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  submittedAt: null,
  paidAt: null,
  voidedAt: null,
  attachments: [],
};

describe('ExpensesListPanel', () => {
  it('renders operations column without Invoice or Parse headers', () => {
    render(
      <ExpensesListPanel
        expenses={[baseExpense]}
        selectedExpenseId={null}
        query=''
        status=''
        parseStatus=''
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error=''
        isDeletingExpenseId={null}
        isMarkingPaidExpenseId={null}
        onLoadMore={vi.fn()}
        onSelectExpense={vi.fn()}
        onMarkPaid={vi.fn()}
        onCancelExpense={vi.fn()}
        onQueryChange={vi.fn()}
        onStatusChange={vi.fn()}
        onParseStatusChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('columnheader', { name: 'Invoice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Parse' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Operations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark paid' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Void expense' })).toBeInTheDocument();
  });

  it('calls onMarkPaid without selecting row when mark paid is clicked', async () => {
    const user = userEvent.setup();
    const onMarkPaid = vi.fn().mockResolvedValue(undefined);
    const onSelectExpense = vi.fn();

    render(
      <ExpensesListPanel
        expenses={[baseExpense]}
        selectedExpenseId={null}
        query=''
        status=''
        parseStatus=''
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error=''
        isDeletingExpenseId={null}
        isMarkingPaidExpenseId={null}
        onLoadMore={vi.fn()}
        onSelectExpense={onSelectExpense}
        onMarkPaid={onMarkPaid}
        onCancelExpense={vi.fn()}
        onQueryChange={vi.fn()}
        onStatusChange={vi.fn()}
        onParseStatusChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Mark paid' }));
    expect(onMarkPaid).toHaveBeenCalledWith('exp-1');
    expect(onSelectExpense).not.toHaveBeenCalled();
  });
});
