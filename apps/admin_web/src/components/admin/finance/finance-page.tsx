'use client';

import { useState } from 'react';

import { Card } from '@/components/ui/card';
import { useExpenses } from '@/hooks/use-expenses';
import { useVendors } from '@/hooks/use-vendors';

import { ExpensesEditorPanel } from './expenses-editor-panel';
import { ExpensesListPanel } from './expenses-list-panel';
import { FinanceHeader, type FinanceView } from './finance-header';
import { VendorsPanel } from './vendors-panel';

export function FinancePage() {
  const [activeView, setActiveView] = useState<FinanceView>('expenses');
  const expenses = useExpenses();
  const vendors = useVendors();

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

  if (activeView === 'vendors') {
    return (
      <div className='space-y-6'>
        <FinanceHeader activeView={activeView} onSetView={setActiveView} />
        <VendorsPanel
          vendors={vendors.vendors}
          filters={vendors.filters}
          isLoading={vendors.isLoading}
          isLoadingMore={vendors.isLoadingMore}
          isSaving={vendors.isSaving}
          hasMore={vendors.hasMore}
          error={vendors.error}
          onFilterChange={vendors.setFilter}
          onLoadMore={vendors.loadMore}
          onCreate={vendors.createVendor}
          onUpdate={vendors.updateVendor}
        />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <FinanceHeader activeView={activeView} onSetView={setActiveView} />
      <ExpensesEditorPanel
        key={expenses.selectedExpense?.id ?? 'new-expense'}
        selectedExpense={expenses.selectedExpense}
        isSaving={expenses.isSaving}
        isUploadingFiles={expenses.isUploadingFiles}
        mutationError={expenses.mutationError}
        vendorOptions={vendors.vendors}
        isLoadingVendors={vendors.isLoading}
        onCreate={expenses.createExpenseEntry}
        onUpdate={expenses.updateExpenseEntry}
        onAmend={expenses.amendExpenseEntry}
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
        isVoidingId={expenses.isDeletingId}
        isMarkingPaidId={expenses.isMarkingPaidId}
        isReparsingId={expenses.isReparsingId}
        onLoadMore={expenses.loadMore}
        onSelectExpense={expenses.selectExpense}
        onQueryChange={(value) => expenses.setFilter('query', value)}
        onStatusChange={(value) => expenses.setFilter('status', value)}
        onParseStatusChange={(value) => expenses.setFilter('parseStatus', value)}
        onReparse={expenses.reparseExpenseEntry}
        onMarkPaid={expenses.markPaidExpenseEntry}
        onVoidExpense={expenses.cancelExpenseEntry}
      />
    </div>
  );
}
