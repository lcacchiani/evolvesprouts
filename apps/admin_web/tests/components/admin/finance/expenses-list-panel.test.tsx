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
  it('renders core columns without Invoice, Parse, or Operations headers', () => {
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
        onLoadMore={vi.fn()}
        onSelectExpense={vi.fn()}
        onQueryChange={vi.fn()}
        onStatusChange={vi.fn()}
        onParseStatusChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('columnheader', { name: 'Invoice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Parse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Operations' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Vendor' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Created' })).toBeInTheDocument();
  });

  it('calls onSelectExpense when a row is clicked', async () => {
    const user = userEvent.setup();
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
        onLoadMore={vi.fn()}
        onSelectExpense={onSelectExpense}
        onQueryChange={vi.fn()}
        onStatusChange={vi.fn()}
        onParseStatusChange={vi.fn()}
      />
    );

    await user.click(screen.getByText('Acme Co'));
    expect(onSelectExpense).toHaveBeenCalledWith('exp-1');
  });
});
