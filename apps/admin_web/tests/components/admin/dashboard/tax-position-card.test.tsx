import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ADMIN_TAX_FISCAL_YEAR_EMPTY_MESSAGE } from '@/lib/admin-tax-fiscal-year';
import type { CustomerInvoiceSummary } from '@/lib/billing-api';
import type { Expense } from '@/types/expenses';

vi.mock('@/lib/config', () => ({
  getAdminDefaultCurrencyCode: vi.fn(() => 'HKD'),
}));

const mockUseFx = vi.fn();
vi.mock('@/hooks/use-fx-multipliers-for-currencies', () => ({
  useFxMultipliersForCurrencies: (...args: unknown[]) => mockUseFx(...args),
}));

import { TaxPositionCard } from '@/components/admin/dashboard/cards/tax-position-card';

function expenseStub(partial: Partial<Expense> & Pick<Expense, 'id' | 'status'>): Expense {
  return {
    amendsExpenseId: null,
    parseStatus: 'not_requested',
    vendorId: 'v1',
    vendorName: 'Vendor',
    invoiceNumber: null,
    invoiceDate: '2025-06-01',
    dueDate: null,
    currency: 'HKD',
    subtotal: null,
    tax: '0',
    total: '100',
    lineItems: [],
    parseConfidence: null,
    notes: null,
    voidReason: null,
    createdBy: '',
    updatedBy: null,
    createdAt: '',
    updatedAt: '',
    submittedAt: null,
    paidAt: '2025-06-02T00:00:00.000Z',
    voidedAt: null,
    attachments: [],
    ...partial,
  } as Expense;
}

function invoiceStub(partial: Partial<CustomerInvoiceSummary> & Pick<CustomerInvoiceSummary, 'id'>): CustomerInvoiceSummary {
  return {
    status: 'issued',
    invoiceNumber: 'INV-1',
    currency: 'HKD',
    subtotal: '400',
    taxTotal: '0',
    total: '400',
    billToDisplayName: 'Client',
    invoiceDate: '2025-07-01',
    issuedAt: '2025-07-01T08:00:00.000Z',
    ...partial,
  } as CustomerInvoiceSummary;
}

describe('TaxPositionCard', () => {
  beforeEach(() => {
    mockUseFx.mockReturnValue({ fxMultipliers: new Map(), fxError: '' });
  });

  it('shows a skeleton while loading', () => {
    render(
      <TaxPositionCard expenses={null} issuedInvoices={null} loadError='' isLoading />,
    );
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows load error text', () => {
    render(
      <TaxPositionCard
        expenses={[]}
        issuedInvoices={[]}
        loadError='Network failed'
        isLoading={false}
      />,
    );
    expect(screen.getByText('Network failed')).toBeInTheDocument();
  });

  it('shows empty-state copy when there are no rows', () => {
    render(
      <TaxPositionCard expenses={[]} issuedInvoices={[]} loadError='' isLoading={false} />,
    );
    expect(screen.getByText(ADMIN_TAX_FISCAL_YEAR_EMPTY_MESSAGE)).toBeInTheDocument();
  });

  it('shows revenue, expense, and net with surplus wording when net is non-negative', async () => {
    mockUseFx.mockReturnValue({ fxMultipliers: new Map(), fxError: '' });
    const user = userEvent.setup();
    const { container } = render(
      <TaxPositionCard
        expenses={[
          expenseStub({
            id: 'e1',
            status: 'paid',
            invoiceDate: '2025-06-10',
            total: '100',
            currency: 'HKD',
          }),
        ]}
        issuedInvoices={[
          invoiceStub({
            id: 'i1',
            total: '500',
            subtotal: '500',
            taxTotal: '0',
            invoiceDate: '2025-07-01',
            issuedAt: '2025-07-01T08:00:00.000Z',
          }),
        ]}
        loadError=''
        isLoading={false}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Fiscal year'), '2025');

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });
    expect(screen.getByText('Expense')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll('.sr-only')).some((el) =>
        el.textContent?.includes('Surplus'),
      ),
    ).toBe(true);
    expect(screen.queryByText(/\(loss\)/)).not.toBeInTheDocument();
  });

  it('shows a skeleton until FX multipliers resolve for foreign-currency rows', async () => {
    mockUseFx.mockReturnValue({ fxMultipliers: null, fxError: '' });
    const user = userEvent.setup();
    render(
      <TaxPositionCard
        expenses={[
          expenseStub({
            id: 'e-usd',
            status: 'paid',
            invoiceDate: '2025-06-10',
            total: '50',
            currency: 'USD',
          }),
        ]}
        issuedInvoices={[]}
        loadError=''
        isLoading={false}
      />,
    );
    await user.selectOptions(screen.getByLabelText('Fiscal year'), '2025');
    await waitFor(() => {
      expect(document.querySelector('.animate-pulse')).toBeTruthy();
    });
  });

  it('warns when FX multipliers omit a foreign currency and still renders partial totals', async () => {
    mockUseFx.mockReturnValue({ fxMultipliers: new Map(), fxError: '' });
    const user = userEvent.setup();
    render(
      <TaxPositionCard
        expenses={[
          expenseStub({
            id: 'e-hkd',
            status: 'paid',
            invoiceDate: '2025-06-05',
            total: '20',
            currency: 'HKD',
          }),
          expenseStub({
            id: 'e-usd',
            status: 'paid',
            invoiceDate: '2025-06-06',
            total: '100',
            currency: 'USD',
          }),
        ]}
        issuedInvoices={[]}
        loadError=''
        isLoading={false}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Fiscal year'), '2025');

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/FX unavailable for USD/i);
    });
    expect(screen.getByText('Expense')).toBeInTheDocument();
  });

  it('shows net loss suffix and sr-only loss when net is negative', async () => {
    mockUseFx.mockReturnValue({ fxMultipliers: new Map(), fxError: '' });
    const user = userEvent.setup();
    const { container } = render(
      <TaxPositionCard
        expenses={[
          expenseStub({
            id: 'e1',
            status: 'paid',
            invoiceDate: '2025-06-10',
            total: '300',
            currency: 'HKD',
          }),
        ]}
        issuedInvoices={[
          invoiceStub({
            id: 'i1',
            total: '100',
            subtotal: '100',
            taxTotal: '0',
            invoiceDate: '2025-07-01',
            issuedAt: '2025-07-01T08:00:00.000Z',
          }),
        ]}
        loadError=''
        isLoading={false}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Fiscal year'), '2025');

    await waitFor(() => {
      expect(screen.getByText(/\(loss\)/)).toBeInTheDocument();
    });
    expect(
      Array.from(container.querySelectorAll('.sr-only')).some((el) =>
        el.textContent?.includes('Loss'),
      ),
    ).toBe(true);
  });

  it('surfaces FX hook errors in the blocking error area', async () => {
    mockUseFx.mockReturnValue({ fxMultipliers: new Map(), fxError: 'Frankfurter unavailable' });
    const user = userEvent.setup();
    render(
      <TaxPositionCard
        expenses={[
          expenseStub({
            id: 'e1',
            status: 'paid',
            invoiceDate: '2025-06-10',
            total: '10',
            currency: 'USD',
          }),
        ]}
        issuedInvoices={[]}
        loadError=''
        isLoading={false}
      />,
    );
    await user.selectOptions(screen.getByLabelText('Fiscal year'), '2025');
    await waitFor(() => {
      expect(screen.getByText(/Frankfurter unavailable/)).toBeInTheDocument();
    });
  });
});
