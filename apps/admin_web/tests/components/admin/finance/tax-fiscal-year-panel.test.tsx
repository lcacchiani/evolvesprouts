import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/expenses-api', () => ({
  listAllAdminExpenses: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/billing-api', () => ({
  listAllCustomerInvoices: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/hooks/use-fx-multipliers-for-currencies', () => ({
  useFxMultipliersForCurrencies: () => ({ fxMultipliers: new Map(), fxError: '' }),
}));

import { TaxFiscalYearPanel } from '@/components/admin/finance/tax-fiscal-year-panel';
import { ADMIN_TAX_FISCAL_YEAR_EMPTY_MESSAGE } from '@/lib/admin-tax-fiscal-year';

describe('TaxFiscalYearPanel', () => {
  it('loads expenses and invoices then shows empty state', async () => {
    render(<TaxFiscalYearPanel />);

    await waitFor(() => {
      expect(screen.getByText(ADMIN_TAX_FISCAL_YEAR_EMPTY_MESSAGE)).toBeInTheDocument();
    });
  });
});
