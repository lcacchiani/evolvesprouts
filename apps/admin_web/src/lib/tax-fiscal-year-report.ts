import type { CustomerInvoiceSummary } from '@/lib/billing-api';
import {
  formatInstantAsHongKongDateString,
  getFiscalYearRangeInclusive,
  inferCurrentFiscalYearStartYear,
  isDateInInclusiveRange,
  parseIsoDateOnly,
  todayHongKongDateString,
} from '@/lib/fiscal-year';
import type { Expense } from '@/types/expenses';

export interface TaxFiscalYearRow {
  kind: 'expense' | 'revenue';
  classificationDate: string;
  description: string;
  currency: string;
  amount: string;
  tax: string;
  expenseStatus?: string;
  referenceId: string;
  needsInvoiceDateWarning: boolean;
  invoiceNumber: string | null;
}

function expenseClassificationDate(expense: Expense): {
  date: string | null;
  needsInvoiceDateWarning: boolean;
} {
  const invoiceOk = parseIsoDateOnly(expense.invoiceDate);
  if (invoiceOk) {
    return { date: invoiceOk, needsInvoiceDateWarning: false };
  }
  const paid = formatInstantAsHongKongDateString(expense.paidAt ?? null);
  return { date: paid, needsInvoiceDateWarning: true };
}

function expenseIncludedStatuses(expense: Expense): boolean {
  return expense.status !== 'voided';
}

export function buildTaxFiscalYearRows(
  expenses: Expense[],
  issuedInvoices: CustomerInvoiceSummary[],
  fyStartYear: number,
): TaxFiscalYearRow[] {
  const { start, end } = getFiscalYearRangeInclusive(fyStartYear);

  const expenseRows: TaxFiscalYearRow[] = [];
  for (const expense of expenses) {
    if (!expenseIncludedStatuses(expense)) {
      continue;
    }
    const { date, needsInvoiceDateWarning } = expenseClassificationDate(expense);
    if (!date || !isDateInInclusiveRange(date, start, end)) {
      continue;
    }
    const vendor = expense.vendorName?.trim() ?? '';
    expenseRows.push({
      kind: 'expense',
      classificationDate: date,
      description: vendor !== '' ? vendor : 'Expense',
      currency: expense.currency?.trim().toUpperCase() ?? '',
      amount: expense.total?.trim() ?? '',
      tax: expense.tax?.trim() ?? '',
      expenseStatus: expense.status,
      referenceId: expense.id,
      needsInvoiceDateWarning,
      invoiceNumber: expense.invoiceNumber?.trim() ?? null,
    });
  }

  const revenueRows: TaxFiscalYearRow[] = [];
  for (const inv of issuedInvoices) {
    const invId = inv.id?.trim() ?? '';
    if (invId === '') {
      continue;
    }
    if (inv.status !== 'issued') {
      continue;
    }
    const issued = formatInstantAsHongKongDateString(inv.issuedAt ?? null);
    if (!issued || !isDateInInclusiveRange(issued, start, end)) {
      continue;
    }
    const name = inv.billToDisplayName?.trim() ?? '';
    const num = inv.invoiceNumber?.trim() ?? '';
    const description =
      name !== '' && num !== '' ? `${name} (${num})` : name !== '' ? name : num !== '' ? num : 'Invoice';
    revenueRows.push({
      kind: 'revenue',
      classificationDate: issued,
      description,
      currency: inv.currency?.trim().toUpperCase() ?? '',
      amount: inv.total?.trim() ?? '',
      tax: inv.taxTotal?.trim() ?? '',
      referenceId: invId,
      needsInvoiceDateWarning: false,
      invoiceNumber: inv.invoiceNumber ?? null,
    });
  }

  const merged = [...expenseRows, ...revenueRows];
  merged.sort((a, b) => {
    const d = a.classificationDate.localeCompare(b.classificationDate);
    if (d !== 0) {
      return d;
    }
    return `${a.kind}:${a.referenceId}`.localeCompare(`${b.kind}:${b.referenceId}`);
  });
  return merged;
}

export function defaultFiscalYearStartYear(now: Date = new Date()): number {
  return inferCurrentFiscalYearStartYear(todayHongKongDateString(now));
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function taxFiscalYearRowsToCsv(rows: TaxFiscalYearRow[]): string {
  const headers = [
    'kind',
    'classification_date',
    'description',
    'currency',
    'amount',
    'tax',
    'expense_status',
    'invoice_number',
    'reference_id',
    'needs_invoice_date_warning',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const cells = [
      row.kind,
      row.classificationDate,
      row.description,
      row.currency,
      row.amount,
      row.tax,
      row.expenseStatus ?? '',
      row.invoiceNumber ?? '',
      row.referenceId,
      row.needsInvoiceDateWarning ? 'yes' : 'no',
    ].map((c) => csvEscape(c));
    lines.push(cells.join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
