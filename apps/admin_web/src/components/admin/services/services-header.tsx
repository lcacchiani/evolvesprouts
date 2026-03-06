'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import type { ServicesView } from '@/hooks/use-services-page';

export interface ServicesHeaderProps {
  activeView: ServicesView;
  onSetView: (view: ServicesView) => void;
  onRefresh: () => Promise<void> | void;
  onNewService: () => void;
}

export function ServicesHeader({
  activeView,
  onSetView,
  onRefresh,
  onNewService,
}: ServicesHeaderProps) {
  return (
    <Card>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
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
        <div className='flex gap-2'>
          <Button type='button' variant='outline' onClick={() => void onRefresh()}>
            Refresh
          </Button>
          <Button type='button' onClick={onNewService}>
            New service
          </Button>
        </div>
      </div>
    </Card>
  );
}
