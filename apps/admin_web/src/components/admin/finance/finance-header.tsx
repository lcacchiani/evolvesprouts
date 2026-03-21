'use client';

import { AdminTabStrip, type AdminTabItem } from '@/components/ui/admin-tab-strip';

export type FinanceView = 'expenses' | 'vendors' | 'client-invoices';

export const FINANCE_TAB_ITEMS: readonly AdminTabItem<FinanceView>[] = [
  { key: 'expenses', label: 'Expenses' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'client-invoices', label: 'Client invoices' },
] as const;

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
