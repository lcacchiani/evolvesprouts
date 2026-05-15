import { enumerateFiscalYearStartYears } from '@/lib/fiscal-year';
import { defaultFiscalYearStartYear } from '@/lib/tax-fiscal-year-report';

/** Earliest Hong Kong FY start year offered in admin tax selectors (April Y → March Y+1). */
export const MIN_ADMIN_TAX_FISCAL_YEAR_START = 2024;

/**
 * FY start years for admin tax UIs (Finance > Tax, Dashboard > Tax Position), newest first.
 * Matches {@link apps/admin_web/src/components/admin/finance/tax-fiscal-year-panel.tsx}.
 */
export function enumerateAdminTaxFiscalYearStartYears(): number[] {
  const currentStart = defaultFiscalYearStartYear();
  const throughYear = Math.max(currentStart + 1, MIN_ADMIN_TAX_FISCAL_YEAR_START);
  return enumerateFiscalYearStartYears(MIN_ADMIN_TAX_FISCAL_YEAR_START, throughYear);
}

/** Shared empty copy for tax fiscal-year tables and the Dashboard Tax Position card. */
export const ADMIN_TAX_FISCAL_YEAR_EMPTY_MESSAGE =
  'No expense or revenue rows in this fiscal year.';
