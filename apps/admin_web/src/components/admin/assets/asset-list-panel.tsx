'use client';

import type { AdminAsset, AssetVisibility } from '@/types/assets';

import { ASSET_VISIBILITIES } from '@/types/assets';

import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export interface AssetListPanelProps {
  assets: AdminAsset[];
  selectedAssetId: string | null;
  filters: {
    query?: string;
    visibility?: AssetVisibility | '';
  };
  isLoadingAssets: boolean;
  isLoadingMoreAssets: boolean;
  assetsError: string;
  nextCursor: string | null;
  onQueryChange: (value: string) => void;
  onVisibilityChange: (value: AssetVisibility | '') => void;
  onApplyFilters: () => Promise<void>;
  onClearFilters: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onLoadMore: () => Promise<void>;
  onSelectAsset: (assetId: string) => void;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }
  return parsedDate.toLocaleString();
}

function formatFileSize(value: number | null): string {
  if (value === null || value < 0) {
    return '—';
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AssetListPanel({
  assets,
  selectedAssetId,
  filters,
  isLoadingAssets,
  isLoadingMoreAssets,
  assetsError,
  nextCursor,
  onQueryChange,
  onVisibilityChange,
  onApplyFilters,
  onClearFilters,
  onRefresh,
  onLoadMore,
  onSelectAsset,
}: AssetListPanelProps) {
  return (
    <Card
      title='Assets'
      description='Manage document (PDF) assets delivered through presigned URLs.'
      className='space-y-4'
    >
      <div className='grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]'>
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
        <div className='flex flex-wrap items-center justify-end gap-2'>
          <Button type='button' variant='outline' onClick={() => void onApplyFilters()}>
            Apply
          </Button>
          <Button type='button' variant='ghost' onClick={() => void onClearFilters()}>
            Clear
          </Button>
          <Button type='button' variant='secondary' onClick={() => void onRefresh()}>
            Refresh
          </Button>
        </div>
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
              <th className='px-4 py-3 font-semibold'>Size</th>
              <th className='px-4 py-3 font-semibold'>Updated</th>
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
                    <td className='px-4 py-3 text-slate-700'>{formatFileSize(asset.fileSizeBytes)}</td>
                    <td className='px-4 py-3 text-slate-700'>{formatDate(asset.updatedAt)}</td>
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
