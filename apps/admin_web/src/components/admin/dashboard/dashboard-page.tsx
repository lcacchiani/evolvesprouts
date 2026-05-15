'use client';

import { TaxPositionCard } from '@/components/admin/dashboard/cards/tax-position-card';

export function DashboardPage() {
  return (
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
      <TaxPositionCard />
    </div>
  );
}
