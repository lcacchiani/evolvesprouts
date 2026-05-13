import { describe, expect, it } from 'vitest';

import type { CustomerInvoiceSummary } from '@/lib/billing-api';
import {
  buildTaxFiscalYearRows,
  defaultFiscalYearStartYear,
  taxFiscalYearRowsToCsv,
} from '@/lib/tax-fiscal-year-report';
import type { Expense } from '@/types/expenses';

function expenseStub(partial: Partial<Expense> & Pick<Expense, 'id' | 'status'>): Expense {
  return {
    amendsExpenseId: null,
    parseStatus: 'not_requested',
    vendorId: null,
    vendorName: null,
    invoiceNumber: null,
    invoiceDate: null,
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
    paidAt: null,
    voidedAt: null,
    attachments: [],
    ...partial,
  } as Expense;
}

describe('tax-fiscal-year-report', () => {
  it('defaultFiscalYearStartYear mirrors FY boundaries', () => {
    expect(defaultFiscalYearStartYear(new Date('2026-05-06T12:00:00.000Z'))).toBe(2026);
    expect(defaultFiscalYearStartYear(new Date('2026-03-20T12:00:00.000Z'))).toBe(2025);
  });

  it('sorts rows by classification date descending (newest first)', () => {
    const rows = buildTaxFiscalYearRows(
      [
        expenseStub({
          id: 'early',
          status: 'paid',
          invoiceDate: '2025-04-10',
          total: '1',
        }),
        expenseStub({
          id: 'late',
          status: 'paid',
          invoiceDate: '2025-06-20',
          total: '2',
        }),
      ],
      [],
      2025,
      'paid',
    );
    expect(rows.map((r) => r.referenceId)).toEqual(['late', 'early']);
  });

  it('filters expenses by selected status', () => {
    const voided = expenseStub({
      id: 'v',
      status: 'voided',
      invoiceDate: '2025-06-01',
      total: '50',
    });
    const paid = expenseStub({
      id: 'p',
      status: 'paid',
      invoiceDate: '2025-06-01',
      total: '100',
    });
    expect(buildTaxFiscalYearRows([voided, paid], [], 2025, 'paid')).toHaveLength(1);
    expect(buildTaxFiscalYearRows([voided, paid], [], 2025, 'paid')[0]?.referenceId).toBe('p');
    expect(buildTaxFiscalYearRows([voided, paid], [], 2025, 'voided')).toHaveLength(1);
    expect(buildTaxFiscalYearRows([voided, paid], [], 2025, 'voided')[0]?.referenceId).toBe('v');
  });

  it('includes expenses matching the status filter in range and revenue by issued date', () => {
    const rows = buildTaxFiscalYearRows(
      [
        expenseStub({
          id: 'e1',
          status: 'draft',
          vendorName: 'Paper Co',
          invoiceDate: '2025-06-10',
          total: '200',
          tax: '10',
        }),
      ],
      [
        {
          id: 'i1',
          status: 'issued',
          invoiceNumber: 'INV-1',
          currency: 'HKD',
          subtotal: '900',
          taxTotal: '50',
          total: '950',
          billToDisplayName: 'Family A',
          issuedAt: '2025-08-01T08:00:00.000Z',
        } satisfies CustomerInvoiceSummary,
      ],
      2025,
      'draft',
    );
    expect(rows.map((r) => r.kind)).toEqual(['revenue', 'expense']);
    expect(rows[0]?.kind).toBe('revenue');
    expect(rows[1]?.kind).toBe('expense');
  });

  it('flags missing invoice date when using paid date', () => {
    const rows = buildTaxFiscalYearRows(
      [
        expenseStub({
          id: 'e2',
          status: 'paid',
          invoiceDate: null,
          paidAt: '2025-07-01T00:00:00.000Z',
          vendorName: 'Vendor',
          total: '10',
        }),
      ],
      [],
      2025,
      'paid',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.needsInvoiceDateWarning).toBe(true);
  });

  it('serializes CSV with escaping', () => {
    const csv = taxFiscalYearRowsToCsv([
      {
        kind: 'expense',
        classificationDate: '2025-06-01',
        description: 'Hello, world',
        currency: 'HKD',
        amount: '1',
        tax: '0',
        expenseStatus: 'paid',
        referenceId: 'id',
        needsInvoiceDateWarning: false,
        invoiceNumber: null,
      },
    ]);
    expect(csv).toContain('"Hello, world"');
  });
});
