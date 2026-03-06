'use client';

import type { ReactNode } from 'react';

import { Button } from './button';
import { Card } from './card';

export interface PaginatedTableCardProps {
  title: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string;
  loadingLabel?: string;
  onLoadMore: () => Promise<void> | void;
  toolbar?: ReactNode;
  children: ReactNode;
}

export function PaginatedTableCard({
  title,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  loadingLabel = 'Loading...',
  onLoadMore,
  toolbar,
  children,
}: PaginatedTableCardProps) {
  return (
    <Card title={title}>
      {toolbar}
      {error ? <p className='mb-2 text-sm text-red-600'>{error}</p> : null}
      <div className='overflow-x-auto'>
        {children}
      </div>
      {isLoading ? <p className='mt-3 text-sm text-slate-500'>{loadingLabel}</p> : null}
      {hasMore ? (
        <div className='mt-3'>
          <Button type='button' variant='outline' onClick={() => void onLoadMore()} disabled={isLoadingMore}>
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
