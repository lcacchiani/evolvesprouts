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
});
