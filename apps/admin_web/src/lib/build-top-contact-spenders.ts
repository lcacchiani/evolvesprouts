import type { CustomerInvoiceSummary } from '@/lib/billing-api';
import { parseMoneyAmountString } from '@/lib/vendor-spend';

export const TOP_CONTACT_SPENDERS_HKD = 'HKD' as const;
export const TOP_CONTACT_SPENDERS_LIMIT = 10;

export function collectBillToFamilyAndOrganizationIds(
  invoices: CustomerInvoiceSummary[],
): { familyIds: string[]; organizationIds: string[] } {
  const families = new Set<string>();
  const orgs = new Set<string>();
  for (const inv of invoices) {
    if (inv.billToKind === 'family' && inv.billToFamilyId) {
      families.add(inv.billToFamilyId);
    } else if (inv.billToKind === 'organization' && inv.billToOrganizationId) {
      orgs.add(inv.billToOrganizationId);
    }
  }
  return {
    familyIds: [...families],
    organizationIds: [...orgs],
  };
}

function rollupContactIdForInvoice(
  inv: CustomerInvoiceSummary,
  familyPrimary: Record<string, string>,
  orgPrimary: Record<string, string>,
): string | null {
  if (inv.billToKind === 'contact' && inv.billToContactId) {
    return inv.billToContactId;
  }
  if (inv.billToKind === 'family' && inv.billToFamilyId) {
    return familyPrimary[inv.billToFamilyId] ?? null;
  }
  if (inv.billToKind === 'organization' && inv.billToOrganizationId) {
    return orgPrimary[inv.billToOrganizationId] ?? null;
  }
  return null;
}

function mergeDisplayName(
  current: string | null,
  candidate: string | null | undefined,
  prefer: boolean,
): string | null {
  const next = (candidate ?? '').trim();
  if (!next) {
    return current;
  }
  if (!current) {
    return next;
  }
  if (prefer) {
    return next;
  }
  return current;
}

export function aggregateIssuedInvoiceSpendByRollupContact(
  invoices: CustomerInvoiceSummary[],
  familyPrimary: Record<string, string>,
  orgPrimary: Record<string, string>,
): Map<string, { displayName: string | null; spendByCurrency: Map<string, number> }> {
  const byContact = new Map<
    string,
    { displayName: string | null; spendByCurrency: Map<string, number> }
  >();

  for (const inv of invoices) {
    if (inv.status !== 'issued') {
      continue;
    }
    const total = parseMoneyAmountString(inv.total ?? null);
    if (total == null || total <= 0) {
      continue;
    }

    const rollupId = rollupContactIdForInvoice(inv, familyPrimary, orgPrimary);
    if (!rollupId) {
      continue;
    }

    const currency = (inv.currency ?? TOP_CONTACT_SPENDERS_HKD).trim().toUpperCase();
    const effectiveCurrency = currency || TOP_CONTACT_SPENDERS_HKD;

    let row = byContact.get(rollupId);
    if (!row) {
      row = { displayName: null, spendByCurrency: new Map() };
      byContact.set(rollupId, row);
    }

    const isDirectContact = inv.billToKind === 'contact' && inv.billToContactId === rollupId;
    row.displayName = mergeDisplayName(row.displayName, inv.billToDisplayName ?? null, isDirectContact);

    row.spendByCurrency.set(
      effectiveCurrency,
      (row.spendByCurrency.get(effectiveCurrency) ?? 0) + total,
    );
  }

  return byContact;
}

export interface RankedContactSpender {
  contactId: string;
  displayName: string;
  totalHkd: number;
  skippedFxCurrencies: string[];
}

export function rankContactSpendersForHkd(
  aggregates: Map<string, { displayName: string | null; spendByCurrency: Map<string, number> }>,
  fxToHkd: Map<string, number>,
  limit: number,
): RankedContactSpender[] {
  const target = TOP_CONTACT_SPENDERS_HKD;
  const rows: RankedContactSpender[] = [];

  for (const [contactId, row] of aggregates) {
    let totalHkd = 0;
    const skipped = new Set<string>();
    for (const [currencyRaw, amount] of row.spendByCurrency) {
      const cc = currencyRaw.trim().toUpperCase();
      if (!cc || amount <= 0) {
        continue;
      }
      if (cc === target) {
        totalHkd += amount;
        continue;
      }
      const mult = fxToHkd.get(cc);
      if (mult == null || !Number.isFinite(mult)) {
        skipped.add(cc);
        continue;
      }
      totalHkd += amount * mult;
    }

    const trimmedName = (row.displayName ?? '').trim();
    rows.push({
      contactId,
      displayName: trimmedName || 'Unnamed contact',
      totalHkd,
      skippedFxCurrencies: Array.from(skipped).sort(),
    });
  }

  rows.sort((a, b) => b.totalHkd - a.totalHkd);
  return rows.slice(0, Math.max(0, limit));
}

export function mergeSkippedFxCurrencies(rows: RankedContactSpender[]): string[] {
  const merged = new Set<string>();
  for (const r of rows) {
    for (const c of r.skippedFxCurrencies) {
      merged.add(c);
    }
  }
  return Array.from(merged).sort();
}
