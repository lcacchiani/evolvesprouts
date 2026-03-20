'use client';

import { useState } from 'react';

import { Card } from '@/components/ui/card';
import { useExpenses } from '@/hooks/use-expenses';

import { ExpensesEditorPanel } from './expenses-editor-panel';
import { ExpensesListPanel } from './expenses-list-panel';
import { FinanceHeader, type FinanceView } from './finance-header';

export function FinancePage() {
  const [activeView, setActiveView] = useState<FinanceView>('expenses');
  const expenses = useExpenses();

  if (activeView === 'client-invoices') {
    return (
      <div className='space-y-6'>
        <FinanceHeader activeView={activeView} onSetView={setActiveView} />
        <Card
          title='Client invoices'
          description='Scaffold ready'
          className='space-y-2'
        >
          <p className='text-sm text-slate-600'>
            Client invoice management is intentionally scaffolded in this iteration.
            Expense ingestion, parsing, verification, amendment, and history are fully
            available in the Expenses tab.
          </p>
        </Card>
      </div>
    );
  }

  const isSelectedDeleting = Boolean(expenses.selectedExpenseId) && expenses.isDeletingId === expenses.selectedExpenseId;
  const isSelectedMarkingPaid =
    Boolean(expenses.selectedExpenseId) && expenses.isMarkingPaidId === expenses.selectedExpenseId;
  const isSelectedReparsing =
    Boolean(expenses.selectedExpenseId) && expenses.isReparsingId === expenses.selectedExpenseId;

  return (
    <div className='space-y-6'>
      <FinanceHeader activeView={activeView} onSetView={setActiveView} />
      <ExpensesEditorPanel
        key={expenses.selectedExpense?.id ?? 'new-expense'}
        selectedExpense={expenses.selectedExpense}
        isSaving={expenses.isSaving}
        isUploadingFiles={expenses.isUploadingFiles}
        isDeletingCurrentExpense={isSelectedDeleting}
        isMarkingCurrentExpensePaid={isSelectedMarkingPaid}
        isReparsingCurrentExpense={isSelectedReparsing}
        mutationError={expenses.mutationError}
        onCreate={expenses.createExpenseEntry}
        onUpdate={expenses.updateExpenseEntry}
        onAmend={expenses.amendExpenseEntry}
        onCancelExpense={expenses.cancelExpenseEntry}
        onMarkPaid={expenses.markPaidExpenseEntry}
        onReparse={expenses.reparseExpenseEntry}
        onStartCreate={expenses.clearSelectedExpense}
      />
      <ExpensesListPanel
        expenses={expenses.items}
        selectedExpenseId={expenses.selectedExpenseId}
        query={expenses.filters.query}
        status={expenses.filters.status}
        parseStatus={expenses.filters.parseStatus}
        isLoading={expenses.isLoading}
        isLoadingMore={expenses.isLoadingMore}
        hasMore={expenses.hasMore}
        error={expenses.error}
        isDeletingExpenseId={expenses.isDeletingId}
        isMarkingPaidExpenseId={expenses.isMarkingPaidId}
        onLoadMore={expenses.loadMore}
        onSelectExpense={expenses.selectExpense}
        onMarkPaid={expenses.markPaidExpenseEntry}
        onCancelExpense={expenses.cancelExpenseEntry}
        onQueryChange={(value) => expenses.setFilter('query', value)}
        onStatusChange={(value) => expenses.setFilter('status', value)}
        onParseStatusChange={(value) => expenses.setFilter('parseStatus', value)}
        onClearFilters={expenses.clearFilters}
      />
    </div>
  );
}
