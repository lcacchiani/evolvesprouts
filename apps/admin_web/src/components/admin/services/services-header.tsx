'use client';

import { Button } from '@/components/ui/button';

import type { ServicesView } from '@/hooks/use-services-page';

export interface ServicesHeaderProps {
  activeView: ServicesView;
  onSetView: (view: ServicesView) => void;
}

export function ServicesHeader({ activeView, onSetView }: ServicesHeaderProps) {
  return (
    <div className='flex gap-2'>
      <Button
        type='button'
        variant={activeView === 'catalog' ? 'secondary' : 'ghost'}
        onClick={() => onSetView('catalog')}
      >
        Catalog
      </Button>
      <Button
        type='button'
        variant={activeView === 'discount-codes' ? 'secondary' : 'ghost'}
        onClick={() => onSetView('discount-codes')}
      >
        Discount codes
      </Button>
    </div>
  );
}
