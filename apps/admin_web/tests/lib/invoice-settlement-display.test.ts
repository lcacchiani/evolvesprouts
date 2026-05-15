import { describe, expect, it } from 'vitest';

import { getInvoiceSettlementBadgeLabel } from '@/lib/invoice-settlement-display';

describe('getInvoiceSettlementBadgeLabel', () => {
  it('maps lifecycle rows', () => {
    expect(getInvoiceSettlementBadgeLabel({ status: 'draft' })).toBe('Draft');
    expect(getInvoiceSettlementBadgeLabel({ status: 'void' })).toBe('Void');
  });

  it('maps issued settlement rows', () => {
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        isPaid: true,
        amountAllocated: '100.0000',
        balanceDue: '0.0000',
      }),
    ).toBe('Paid');
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        isPaid: false,
        amountAllocated: '40.0000',
        balanceDue: '60.0000',
      }),
    ).toBe('Partially paid');
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        isPaid: false,
        amountAllocated: '0.0000',
        balanceDue: '100.0000',
      }),
    ).toBe('Open');
  });

  it('labels zero-total issued invoices as No charge', () => {
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        total: '0',
        amountAllocated: '0',
        balanceDue: '0',
        isPaid: false,
      }),
    ).toBe('No charge');
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        total: '0.0000',
        amountAllocated: '0',
        balanceDue: '0',
        isPaid: false,
      }),
    ).toBe('No charge');
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        total: '  0  ',
        balanceDue: '0',
        isPaid: false,
      }),
    ).toBe('No charge');
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        total: '-0',
        balanceDue: '0',
        isPaid: false,
      }),
    ).toBe('No charge');
  });

  it('does not treat missing or invalid total as zero for issued rows', () => {
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        balanceDue: '0',
        isPaid: false,
      }),
    ).toBe('Open');
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        total: '',
        balanceDue: '0',
        isPaid: false,
      }),
    ).toBe('Open');
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        total: 'NaN',
        balanceDue: '0',
        isPaid: false,
      }),
    ).toBe('Open');
  });

  it('keeps positive-total issued settlement semantics', () => {
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        total: '100',
        balanceDue: '100',
        isPaid: false,
      }),
    ).toBe('Open');
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        total: '100',
        amountAllocated: '40',
        balanceDue: '60',
        isPaid: false,
      }),
    ).toBe('Partially paid');
    expect(
      getInvoiceSettlementBadgeLabel({
        status: 'issued',
        total: '100',
        amountAllocated: '100',
        balanceDue: '0',
        isPaid: true,
      }),
    ).toBe('Paid');
  });

  it('prefers lifecycle labels over zero total for draft and void', () => {
    expect(getInvoiceSettlementBadgeLabel({ status: 'draft', total: '0' })).toBe('Draft');
    expect(getInvoiceSettlementBadgeLabel({ status: 'void', total: '0' })).toBe('Void');
  });
});
