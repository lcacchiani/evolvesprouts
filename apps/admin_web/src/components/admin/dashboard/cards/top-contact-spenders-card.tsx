'use client';

import { useEffect, useMemo, useState } from 'react';

import { DashboardCard } from '@/components/admin/dashboard/dashboard-card';
import { toErrorMessage } from '@/hooks/hook-errors';
import { useFxMultipliersForCurrencies } from '@/hooks/use-fx-multipliers-for-currencies';
import {
  TOP_CONTACT_SPENDERS_HKD,
  TOP_CONTACT_SPENDERS_LIMIT,
  aggregateIssuedInvoiceSpendByRollupContact,
  collectBillToFamilyAndOrganizationIds,
  mergeSkippedFxCurrencies,
  rankContactSpendersForHkd,
} from '@/lib/build-top-contact-spenders';
import type { CustomerInvoiceSummary } from '@/lib/billing-api';
import { resolveBillToPrimaryContacts } from '@/lib/billing-api';
import { formatAmountInCurrency } from '@/lib/vendor-spend';

export interface TopContactSpendersCardProps {
  issuedInvoices: CustomerInvoiceSummary[] | null;
  loadError: string;
  isLoading: boolean;
}

export function TopContactSpendersCard({
  issuedInvoices: issuedInvoicesPayload,
  loadError,
  isLoading,
}: TopContactSpendersCardProps) {
  const [rollupError, setRollupError] = useState('');
  const [familyPrimaryById, setFamilyPrimaryById] = useState<Record<string, string>>({});
  const [organizationPrimaryById, setOrganizationPrimaryById] = useState<Record<string, string>>(
    {},
  );
  const [rollupLoaded, setRollupLoaded] = useState(false);

  const billToResolveKey = useMemo(() => {
    if (!issuedInvoicesPayload) {
      return '';
    }
    const { familyIds, organizationIds } =
      collectBillToFamilyAndOrganizationIds(issuedInvoicesPayload);
    const famKey = [...familyIds].sort().join('|');
    const orgKey = [...organizationIds].sort().join('|');
    return `${famKey}::${orgKey}`;
  }, [issuedInvoicesPayload]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional synchronous reset when
     * invoices are unavailable or the finance load failed, and when there are no family/org
     * bill-to ids (avoids flashing stale CRM maps). Async fetch uses the same pattern as other
     * admin dashboard loaders. */
    let cancelled = false;
    if (!issuedInvoicesPayload || loadError) {
      setRollupError('');
      setFamilyPrimaryById({});
      setOrganizationPrimaryById({});
      setRollupLoaded(false);
      return () => {
        cancelled = true;
      };
    }

    const { familyIds, organizationIds } = collectBillToFamilyAndOrganizationIds(issuedInvoicesPayload);

    if (familyIds.length === 0 && organizationIds.length === 0) {
      setRollupError('');
      setFamilyPrimaryById({});
      setOrganizationPrimaryById({});
      setRollupLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    setRollupLoaded(false);
    setRollupError('');
    void (async () => {
      try {
        const resolved = await resolveBillToPrimaryContacts({
          familyIds,
          organizationIds,
        });
        if (!cancelled) {
          setFamilyPrimaryById(resolved.familyPrimaryContactById);
          setOrganizationPrimaryById(resolved.organizationPrimaryContactById);
          setRollupLoaded(true);
        }
      } catch (error) {
        if (!cancelled) {
          setRollupError(
            toErrorMessage(error, 'Could not resolve family and organisation primary contacts.'),
          );
          setFamilyPrimaryById({});
          setOrganizationPrimaryById({});
          setRollupLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [issuedInvoicesPayload, loadError, billToResolveKey]);

  const aggregates = useMemo(() => {
    if (!issuedInvoicesPayload) {
      return new Map<string, { displayName: string | null; spendByCurrency: Map<string, number> }>();
    }
    return aggregateIssuedInvoiceSpendByRollupContact(
      issuedInvoicesPayload,
      familyPrimaryById,
      organizationPrimaryById,
    );
  }, [issuedInvoicesPayload, familyPrimaryById, organizationPrimaryById]);

  const foreignFxCodes = useMemo(() => {
    const set = new Set<string>();
    for (const [, row] of aggregates) {
      for (const c of row.spendByCurrency.keys()) {
        const code = c.trim().toUpperCase();
        if (code && code !== TOP_CONTACT_SPENDERS_HKD) {
          set.add(code);
        }
      }
    }
    return Array.from(set);
  }, [aggregates]);

  const fxEnabled =
    Boolean(issuedInvoicesPayload && !isLoading && rollupLoaded && !loadError && !rollupError) &&
    foreignFxCodes.length > 0;

  const { fxMultipliers, fxError } = useFxMultipliersForCurrencies(foreignFxCodes, fxEnabled, {
    targetCurrency: TOP_CONTACT_SPENDERS_HKD,
    errorMessage: 'Could not load FX rates for HKD conversion.',
  });

  const multipliersForSum = useMemo(
    () => fxMultipliers ?? new Map<string, number>(),
    [fxMultipliers],
  );
  const sumsReady = !fxEnabled || fxMultipliers !== null;

  const ranked = useMemo(() => {
    if (!issuedInvoicesPayload || !rollupLoaded || !sumsReady) {
      return [];
    }
    return rankContactSpendersForHkd(aggregates, multipliersForSum, TOP_CONTACT_SPENDERS_LIMIT);
  }, [
    aggregates,
    issuedInvoicesPayload,
    multipliersForSum,
    rollupLoaded,
    sumsReady,
  ]);

  const skippedFxCodes = useMemo(() => mergeSkippedFxCurrencies(ranked), [ranked]);
  const fxGapMessage =
    skippedFxCodes.length > 0
      ? `FX unavailable for ${skippedFxCodes.join(', ')}. Totals exclude amounts in those currencies.`
      : '';

  const blockingError = [loadError, rollupError, fxEnabled ? fxError : ''].filter(Boolean).join(' • ');

  return (
    <DashboardCard width='half' title='Top contact spenders (issued invoices)'>
      <div className='space-y-4'>
        {isLoading || !sumsReady || !rollupLoaded ? (
          <div className='h-28 animate-pulse rounded-md bg-slate-100' aria-hidden />
        ) : blockingError ? (
          <p className='text-sm text-red-600'>{blockingError}</p>
        ) : ranked.length === 0 ? (
          <p className='text-sm text-slate-600'>
            No positive-total issued invoices yet, or no bill-to party could be rolled up to a contact.
          </p>
        ) : (
          <>
            {fxGapMessage ? (
              <p className='text-sm font-medium text-amber-800' role='status'>
                {fxGapMessage}
              </p>
            ) : null}
            <p className='text-xs text-slate-600'>
              Totals combine invoices billed to a contact, and invoices billed to a family or organisation
              (rolled up to each entity&apos;s primary CRM contact). Converted to HKD using the same daily
              rates as elsewhere in Finance.
            </p>
            <ol className='list-decimal space-y-2 pl-5 text-sm text-slate-900'>
              {ranked.map((row) => (
                <li key={row.contactId} className='marker:font-medium'>
                  <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1'>
                    <span className='min-w-0 font-medium text-slate-900'>{row.displayName}</span>
                    <span className='shrink-0 tabular-nums text-slate-900'>
                      {formatAmountInCurrency(row.totalHkd, TOP_CONTACT_SPENDERS_HKD)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </DashboardCard>
  );
}
