'use client';

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';

import type { AdminAsset, AssetVisibility, ListAdminAssetsInput } from '@/types/assets';

import { ASSET_VISIBILITIES, EXPENSE_ATTACHMENT_ASSET_TAG } from '@/types/assets';

import { DeleteIcon } from '@/components/icons/action-icons';
import OpenInNewTabIcon from '@/components/icons/svg/open-in-new-tab-icon.svg';
import { getUserAssetDownloadUrl } from '@/lib/assets-api';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { formatAssetTagDisplayName, formatDate, toTitleCase } from '@/lib/format';

export interface AssetListPanelProps {
  assets: AdminAsset[];
  /** Tag names returned by the admin asset list API for the current asset type scope. */
  linkedTagNames: string[];
  selectedAssetId: string | null;
  filters: {
    query?: string;
    visibility?: AssetVisibility | '';
    tagName?: ListAdminAssetsInput['tagName'];
  };
  isLoadingAssets: boolean;
  isLoadingMoreAssets: boolean;
  isDeletingAssetId: string | null;
  assetsError: string;
  nextCursor: string | null;
  onQueryChange: (value: string) => void;
  onVisibilityChange: (value: AssetVisibility | '') => void;
  onTagNameChange: (value: ListAdminAssetsInput['tagName']) => void;
  onLoadMore: () => Promise<void>;
  onSelectAsset: (assetId: string) => void;
  onDeleteAsset: (assetId: string) => Promise<void>;
}

