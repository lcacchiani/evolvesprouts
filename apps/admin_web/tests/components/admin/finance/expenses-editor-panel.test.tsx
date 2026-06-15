import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ExpensesEditorPanel } from '@/components/admin/finance/expenses-editor-panel';
import type { Expense } from '@/types/expenses';
import type { Vendor } from '@/types/vendors';

const vendor: Vendor = {
  id: 'vendor-1',
  name: 'Acme Co',
  active: true,
  archivedAt: null,
  createdAt: null,
  updatedAt: null,
  website: null,
};

const baseExpense: Expense = {
  id: 'exp-1',
  amendsExpenseId: null,
  status: 'submitted',
  parseStatus: 'succeeded',
  vendorId: vendor.id,
  vendorName: vendor.name,
  invoiceNumber: 'INV-1',
  invoiceDate: '2026-03-01',
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
  attachments: [{ assetId: 'asset-1', filename: 'invoice.pdf', contentType: 'application/pdf' }],
};

function renderEditor(
  overrides: Partial<ComponentProps<typeof ExpensesEditorPanel>> = {}
) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onAmend = vi.fn().mockResolvedValue(undefined);
  const onStartCreate = vi.fn();

  render(
    <ExpensesEditorPanel
      selectedExpense={null}
      vendorOptions={[vendor]}
      isLoadingVendors={false}
      isSaving={false}
      isUploadingFiles={false}
      mutationError=''
      onCreate={onCreate}
      onUpdate={onUpdate}
      onAmend={onAmend}
      onStartCreate={onStartCreate}
      {...overrides}
    />
  );

  return { onCreate, onUpdate, onAmend, onStartCreate };
}

describe('ExpensesEditorPanel', () => {
  it('requires a vendor before create submit', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderEditor();

    expect(screen.getByRole('button', { name: 'Submit expense' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/^Vendor/), vendor.id);
    await user.click(screen.getByRole('button', { name: 'Submit expense' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            vendorId: vendor.id,
            parseRequested: true,
          }),
        })
      );
    });
  });

  it('calls onUpdate in edit mode', async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderEditor({ selectedExpense: baseExpense });

    await user.click(screen.getByRole('button', { name: 'Update expense' }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseId: baseExpense.id,
          existingAttachmentAssetIds: ['asset-1'],
        })
      );
    });
  });

  it('shows mutation errors', () => {
    renderEditor({ mutationError: 'Save failed' });
    expect(screen.getByText('Save failed')).toBeInTheDocument();
  });
});
