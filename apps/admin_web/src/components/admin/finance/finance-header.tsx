'use client';

import { Button } from '@/components/ui/button';

export type FinanceView = 'expenses' | 'vendors' | 'client-invoices';

export interface FinanceHeaderProps {
  activeView: FinanceView;
  onSetView: (view: FinanceView) => void;
}

export function FinanceHeader({ activeView, onSetView }: FinanceHeaderProps) {
  return (
    <div className='flex gap-2'>
      <Button type='button' variant={activeView === 'expenses' ? 'secondary' : 'ghost'} onClick={() => onSetView('expenses')}>
        Expenses
      </Button>
      <Button type='button' variant={activeView === 'vendors' ? 'secondary' : 'ghost'} onClick={() => onSetView('vendors')}>
        Vendors
      </Button>
      <Button
        type='button'
        variant={activeView === 'client-invoices' ? 'secondary' : 'ghost'}
        onClick={() => onSetView('client-invoices')}
      >
        Client invoices
      </Button>
    </div>
  );
}
