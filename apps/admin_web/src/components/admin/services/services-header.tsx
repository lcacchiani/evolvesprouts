'use client';

import { AdminTabStrip, type AdminTabItem } from '@/components/ui/admin-tab-strip';

import type { ServicesView } from '@/hooks/use-services-page';

export const SERVICES_TAB_ITEMS: readonly AdminTabItem<ServicesView>[] = [
  { key: 'catalog', label: 'Service Catalogue' },
  { key: 'events', label: 'Events' },
  { key: 'discount-codes', label: 'Discount Codes' },
  { key: 'venues', label: 'Venues' },
] as const;

export interface ServicesHeaderProps {
  activeView: ServicesView;
  onSetView: (view: ServicesView) => void;
}

export function ServicesHeader({ activeView, onSetView }: ServicesHeaderProps) {
  return (
    <AdminTabStrip
      aria-label='Services views'
      items={SERVICES_TAB_ITEMS}
      activeKey={activeView}
      onChange={onSetView}
    />
  );
}
