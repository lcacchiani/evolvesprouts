'use client';

import type { MouseEvent } from 'react';

import type { AdminAsset, AssetVisibility } from '@/types/assets';

import { ASSET_VISIBILITIES } from '@/types/assets';

import { DeleteIcon } from '@/components/icons/action-icons';
import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatDate, toTitleCase } from '@/lib/format';

export interface AssetListPanelProps {
  assets: AdminAsset[];
  selectedAssetId: string | null;
  filters: {
    query?: string;
    visibility?: AssetVisibility | '';
  };
  isLoadingAssets: boolean;
  isLoadingMoreAssets: boolean;
  isDeletingAssetId: string | null;
  assetsError: string;
  nextCursor: string | null;
  onQueryChange: (value: string) => void;
  onVisibilityChange: (value: AssetVisibility | '') => void;
  onLoadMore: () => Promise<void>;
  onSelectAsset: (assetId: string) => void;
  onDeleteAsset: (assetId: string) => Promise<void>;
}

export function AssetListPanel({
  assets,
  selectedAssetId,
  filters,
  isLoadingAssets,
  isLoadingMoreAssets,
  isDeletingAssetId,
  assetsError,
  nextCursor,
  onQueryChange,
  onVisibilityChange,
  onLoadMore,
  onSelectAsset,
  onDeleteAsset,
}: AssetListPanelProps) {
  const handleDeleteAsset = async (asset: AdminAsset, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Delete "${asset.title}"? This removes the asset record and S3 object.`
    );
    if (!confirmed) {
      return;
    }
    await onDeleteAsset(asset.id);
  };

  return (
    <Card
      title='Assets'
      description='Manage document (PDF) assets delivered through presigned URLs.'
      className='space-y-4'
    >
      <div className='grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]'>
        <Input
          value={filters.query ?? ''}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder='Search by title or file name'
        />
        <Select
          value={filters.visibility ?? ''}
          onChange={(event) => onVisibilityChange(event.target.value as AssetVisibility | '')}
          aria-label='Filter by visibility'
        >
          <option value=''>All visibility</option>
          {ASSET_VISIBILITIES.map((visibility) => (
            <option key={visibility} value={visibility}>
              {toTitleCase(visibility)}
            </option>
          ))}
        </Select>
      </div>

      {assetsError ? (
        <StatusBanner variant='error' title='Assets'>
          {assetsError}
        </StatusBanner>
      ) : null}

      <div className='overflow-x-auto rounded-md border border-slate-200'>
        <table className='w-full min-w-[860px] divide-y divide-slate-200 text-left'>
          <thead className='bg-slate-100 text-xs uppercase tracking-[0.08em] text-slate-700'>
            <tr>
              <th className='px-4 py-3 font-semibold'>Title</th>
              <th className='px-4 py-3 font-semibold'>Visibility</th>
              <th className='px-4 py-3 font-semibold'>File</th>
              <th className='px-4 py-3 font-semibold'>Updated</th>
              <th className='px-4 py-3 font-semibold text-right'>Operations</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-200 bg-white text-sm'>
            {isLoadingAssets ? (
              <tr>
                <td className='px-4 py-8 text-slate-600' colSpan={5}>
                  Loading assets...
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td className='px-4 py-8 text-slate-600' colSpan={5}>
                  No assets found for the current filters.
                </td>
              </tr>
            ) : (
              assets.map((asset) => {
                const isSelected = asset.id === selectedAssetId;
                return (
                  <tr
                    key={asset.id}
                    className={`cursor-pointer transition hover:bg-slate-50 ${
                      isSelected ? 'bg-slate-100' : ''
                    }`}
                    onClick={() => onSelectAsset(asset.id)}
                    aria-selected={isSelected}
                  >
                    <td className='px-4 py-3'>
                      <p className='font-medium text-slate-900'>{asset.title}</p>
                      <p className='mt-0.5 text-xs text-slate-500'>{asset.id}</p>
                    </td>
                    <td className='px-4 py-3 text-slate-700'>{toTitleCase(asset.visibility)}</td>
                    <td className='px-4 py-3 text-slate-700'>{asset.fileName || '—'}</td>
                    <td className='px-4 py-3 text-slate-700'>{formatDate(asset.updatedAt)}</td>
                    <td className='px-4 py-3 text-right'>
                      <Button
                        type='button'
                        size='sm'
                        variant='danger'
                        onClick={(event) => void handleDeleteAsset(asset, event)}
                        disabled={isDeletingAssetId === asset.id}
                        title='Delete asset'
                        aria-label='Delete asset'
                      >
                        <DeleteIcon className='h-4 w-4' />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {nextCursor ? (
        <div className='flex justify-center pt-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => void onLoadMore()}
            disabled={isLoadingMoreAssets}
          >
            {isLoadingMoreAssets ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
