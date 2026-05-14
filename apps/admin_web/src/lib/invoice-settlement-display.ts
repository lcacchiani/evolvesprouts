/** Display labels for customer invoice settlement (admin AR list). */

export type InvoiceSettlementBadgeInput = {
  status?: string | null;
  isPaid?: boolean | null;
  amountAllocated?: string | null;
  balanceDue?: string | null;
};

function parseNonNegativeDecimal(raw: string | null | undefined): number {
  const t = (raw ?? '').trim();
  if (t === '') {
    return 0;
  }
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Toolbar / table copy for issued-invoice settlement; draft and void stay lifecycle labels. */
export function getInvoiceSettlementBadgeLabel(inv: InvoiceSettlementBadgeInput): string {
  const st = (inv.status ?? '').trim().toLowerCase();
  if (st === 'draft') {
    return 'Draft';
  }
  if (st === 'void') {
    return 'Void';
  }
  if (st === 'issued') {
    if (inv.isPaid === true) {
      return 'Paid';
    }
    const allocated = parseNonNegativeDecimal(inv.amountAllocated ?? undefined);
    const due = parseNonNegativeDecimal(inv.balanceDue ?? undefined);
    if (allocated > 0 && due > 0) {
      return 'Partially paid';
    }
    return 'Open';
  }
  if (st === '') {
    return '—';
  }
  return st;
}
