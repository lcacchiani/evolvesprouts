import { describe, expect, it } from 'vitest';

import type { CustomerInvoiceSummary } from '@/lib/billing-api';
import {
  aggregateIssuedInvoiceSpendByRollupContact,
  collectBillToFamilyAndOrganizationIds,
  rankContactSpendersForHkd,
} from '@/lib/build-top-contact-spenders';

function inv(partial: Partial<CustomerInvoiceSummary> & Pick<CustomerInvoiceSummary, 'id'>): CustomerInvoiceSummary {
  return {
    status: 'issued',
    currency: 'HKD',
    total: '100.00',
    billToKind: 'contact',
    billToContactId: '00000000-0000-4000-8000-000000000001',
    billToFamilyId: null,
    billToOrganizationId: null,
    billToDisplayName: 'Test Contact',
    ...partial,
  } as CustomerInvoiceSummary;
}

describe('build-top-contact-spenders', () => {
  it('collects distinct family and organisation bill-to ids', () => {
    const rows = [
      inv({ id: 'a', billToKind: 'family', billToFamilyId: 'f1', billToContactId: null }),
      inv({ id: 'b', billToKind: 'family', billToFamilyId: 'f1', billToContactId: null }),
      inv({
        id: 'c',
        billToKind: 'organization',
        billToOrganizationId: 'o1',
        billToContactId: null,
        billToFamilyId: null,
      }),
    ];
    const { familyIds, organizationIds } = collectBillToFamilyAndOrganizationIds(rows);
    expect(familyIds).toEqual(['f1']);
    expect(organizationIds).toEqual(['o1']);
  });

  it('rolls family and organisation spend onto primary contacts and ranks in HKD', () => {
    const primary = '00000000-0000-4000-8000-000000000099';
    const invoices = [
      inv({
        id: '1',
        billToKind: 'contact',
        billToContactId: primary,
        billToDisplayName: 'Primary Person',
        total: '50',
        currency: 'HKD',
      }),
      inv({
        id: '2',
        billToKind: 'family',
        billToFamilyId: 'f1',
        billToContactId: null,
        billToDisplayName: 'Family label',
        total: '100',
        currency: 'HKD',
      }),
      inv({
        id: '3',
        billToKind: 'organization',
        billToOrganizationId: 'o1',
        billToContactId: null,
        billToDisplayName: 'Org\nPrimary Person',
        total: '40',
        currency: 'USD',
      }),
    ];
    const familyPrimary = { f1: primary };
    const orgPrimary = { o1: primary };
    const agg = aggregateIssuedInvoiceSpendByRollupContact(invoices, familyPrimary, orgPrimary);
    const ranked = rankContactSpendersForHkd(agg, new Map([['USD', 8]]), 10);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].contactId).toBe(primary);
    expect(ranked[0].displayName).toBe('Primary Person');
    expect(ranked[0].totalHkd).toBeCloseTo(50 + 100 + 40 * 8);
  });

  it('skips foreign currency amounts when FX multiplier is missing', () => {
    const cid = '00000000-0000-4000-8000-000000000001';
    const invoices = [
      inv({
        id: '1',
        billToKind: 'contact',
        billToContactId: cid,
        total: '10',
        currency: 'HKD',
      }),
      inv({
        id: '2',
        billToKind: 'contact',
        billToContactId: cid,
        total: '20',
        currency: 'EUR',
      }),
    ];
    const agg = aggregateIssuedInvoiceSpendByRollupContact(invoices, {}, {});
    const ranked = rankContactSpendersForHkd(agg, new Map(), 10);
    expect(ranked[0].totalHkd).toBe(10);
    expect(ranked[0].skippedFxCurrencies).toEqual(['EUR']);
  });
});
