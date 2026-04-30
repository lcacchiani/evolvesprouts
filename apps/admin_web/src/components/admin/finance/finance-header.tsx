'use client';

import { AdminTabStrip, type AdminTabItem } from '@/components/ui/admin-tab-strip';

export type FinanceView = 'expenses' | 'vendors' | 'client-invoices';

export const FINANCE_TAB_ITEMS: readonly AdminTabItem<FinanceView>[] = [
  { key: 'expenses', label: 'Expenses' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'client-invoices', label: 'Client Invoices' },
] as const;

export const FINANCE_TAB_KEYS: readonly FinanceView[] = FINANCE_TAB_ITEMS.map(
  (item) => item.key
);

export const DEFAULT_FINANCE_VIEW: FinanceView = 'expenses';

export interface FinanceHeaderProps {
  activeView: FinanceView;
  onSetView: (view: FinanceView) => void;
}

export function FinanceHeader({ activeView, onSetView }: FinanceHeaderProps) {
  return (
    <AdminTabStrip
      aria-label='Finance views'
      items={FINANCE_TAB_ITEMS}
      activeKey={activeView}
      onChange={onSetView}
    />
  );
}