export function AssetListPanel({
  assets,
  linkedTagNames,
  selectedAssetId,
  filters,
  isLoadingAssets,
  isLoadingMoreAssets,
  isDeletingAssetId,
  assetsError,
  nextCursor,
  onQueryChange,
  onVisibilityChange,
  onTagNameChange,
  onLoadMore,
  onSelectAsset,
  onDeleteAsset,
}: AssetListPanelProps) {
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [openingAssetId, setOpeningAssetId] = useState<string | null>(null);
  const [viewAssetError, setViewAssetError] = useState('');

  const tagFilterOptions = useMemo(() => {
    const names = [...linkedTagNames];
    const current = filters.tagName?.trim() ?? '';
    if (current && !names.includes(current)) {
      names.push(current);
    }
    return names.sort((a, b) => a.localeCompare(b));
  }, [linkedTagNames, filters.tagName]);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, assetId: string) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectAsset(assetId);
    }
  };

  const handleDeleteAsset = async (asset: AdminAsset, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const confirmed = await requestConfirm({
      title: 'Delete asset',
      description: `Delete "${asset.title}"? This removes the asset record and S3 object.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    await onDeleteAsset(asset.id);
  };

  const handleOpenAssetInNewTab = async (asset: AdminAsset, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setViewAssetError('');
    setOpeningAssetId(asset.id);
    try {
      const url = await getUserAssetDownloadUrl(asset.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open asset.';
      setViewAssetError(message);
    } finally {
      setOpeningAssetId(null);
    }
  };

  return (
    <>
      <PaginatedTableCard
        title='Assets'
        description='Manage document (PDF) assets delivered through presigned URLs.'
        isLoading={isLoadingAssets}
        isLoadingMore={isLoadingMoreAssets}
        hasMore={Boolean(nextCursor)}
        error={assetsError}
        loadingLabel='Loading assets...'
        onLoadMore={onLoadMore}
        toolbar={
          <div className='mb-3 space-y-2'>
            <div className='flex flex-wrap items-end gap-3'>
              <div className='min-w-[200px] flex-1'>
                <Label htmlFor='assets-search'>Search</Label>
                <Input
                  id='assets-search'
                  value={filters.query ?? ''}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder='Title or file name'
                />
              </div>
              <div className='min-w-[180px]'>
                <Label htmlFor='assets-visibility'>Visibility</Label>
                <Select
                  id='assets-visibility'
                  value={filters.visibility ?? ''}
                  onChange={(event) => onVisibilityChange(event.target.value as AssetVisibility | '')}
                >
                  <option value=''>All</option>
                  {ASSET_VISIBILITIES.map((visibility) => (
                    <option key={visibility} value={visibility}>
                      {toTitleCase(visibility)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className='min-w-[200px]'>
                <Label htmlFor='assets-tag-filter'>Tags</Label>
                <Select
                  id='assets-tag-filter'
                  value={filters.tagName ?? ''}
                  onChange={(event) =>
                    onTagNameChange(event.target.value === '' ? '' : event.target.value)
                  }
                >
                  <option value=''>All tags</option>
                  {tagFilterOptions.map((name) => (
                    <option key={name} value={name}>
                      {formatAssetTagDisplayName(name)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {viewAssetError ? (
              <p className='text-sm text-red-600' role='alert'>
                {viewAssetError}
              </p>
            ) : null}
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[860px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Title</th>
              <th className='px-4 py-3 font-semibold'>Tags</th>
              <th className='px-4 py-3 font-semibold'>Visibility</th>
              <th className='px-4 py-3 font-semibold'>File</th>
              <th className='px-4 py-3 font-semibold'>Updated</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {isLoadingAssets ? null : assets.length === 0 ? (
              <tr>
                <td className='px-4 py-8 text-slate-600' colSpan={6}>
                  No assets found for the current filters.
                </td>
              </tr>
            ) : (
              assets.map((asset) => {
                const isSelected = asset.id === selectedAssetId;
                const isExpenseLinked = asset.tags.some(
                  (tag) => tag.name.toLowerCase() === EXPENSE_ATTACHMENT_ASSET_TAG
                );
                const sortedTags = [...asset.tags].sort((a, b) =>
                  a.name.localeCompare(b.name)
                );
                return (
                  <tr
                    key={asset.id}
                    className={`cursor-pointer transition hover:bg-slate-50 ${
                      isSelected ? 'bg-slate-100' : ''
                    }`}
                    onClick={() => onSelectAsset(asset.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, asset.id)}
                    tabIndex={0}
                    role='row'
                    aria-selected={isSelected}
                  >
                    <td className='px-4 py-3'>
                      <p className='font-medium text-slate-900'>{asset.title}</p>
                      <p className='mt-0.5 text-xs text-slate-500'>{asset.id}</p>
                    </td>
                    <td className='px-4 py-3 text-slate-700'>
                      {sortedTags.length === 0 ? (
                        '—'
                      ) : (
                        <div className='flex flex-wrap gap-1'>
                          {sortedTags.map((tag) => {
                            const isExpense =
                              tag.name.toLowerCase() === EXPENSE_ATTACHMENT_ASSET_TAG;
                            return (
                              <span
                                key={tag.id}
                                className={
                                  isExpense
                                    ? 'rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900'
                                    : 'rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800'
                                }
                              >
                                {formatAssetTagDisplayName(tag.name)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className='px-4 py-3 text-slate-700'>{toTitleCase(asset.visibility)}</td>
                    <td className='px-4 py-3 text-slate-700'>{asset.fileName || '—'}</td>
                    <td className='px-4 py-3 text-slate-700'>{formatDate(asset.updatedAt)}</td>
                    <td className='px-4 py-3 text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          onClick={(event) => void handleOpenAssetInNewTab(asset, event)}
                          disabled={openingAssetId === asset.id}
                          title='Open asset in new tab'
                          aria-label='Open asset in new tab'
                        >
                          <OpenInNewTabIcon className='h-4 w-4' />
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
                          onClick={(event) => void handleDeleteAsset(asset, event)}
                          disabled={isDeletingAssetId === asset.id || isExpenseLinked}
                          title={
                            isExpenseLinked
                              ? 'Cannot delete assets linked to expenses'
                              : 'Delete asset'
                          }
                          aria-label={
                            isExpenseLinked
                              ? 'Cannot delete: asset is linked to expenses'
                              : 'Delete asset'
                          }
                        >
                          <DeleteIcon className='h-4 w-4' />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
