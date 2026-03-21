'use client';

import { useMemo, useState, type FormEvent } from 'react';

import type { AdminAsset, AssetGrant, CreateAssetGrantInput } from '@/types/assets';

import { ACCESS_GRANT_TYPES } from '@/types/assets';

import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { StatusBanner } from '@/components/status-banner';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { formatDate, toTitleCase } from '@/lib/format';

const ASSET_GRANT_FORM_ID = 'admin-asset-grant-form';

interface AssetGrantsPanelProps {
  selectedAsset: AdminAsset | null;
  grants: AssetGrant[];
  isLoadingGrants: boolean;
  grantsError: string;
  grantMutationError: string;
  isSavingGrant: boolean;
  isDeletingGrantId: string | null;
  onCreateGrant: (assetId: string, input: CreateAssetGrantInput) => Promise<void>;
  onDeleteGrant: (assetId: string, grantId: string) => Promise<void>;
}

export function AssetGrantsPanel({
  selectedAsset,
  grants,
  isLoadingGrants,
  grantsError,
  grantMutationError,
  isSavingGrant,
  isDeletingGrantId,
  onCreateGrant,
  onDeleteGrant,
}: AssetGrantsPanelProps) {
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [grantType, setGrantType] = useState<CreateAssetGrantInput['grantType']>(
    'all_authenticated'
  );
  const [granteeId, setGranteeId] = useState('');
  const [formError, setFormError] = useState('');

  const isGranteeRequired = useMemo(() => grantType !== 'all_authenticated', [grantType]);

  if (!selectedAsset) {
    return (
      <>
        <Card
          title='Access grants'
          description='Select an asset to review and manage access grants.'
        >
          <p className='text-sm text-slate-600'>
            Restricted assets rely on grants. Public assets can still include grants if needed.
          </p>
        </Card>
        <ConfirmDialog {...confirmDialogProps} />
      </>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const normalizedGrantee = granteeId.trim();
    if (isGranteeRequired && !normalizedGrantee) {
      setFormError('Grantee ID is required for organization and user grants.');
      return;
    }

    await onCreateGrant(selectedAsset.id, {
      grantType,
      granteeId: isGranteeRequired ? normalizedGrantee : null,
    });
    setGranteeId('');
  };

  const handleDelete = async (grantId: string) => {
    const confirmed = await requestConfirm({
      title: 'Revoke grant',
      description: 'Delete this grant? Access revocation is immediate for new URLs.',
      confirmLabel: 'Revoke',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    await onDeleteGrant(selectedAsset.id, grantId);
  };

  return (
    <>
      <div className='space-y-6'>
        <AdminEditorCard
          title='Add grant'
          description={`Asset: ${selectedAsset.title} (${selectedAsset.visibility})`}
          actions={
            <Button type='submit' form={ASSET_GRANT_FORM_ID} disabled={isSavingGrant}>
              {isSavingGrant ? 'Adding...' : 'Add grant'}
            </Button>
          }
        >
          {grantMutationError ? (
            <StatusBanner variant='error' title='Grant update'>
              {grantMutationError}
            </StatusBanner>
          ) : null}

          {formError ? (
            <StatusBanner variant='error' title='Validation'>
              {formError}
            </StatusBanner>
          ) : null}

          <form
            id={ASSET_GRANT_FORM_ID}
            onSubmit={handleSubmit}
            className='grid grid-cols-1 gap-3 md:grid-cols-2'
          >
            <div className='space-y-2'>
              <Label htmlFor='grant-type'>Grant type *</Label>
              <Select
                id='grant-type'
                value={grantType}
                onChange={(event) =>
                  setGrantType(event.target.value as CreateAssetGrantInput['grantType'])
                }
              >
                {ACCESS_GRANT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {toTitleCase(type)}
                  </option>
                ))}
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='grantee-id'>{isGranteeRequired ? 'Grantee ID *' : 'Grantee ID'}</Label>
              <Input
                id='grantee-id'
                value={granteeId}
                onChange={(event) => setGranteeId(event.target.value)}
                required={isGranteeRequired}
                placeholder={
                  grantType === 'organization'
                    ? 'Organization UUID'
                    : grantType === 'user'
                      ? 'User sub'
                      : 'Leave empty for all_authenticated'
                }
              />
            </div>
          </form>
        </AdminEditorCard>

        <PaginatedTableCard
          title='Existing grants'
          isLoading={isLoadingGrants}
          isLoadingMore={false}
          hasMore={false}
          error={grantsError}
          loadingLabel='Loading grants...'
          onLoadMore={() => {}}
        >
          <AdminDataTable tableClassName='min-w-[680px]'>
            <AdminDataTableHead>
              <tr>
                <th className='px-4 py-3 font-semibold'>Type</th>
                <th className='px-4 py-3 font-semibold'>Grantee</th>
                <th className='px-4 py-3 font-semibold'>Granted by</th>
                <th className='px-4 py-3 font-semibold'>Created</th>
                <th className='px-4 py-3 text-right font-semibold'>Operations</th>
              </tr>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {isLoadingGrants ? null : grants.length === 0 ? (
                <tr>
                  <td className='px-4 py-8 text-slate-600' colSpan={5}>
                    No grants configured for this asset.
                  </td>
                </tr>
              ) : (
                grants.map((grant) => (
                  <tr key={grant.id}>
                    <td className='px-4 py-3 text-slate-700'>{toTitleCase(grant.grantType)}</td>
                    <td className='px-4 py-3 text-slate-700'>{grant.granteeId || '—'}</td>
                    <td className='px-4 py-3 text-slate-700'>{grant.grantedBy || '—'}</td>
                    <td className='px-4 py-3 text-slate-700'>{formatDate(grant.createdAt)}</td>
                    <td className='px-4 py-3 text-right'>
                      <Button
                        type='button'
                        size='sm'
                        variant='danger'
                        onClick={() => void handleDelete(grant.id)}
                        disabled={isDeletingGrantId === grant.id}
                      >
                        {isDeletingGrantId === grant.id ? 'Removing...' : 'Revoke'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </AdminDataTableBody>
          </AdminDataTable>
        </PaginatedTableCard>
      </div>
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
